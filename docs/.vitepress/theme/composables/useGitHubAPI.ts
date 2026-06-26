// docs/.vitepress/theme/composables/useGitHubAPI.ts
import { useGitHubAuth } from './useGitHubAuth'

const REPO_OWNER = 'kongjianguan'
const REPO_NAME = 'kongjianguan.github.io'
const BRANCH = 'main'
const API_BASE = 'https://api.github.com'

function getHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  }
}

export function useGitHubAPI() {
  const { token } = useGitHubAuth()

  function requireToken(): string {
    if (!token.value) throw new Error('Not authenticated')
    return token.value
  }

  async function readFile(path: string): Promise<{ content: string; sha: string } | null> {
    const t = requireToken()
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`
    const res = await fetch(url, { headers: getHeaders(t) })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
    const data = await res.json()
    return {
      content: atob(data.content),
      sha: data.sha
    }
  }

  async function createFile(path: string, content: string, message: string): Promise<boolean> {
    const t = requireToken()
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: BRANCH
    }
    const res = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(t),
      body: JSON.stringify(body)
    })
    return res.ok
  }

  async function updateFile(path: string, content: string, sha: string, message: string): Promise<{ sha: string } | null> {
    const t = requireToken()
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`
    const body = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      sha,
      branch: BRANCH
    }
    const res = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(t),
      body: JSON.stringify(body)
    })
    if (!res.ok) return null
    const data = await res.json()
    return { sha: data.content.sha }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const t = requireToken()

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image too large (max 5MB)')
    }

    const ext = file.name.split('.').pop() || 'png'
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const random = Math.random().toString(36).slice(2, 8)
    const filename = `${timestamp}-${random}.${ext}`
    const path = `docs/public/images/${filename}`

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const imageUrl = `/images/${filename}`

        try {
          const res = await createFile(path, base64, `upload: ${filename}`)
          if (res) resolve(imageUrl)
          else reject(new Error('Upload failed'))
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  async function fileExists(path: string): Promise<boolean> {
    const t = requireToken()
    const url = `${API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`
    const res = await fetch(url, { headers: getHeaders(t) })
    return res.ok
  }

  return { readFile, createFile, updateFile, uploadImage, fileExists }
}
