// 主配置文件
import { readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vitepress'
import { teekConfig } from "./teekConfig"
import { getPostPhotos, isRedPost, resolvePostImage } from './theme/redPost'
import { HeadData } from "./config/Head"
import type { HeadConfig } from "vitepress"; // 在文件顶部添加类型导入
import { chineseSearchOptimize, pagefindPlugin } from 'vitepress-plugin-pagefind'
import { createRewrites } from "vitepress-theme-teek/config";

const siteOrigin = 'https://kongjianguan.fyi'
const defaultOgImage = 'https://cdn.jsdmirror.com/gh/kongjianguan/images/avatar.jpg'
const photoImageBase = process.env.LOCALIMGSRC === '1'
  ? '/images'
  : 'https://cdn.jsdmirror.com/gh/kongjianguan/kongjianguan.github.io@main/docs/public/images'

async function collectReferencedRootImages(roots: string[]): Promise<Set<string>> {
  const referenced = new Set<string>()
  const ignoredDirs = new Set(['.vitepress', 'dist', 'cache', 'node_modules', 'public'])

  async function walk(directory: string) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) await walk(fullPath)
        continue
      }
      if (!/\.(md|ts|mts|js|mjs|vue)$/i.test(entry.name)) continue
      const text = await readFile(fullPath, 'utf8')
      for (const match of text.matchAll(/\/images\/([^"'()\s<>]+?)(?=["'()\s<>]|$)/g)) {
        const rel = match[1]
        if (!rel.includes('/')) referenced.add(rel)
      }
    }
  }

  for (const root of roots) await walk(root)
  return referenced
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const localAuth = process.env.LOCAL_AUTH || process.env.VITE_LOCAL_AUTH || process.env.VITE_LOCALEDIT
    || env.LOCAL_AUTH || env.VITE_LOCAL_AUTH || env.VITE_LOCALEDIT || ''

  return {
  
  title: "KONGJIANGUAN",
  description: "kongjianguan的日记",
  base: '/',
  head: HeadData as HeadConfig[],
  extends: teekConfig,
  cleanUrls: true,  // 不显示 .html 后缀
  lang: "zh-CN",
  lastUpdated: true,
  rewrites: createRewrites({ srcDir: "docs" }),

  transformPageData({ frontmatter }) {
    if (!isRedPost(frontmatter)) return
    frontmatter.layout = 'red'
    frontmatter.sidebar = false
  },

  transformHead({ pageData, siteConfig }) {
    if (pageData.isNotFound) return
    const rawPermalink = typeof pageData.frontmatter?.permalink === 'string'
      ? pageData.frontmatter.permalink.trim()
      : ''
    const pathname = rawPermalink
      ? (rawPermalink.startsWith('/') ? rawPermalink : `/${rawPermalink}`)
      : `/${pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')}`.replace(/\/+/g, '/')
    const canonicalUrl = new URL(pathname, siteOrigin).href
    const ogTitle = String(pageData.frontmatter?.title || pageData.title || siteConfig.site.title)
    const ogDescription = String(pageData.frontmatter?.description || pageData.description || siteConfig.site.description)
    const isHome = pageData.relativePath === 'index.md' || pageData.frontmatter?.layout === 'home'
    const ogType = isHome ? 'website' : 'article'

    let rawImage = ''
    if (isRedPost(pageData.frontmatter)) {
      const photos = getPostPhotos(pageData.frontmatter.photos)
      const candidate = pageData.frontmatter.coverImg || pageData.frontmatter.cover || photos[0]
      if (typeof candidate === 'string') {
        rawImage = resolvePostImage(candidate, photoImageBase, siteConfig.site.base)
      }
    } else if (typeof pageData.frontmatter?.coverImg === 'string') {
      rawImage = resolvePostImage(pageData.frontmatter.coverImg, photoImageBase, siteConfig.site.base)
    }
    const ogImage = rawImage
      ? (rawImage.startsWith('/') ? new URL(rawImage, siteOrigin).href : rawImage)
      : defaultOgImage

    return [
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:type', content: ogType }],
      ['meta', { property: 'og:site_name', content: siteConfig.site.title }],
      ['meta', { property: 'og:title', content: ogTitle }],
      ['meta', { property: 'og:description', content: ogDescription }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:image', content: ogImage }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ]
  },

  async buildEnd(siteConfig) {
    if (process.env.LOCALIMGSRC === '1') return
    const imagesOutDir = path.join(siteConfig.outDir, 'images')
    let entries
    try {
      entries = await readdir(imagesOutDir, { withFileTypes: true })
    } catch {
      return
    }
    // 生产环境背景图由外部图床加载，仅保留文章与测试直接引用的静态图片，避免冗余壁纸打入部署产物。
    const referenced = await collectReferencedRootImages([
      path.resolve('docs'),
      path.resolve('e2e'),
    ])
    await Promise.all(
      entries
        .filter(entry => entry.isFile() && !referenced.has(entry.name))
        .map(entry => rm(path.join(imagesOutDir, entry.name), { force: true })),
    )
  },

  // https://vitepress.dev/zh/guide/sitemap-generation
  sitemap: {
    hostname: siteOrigin,
    transformItems(items) {
      return items.filter(item => (
        new URL(item.url, siteOrigin).pathname !== '/__auth/callback'
      ))
    },
  },


  markdown: {
    math: true,         // 启用数学公式支持
    lineNumbers: true,  // 开启行号
    image: {
      lazyLoading: true  // 图片懒加载，默认禁用
    },
    // 更改容器默认值标题
    container: {
      tipLabel: "提示",
      warningLabel: "警告",
      dangerLabel: "危险",
      infoLabel: "信息",
      detailsLabel: "详细信息"
    }
  },

  vite: {
    envDir: process.cwd(),
    define: {
      'import.meta.env.VITE_LOCAL_AUTH': JSON.stringify(localAuth),
    },
    optimizeDeps: {
      // 预扫描按需加载的编辑器，避免开发服务器在首次打开时重新加载页面。
      entries: [
        '.vitepress/theme/index.ts',
        '.vitepress/theme/components/NewArticleDialog.vue',
        '../packages/markdown-editor/src/components/MarkdownEditor.vue',
        '../packages/markdown-editor/src/components/CodeMirrorEditor.vue',
      ],
    },
    plugins: [
      {
        name: 'github-oauth-callback',
        configureServer(server) {
          server.middlewares.use((request, _response, next) => {
            if (request.url?.split('?')[0] === '/__auth/callback') {
              const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''
              request.url = `/__auth/callback.html${query}`
            }
            next()
          })
        },
      },
      {
        name: 'red-post-covers',
        configResolved(config) {
          // Teek 在 config 阶段汇总文章，首页和分类列表共用这些文章对象。
          const { base, themeConfig } = config.vitepress.site
          for (const { frontmatter } of themeConfig.posts.allPosts) {
            if (!isRedPost(frontmatter)) continue
            const photos = getPostPhotos(frontmatter.photos)
            const cover = frontmatter.coverImg || frontmatter.cover || photos[0]
            if (typeof cover === 'string') frontmatter.coverImg = resolvePostImage(cover, photoImageBase, base)
            if (photos.length > 1) frontmatter.titleTag ??= `${photos.length}P`
          }
        },
      },
      // 本地搜索
      pagefindPlugin({
        btnPlaceholder: '搜索',
        placeholder: '搜索文档',
        emptyText: '空空如也',
        heading: '共: {{searchResult}} 条结果',
        customSearchQuery: chineseSearchOptimize
      })
    ]
  },

  themeConfig: {
    photoImageBase,

    // https://vitepress.dev/reference/default-theme-config
    // nav: [
    //   { text: '首页', link: '/' },
    //   {
    //     text: '编程',
    //     items: [
    //       {
    //         text: '☁💡🎈 ACM',
    //         items: [
    //           { text: '算法', link: '/ACM/algorithm/' },
    //         ]
    //       },
    //       {
    //         text: '工具',
    //         items: [
    //           { text: '教程', link: '/guidance/' },
    //           { text: '配置', link: '/configure/' },
    //         ],
            
    //       },
    //     ]
    //   },
    //   {
    //     text: '软件',
    //     items: [
    //       {
    //         text:'工具',
    //         link:'/Software'
    //       }
    //     ]
    //   },

    //   // {
    //   //   text: '📚 学习',
    //   //   items: []
    //   // },
    //   // {
    //   //   text: '🎮 娱乐',
    //   //   items: []
    //   // },

    //   {
    //     text: '关于',
    //     items: [
    //       {
    //         text: '博客',
    //         items: [
    //           { text: '历程', link: '/About/History/' },
    //           { text: 'UtaBuild', link: '/About/History/utabuild-intro/' },
    //         ]
    //       }
    //     ]
    //   }
    // ],

    // 文章大纲配置
    outline: {
      level: [2, 4],  // 显示 2~4 级标题
      label: "本文导航",  // 文章大纲上方的标签
    },

    lastUpdatedText: "上次更新时间",

    // 前后文章跳转按钮的文字
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },

    // search: {
    //   provider: "algolia",
    //   options: {
    //     appId: '...', // 你的 Application ID
    //     apiKey: '...', // 你的Search API Key
    //     indexName: 'chunge16vitepress' // 你的indexName
    //   }
    // },
  }
  }
})
