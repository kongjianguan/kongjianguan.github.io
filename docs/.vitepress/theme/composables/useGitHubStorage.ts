import { useGitHubAuth } from './useGitHubAuth'
import type { EditorStorage } from '@kongjianguan/markdown-editor'

const ARTICLE_DIRS = ['programming', 'Software', 'Life', '历程', '随笔', '@pages']

const LOCAL_AUTH = import.meta.env.DEV && [
  import.meta.env.VITE_LOCAL_AUTH,
  import.meta.env.VITE_LOCALEDIT,
].includes('1')

const localMdSources: Record<string, string> = LOCAL_AUTH
  ? import.meta.glob('/**/*.md', { query: '?raw', import: 'default', eager: true })
  : {}

/*
 * 本地编辑模式下没有可用的 GitHub 会话，读取改从磁盘上的 Markdown 取材，
 * 让文章结构与真实渲染保持一致。
 */
function getLocalContent(path: string): string | null {
  const normalized = path.startsWith('docs/') ? path.slice(5) : path
  const content = localMdSources[`/${normalized}`] || localMdSources[path]
  return typeof content === 'string' ? content : null
}

function validatePath(path: string): void {
  if (
    !path ||
    path.length > 512 ||
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('..') ||
    path.includes('%') ||
    /[?#\\]/.test(path) ||
    /[\u0000-\u001f\u007f-\u009f]/.test(path)
  ) throw new Error('非法路径：包含目录穿越或 URL 控制字符')

  if (path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('非法路径：包含目录穿越')
  }

  const dangerous = [
    /^\.github\//, /^\.vitepress\//, /^api\//,
    /^package(-lock)?\.json$/, /^pnpm-lock/, /^vercel\.json$/,
    /^\.env/, /^docs\/\.vitepress\//,
  ]
  if (path === 'docs/index.md' || dangerous.some(re => re.test(path))) {
    throw new Error('非法路径：受保护位置')
  }

  const isArticle = path.endsWith('.md') && (
    ARTICLE_DIRS.some(dir => path.startsWith(`docs/${dir}/`)) ||
    /^docs\/[^/]+\.md$/.test(path)
  )
  const isImage = path.startsWith('docs/public/images/') &&
    /\.(png|jpe?g|gif|webp)$/i.test(path)

  if (!isArticle && !isImage) {
    throw new Error('非法路径：不在允许的文章或图片目录内')
  }
}

export function createGitHubStorage(options: { photoPost?: boolean } = {}): EditorStorage {
  const { getCsrfToken } = useGitHubAuth()

  async function readFile(path: string) {
    validatePath(path)
    if (LOCAL_AUTH) {
      const content = getLocalContent(path)
      return content === null ? null : { content, sha: 'local' }
    }
    const params = new URLSearchParams({ path })
    const endpoint = `/api/github/contents?${params}`
    const res = await fetch(endpoint, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (res.status === 404) return null
    const data = await res.json()
    if (res.status === 401) throw new Error('GitHub 登录已失效，请重新登录后读取文章')
    if (!res.ok) throw new Error(data.error || `读取 GitHub 文章失败（${res.status}）`)
    if (typeof data.content !== 'string' || typeof data.sha !== 'string') {
      throw new Error('GitHub 返回的不是文件内容')
    }
    return {
      content: new TextDecoder('utf-8').decode(
        Uint8Array.from(atob(data.content), c => c.charCodeAt(0)),
      ),
      sha: data.sha,
    }
  }

  async function writeFile(payload: Record<string, unknown>) {
    if (LOCAL_AUTH) {
      throw new Error('本地登录只支持本机编辑，保存到 GitHub 需要使用 GitHub 登录')
    }
    const res = await fetch('/api/github/contents', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken() || '',
      },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `GitHub write failed (${res.status})`)
    if (typeof data.sha !== 'string') throw new Error('GitHub did not return a file version')
    return { sha: data.sha }
  }

  return {
    readFile,

    ...(LOCAL_AUTH
      ? {
          readLocalFile: (path: string) => getLocalContent(path),
          localFileNotice: '本地登录只支持本机编辑，保存到 GitHub 需要使用 GitHub 登录',
        }
      : {}),

    async createFile(path, content, message) {
      validatePath(path)
      return writeFile({ action: 'create', path, content, message })
    },

    async updateFile(path, content, sha, message) {
      validatePath(path)
      return writeFile({ action: 'update', path, content, sha, message })
    },

    async uploadImage(file) {
      if (LOCAL_AUTH) {
        throw new Error('本地登录只支持本机编辑，上传图片需要使用 GitHub 登录')
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image too large (max 5MB)')
      }

      const form = new FormData()
      form.append('file', file)
      if (options.photoPost) form.append('purpose', 'red-post')
      const res = await fetch('/api/github/upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCsrfToken() || '' },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) throw new Error('GitHub 登录已失效，请重新登录后上传照片')
      if (!res.ok) throw new Error(data.error || '图片上传失败')
      return typeof data.url === 'string' ? data.url : null
    },
  }
}
