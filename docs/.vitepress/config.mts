// 主配置文件
import { defineConfig } from 'vitepress'
import { teekConfig } from "./teekConfig"
import { HeadData } from "./config/Head"
import type { HeadConfig } from "vitepress"; // 在文件顶部添加类型导入
import { chineseSearchOptimize, pagefindPlugin } from 'vitepress-plugin-pagefind'
import { createRewrites } from "vitepress-theme-teek/config";

export default defineConfig({
  
  title: "KONGJIANGUAN",
  description: "え？雲☁😄、タッタッタッタッタ、原神がめちゃくちゃやりたい😨、クラウド原神😙、ドンドンドンドン😊、華やかな世界を見よう👍🎊😆、クラウド原神😄、うううう、原神がやりたい😭😭😭クラウド原神、友達が待ってるよ😊😃😆、一緒に原神をやろう、クラウド原神！あああああ😙、原神がやりたい😙クラウド原神、ははははは🤣🤣🤣、一緒に原神をやろう、クラウド原神、すごくすごく、🤩原神がやりたい😋ウェブクラウド版、低消費電力で画質も劣化なし😌、WiFiもLANケーブルも🥰、どっちでも60フレーム😍、さあさあ👏、クラウド原神に入ろう",
  base: '/',
  head: HeadData as HeadConfig[],
  extends: teekConfig,
  cleanUrls: true,  // 不显示 .html 后缀
  lang: "zh-CN",
  lastUpdated: true,
  rewrites: createRewrites({ srcDir: "docs" }),

  // https://vitepress.dev/zh/guide/sitemap-generation
  sitemap: {
    hostname: 'https://kongjianguan.github.io',
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
    plugins: [
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

    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      {
        text: '编程',
        items: [
          {
            text: '☁💡🎈 ACM',
            items: [
              { text: '算法', link: '/ACM/algorithm/' },
            ]
          },
          {
            text: '工具',
            items: [
              { text: '教程', link: '/guidance/' },
              { text: '配置', link: '/configure/' },
            ],
            
          },
        ]
      },
      {
        text: '软件',
        items: [
          {
            text:'工具',
            link:'/Software'
          }
        ]
      },

      // {
      //   text: '📚 学习',
      //   items: []
      // },
      // {
      //   text: '🎮 娱乐',
      //   items: []
      // },

      {
        text: '关于',
        items: [
          {
            text: '博客',
            items: [
              { text: '历程', link: '/About/History/' },
              { text: 'UtaBuild', link: '/About/History/utabuild-intro/' },
            ]
          }
        ]
      }
    ],

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
})
