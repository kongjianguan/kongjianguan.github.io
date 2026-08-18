import { useGitHubAuth } from './useGitHubAuth'

const REPO_OWNER = 'kongjianguan'
const REPO_NAME = 'kongjianguan.github.io'
const BRANCH = 'main'
const API_BASE = 'https://api.github.com'

function getReadHeaders(): HeadersInit {
  return { Accept: 'application/vnd.github+json' }
}

export function useGitHubAPI() {
  const { getCsrfToken } = useGitHubAuth()

  const ARTICLE_DIRS = ['programming', 'Software', 'Life', '历程', '随笔', '@pages']

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
    if (dangerous.some(re => re.test(path))) {
      throw new Error('非法路径：受保护位置')
    }

    const isArticle = path.endsWith('.md') && (
      ARTICLE_DIRS.some(dir => path.startsWith(`docs/${dir}/`)) ||
      path === 'docs/index.md' ||
      /^docs\/[^/]+\.md$/.test(path)
    )
    const isImage = path.startsWith('docs/public/images/') &&
      /\.(png|jpe?g|gif|webp)$/i.test(path)

    if (!isArticle && !isImage) {
      throw new Error('非法路径：不在允许的文章或图片目录内')
    }
  }

  function encodeRepoPath(path: string): string {
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
  }

  async function readFile(path: string): Promise<{ content: string; sha: string } | null> {
    validatePath(path)
    const url = new URL(
      `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeRepoPath(path)}`,
    )
    url.searchParams.set('ref', BRANCH)
    const res = await fetch(url, { headers: getReadHeaders() })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const data = await res.json()
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

  async function writeFile(payload: Record<string, unknown>): Promise<{ sha: string } | null> {
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

  async function createFile(path: string, content: string, message: string): Promise<{ sha: string } | null> {
    validatePath(path)
    return writeFile({ action: 'create', path, content, message })
  }

  async function updateFile(path: string, content: string, sha: string, message: string): Promise<{ sha: string } | null> {
    validatePath(path)
    return writeFile({ action: 'update', path, content, sha, message })
  }

  async function uploadImage(file: File): Promise<string | null> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image too large (max 5MB)')
    }

    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/github/upload', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': getCsrfToken() || '' },
      body: form,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return typeof data.url === 'string' ? data.url : null
  }

  async function fileExists(path: string): Promise<boolean> {
    return (await readFile(path)) !== null
  }

  return { readFile, createFile, updateFile, uploadImage, fileExists }
}
