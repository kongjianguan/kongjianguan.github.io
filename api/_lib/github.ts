import { parse as parseYaml } from 'yaml'

export const REPO_OWNER = 'kongjianguan'
const REPO_NAME = 'kongjianguan.github.io'
export const BRANCH = 'main'
export const GITHUB_API = 'https://api.github.com'

export const ARTICLE_DIRS = ['programming', 'Software', 'Life', '历程', '随笔', '@pages']
const MAX_PATH_LENGTH = 512
const MAX_MARKDOWN_BYTES = 2 * 1024 * 1024
const SESSION_COOKIE = 'github_session'
const CSRF_COOKIE = 'github_csrf'
const OAUTH_STATE_COOKIE = 'github_oauth_state'

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'application/json')
  responseHeaders.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  })
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {}
  return Object.fromEntries(header.split(';').flatMap(part => {
    const index = part.indexOf('=')
    if (index < 0) return []
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    try {
      return [[key, decodeURIComponent(value)]]
    } catch {
      return [[key, value]]
    }
  }))
}

export function serializeCookie(
  name: string,
  value: string,
  request: Request,
  options: { httpOnly?: boolean; maxAge?: number } = {},
): string {
  const url = new URL(request.url)
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
  ]
  if (url.protocol === 'https:') parts.push('Secure')
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  return parts.join('; ')
}

function encodeBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
    const binary = atob(normalized + padding)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
  } catch {
    return null
  }
}

export function randomToken(bytes = 32): string {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return encodeBase64Url(data)
}

function getSessionSecret(): string {
  return process.env.GITHUB_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET || ''
}

async function getSessionKey(): Promise<CryptoKey> {
  const secret = getSessionSecret()
  if (!secret) throw new Error('缺少会话加密密钥')

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey(
    'raw',
    digest,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function sealSessionToken(token: string): Promise<string> {
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await getSessionKey(),
    new TextEncoder().encode(token),
  )
  return `${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`
}

export async function openSessionToken(value: string): Promise<string | null> {
  const [ivValue, encryptedValue] = value.split('.')
  if (!ivValue || !encryptedValue) return null

  const iv = decodeBase64Url(ivValue)
  const encrypted = decodeBase64Url(encryptedValue)
  if (!iv || !encrypted || iv.length !== 12) return null

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      await getSessionKey(),
      encrypted,
    )
    return new TextDecoder().decode(decrypted)
  } catch {
    return null
  }
}

export async function getSessionToken(request: Request): Promise<string | null> {
  const value = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE]
  return value ? openSessionToken(value) : null
}

export function hasValidCsrf(request: Request): boolean {
  const csrfCookie = parseCookies(request.headers.get('cookie'))[CSRF_COOKIE]
  const csrfHeader = request.headers.get('x-csrf-token')
  return Boolean(csrfCookie && csrfHeader && csrfCookie === csrfHeader)
}

export function validatePath(path: string): string {
  if (typeof path !== 'string' || !path || path.length > MAX_PATH_LENGTH) {
    throw new Error('非法路径：路径为空或过长')
  }
  if (
    path.startsWith('/') ||
    path.endsWith('/') ||
    path.includes('..') ||
    path.includes('%') ||
    /[?#\\]/.test(path) ||
    /[\u0000-\u001f\u007f-\u009f]/.test(path)
  ) {
    throw new Error('非法路径：包含目录穿越或 URL 控制字符')
  }

  const segments = path.split('/')
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
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

  return path
}

export function isImagePath(path: string | undefined): boolean {
  return Boolean(path && path.startsWith('docs/public/images/'))
}

function isBlogArticlePath(path: string | undefined): boolean {
  return Boolean(path && ARTICLE_DIRS.some(
    dir => dir !== '@pages' && path.startsWith(`docs/${dir}/`),
  ))
}

function validateArticleFrontmatter(path: string | undefined, frontmatter: unknown): void {
  if (!isBlogArticlePath(path)) return
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    throw new Error('非法内容：文章属性必须是 YAML 对象')
  }

  const data = frontmatter as Record<string, unknown>
  if (typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error('非法内容：文章必须包含非空标题')
  }
  if (data.title.length > 200) {
    throw new Error('非法内容：文章标题超过 200 个字符')
  }
  if (typeof data.date !== 'string' || !data.date.trim()) {
    throw new Error('非法内容：文章必须包含日期')
  }
  for (const field of ['categories', 'tags']) {
    const value = data[field]
    if (
      value !== undefined &&
      value !== null &&
      (!Array.isArray(value) || value.some(item => item !== null && typeof item !== 'string'))
    ) {
      throw new Error(`非法内容：${field} 必须是字符串数组`)
    }
  }
  if (typeof data.description === 'string' && data.description.length > 5000) {
    throw new Error('非法内容：文章摘要超过 5000 个字符')
  }
  if (data.permalink !== undefined && data.permalink !== null) {
    if (
      typeof data.permalink !== 'string' ||
      !data.permalink.trim() ||
      data.permalink.length > 256 ||
      !data.permalink.startsWith('/') ||
      /[?#\s]/.test(data.permalink) ||
      data.permalink.includes('..') ||
      data.permalink === '/' ||
      data.permalink === '/archives' ||
      data.permalink.startsWith('/api/') ||
      data.permalink.startsWith('/__auth/')
    ) {
      throw new Error('非法内容：文章永久链接格式或路径不允许')
    }
  }
}

export function validateMarkdown(content: string, path?: string): void {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('非法内容：文章不能为空')
  }
  if (new TextEncoder().encode(content).byteLength > MAX_MARKDOWN_BYTES) {
    throw new Error('非法内容：文章超过 2MB 限制')
  }

  const normalized = content.replace(/\r\n?/g, '\n')
  if (!normalized.startsWith('---\n')) {
    if (isBlogArticlePath(path)) throw new Error('非法内容：文章缺少 YAML 属性')
    return
  }

  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  if (!match) throw new Error('非法内容：文章属性 YAML 缺少结束标记')

  try {
    const parsed = parseYaml(match[1])
    if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
      throw new Error('文章属性必须是 YAML 对象')
    }
    validateArticleFrontmatter(path, parsed)
  } catch (error: any) {
    if (error?.message?.startsWith('非法内容：')) throw error
    const detail = error?.message ? `：${error.message}` : ''
    throw new Error(`非法内容：文章属性 YAML 无法解析${detail}`)
  }
}

export function encodeUtf8(content: string): string {
  return encodeBytes(new TextEncoder().encode(content))
}

export function encodeBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }
}

export interface GitHubUser {
  login: string
  avatar_url?: string
}

export async function getGitHubUser(token: string): Promise<GitHubUser | null> {
  try {
    const response = await fetch(`${GITHUB_API}/user`, {
      headers: githubHeaders(token),
    })
    if (!response.ok) return null
    const user = await response.json()
    if (typeof user.login !== 'string' || !user.login) return null
    return {
      login: user.login,
      avatar_url: typeof user.avatar_url === 'string' ? user.avatar_url : '',
    }
  } catch {
    return null
  }
}

export function isAllowedGitHubLogin(login: string): boolean {
  const configured = process.env.GITHUB_ALLOWED_LOGINS
  const allowed = (configured || REPO_OWNER)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  return allowed.includes(login)
}

export function clearAuthCookies(request: Request): Headers {
  const headers = new Headers()
  headers.append('Set-Cookie', serializeCookie(SESSION_COOKIE, '', request, {
    httpOnly: true,
    maxAge: 0,
  }))
  headers.append('Set-Cookie', serializeCookie(CSRF_COOKIE, '', request, { maxAge: 0 }))
  headers.append('Set-Cookie', serializeCookie(OAUTH_STATE_COOKIE, '', request, { maxAge: 0 }))
  return headers
}

export async function githubRequest(
  token: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const safePath = validatePath(path)
  const encodedPath = safePath.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return fetch(`${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodedPath}`, {
    ...init,
    headers: {
      ...githubHeaders(token),
      ...(init.headers || {}),
    },
  })
}
