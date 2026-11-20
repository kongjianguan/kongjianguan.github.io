import {
  BRANCH,
  encodeUtf8,
  getGitHubUser,
  getSessionToken,
  githubRequest,
  hasValidCsrf,
  isAllowedGitHubLogin,
  isImagePath,
  json,
  validatePath,
  validateMarkdown,
} from '../_lib/github'

export const config = { runtime: 'edge' }

export default async function handler(request: Request) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' })
  }

  const token = await getSessionToken(request)
  if (!token) return json({ error: 'Not authenticated' }, 401)
  if (request.method === 'POST' && !hasValidCsrf(request)) {
    return json({ error: 'Invalid CSRF token' }, 403)
  }

  const user = await getGitHubUser(token)
  if (!user || !isAllowedGitHubLogin(user.login)) {
    return json({ error: 'GitHub account is not allowed to edit this site' }, 403)
  }

  try {
    if (request.method === 'GET') {
      const path = validatePath(new URL(request.url).searchParams.get('path') || '')
      if (isImagePath(path)) return json({ error: '只支持读取 Markdown 文章' }, 400)
      const response = await githubRequest(token, path, { method: 'GET' })
      if (response.status === 404) return json({ error: '文章不存在' }, 404)
      if (!response.ok) {
        const error = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0'
          ? 'GitHub 请求额度已用完，请稍后重试'
          : '读取 GitHub 文章失败，请检查仓库访问权限'
        return json({ error }, response.status)
      }
      const data = await response.json()
      if (typeof data.content !== 'string' || typeof data.sha !== 'string') {
        return json({ error: 'GitHub 返回的不是文章内容' }, 502)
      }
      return json({ content: data.content, sha: data.sha })
    }

    const payload = await request.json()
    const action = payload?.action
    const path = payload?.path
    const content = payload?.content
    const message = payload?.message

    if (
      (action !== 'create' && action !== 'update') ||
      typeof path !== 'string' ||
      typeof content !== 'string' ||
      typeof message !== 'string' ||
      !message.trim() ||
      message.length > 200
    ) {
      return json({ error: 'Invalid request' }, 400)
    }

    const safePath = validatePath(path)
    if (isImagePath(safePath)) {
      return json({ error: 'Images must be uploaded through the image upload endpoint' }, 400)
    }
    validateMarkdown(content, safePath)
    const body: Record<string, string> = {
      message: message.trim(),
      content: encodeUtf8(content),
      branch: BRANCH,
    }

    if (action === 'update') {
      if (typeof payload.sha !== 'string' || !payload.sha) {
        return json({ error: 'Missing file version' }, 400)
      }
      body.sha = payload.sha
    }

    const response = await githubRequest(token, safePath, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return json({ error: 'GitHub write failed' }, response.status)
    }
    if (typeof data.content?.sha !== 'string') {
      return json({ error: 'GitHub did not return a file version' }, 502)
    }
    return json({ sha: data.content.sha })
  } catch (error: any) {
    if (error?.message?.startsWith('非法路径') || error?.message?.startsWith('非法内容')) {
      return json({ error: error.message }, 400)
    }
    return request.method === 'GET'
      ? json({ error: '读取 GitHub 文章失败' }, 502)
      : json({ error: 'Invalid GitHub write request' }, 400)
  }
}
