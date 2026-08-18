import {
  BRANCH,
  encodeBytes,
  getGitHubUser,
  getSessionToken,
  githubRequest,
  hasValidCsrf,
  isAllowedGitHubLogin,
  json,
  randomToken,
  validatePath,
} from '../_lib/github'

export const config = { runtime: 'edge' }

type ImageExtension = 'png' | 'jpg' | 'gif' | 'webp'

function detectImageExtension(bytes: Uint8Array): ImageExtension | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'png'

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpg'
  }

  if (bytes.length >= 6) {
    const header = new TextDecoder().decode(bytes.subarray(0, 6))
    if (header === 'GIF87a' || header === 'GIF89a') return 'gif'
  }

  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP'
  ) return 'webp'

  return null
}

function mimeMatchesExtension(mime: string, extension: ImageExtension): boolean {
  if (!mime) return true
  if (extension === 'jpg') return mime === 'image/jpeg'
  return mime === `image/${extension}`
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = await getSessionToken(request)
  if (!token) return json({ error: 'Not authenticated' }, 401)
  if (!hasValidCsrf(request)) return json({ error: 'Invalid CSRF token' }, 403)

  const user = await getGitHubUser(token)
  if (!user || !isAllowedGitHubLogin(user.login)) {
    return json({ error: 'GitHub account is not allowed to edit this site' }, 403)
  }

  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return json({ error: 'Missing image file' }, 400)
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Image too large' }, 413)

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > 5 * 1024 * 1024) return json({ error: 'Image too large' }, 413)

    const ext = detectImageExtension(bytes)
    if (!ext || !mimeMatchesExtension(file.type.toLowerCase(), ext)) {
      return json({ error: 'Invalid image content' }, 415)
    }

    const filename = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${randomToken(6)}.${ext}`
    const path = `docs/public/images/${filename}`
    const safePath = validatePath(path)

    const response = await githubRequest(token, safePath, {
      method: 'PUT',
      body: JSON.stringify({
        message: `upload: ${filename}`,
        content: encodeBytes(bytes),
        branch: BRANCH,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return json({ error: 'GitHub upload failed' }, response.status)
    if (typeof data.content?.sha !== 'string') return json({ error: 'GitHub did not return a file version' }, 502)
    return json({ url: `/images/${filename}`, sha: data.content.sha })
  } catch (error: any) {
    if (error?.message?.startsWith('非法路径')) return json({ error: error.message }, 400)
    return json({ error: 'Invalid image upload request' }, 400)
  }
}
