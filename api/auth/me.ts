import {
  clearAuthCookies,
  getGitHubUser,
  getSessionToken,
  isAllowedGitHubLogin,
  json,
} from '../_lib/github'

export const config = { runtime: 'edge' }

export default async function handler(request: Request) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const token = await getSessionToken(request)
  if (!token) return json({ error: 'Not authenticated' }, 401)

  try {
    const user = await getGitHubUser(token)
    if (!user || !isAllowedGitHubLogin(user.login)) {
      return json({ error: 'GitHub session expired' }, 401, clearAuthCookies(request))
    }
    return json({
      user: {
        login: user.login,
        avatar_url: user.avatar_url || '',
      },
    })
  } catch {
    return json({ error: 'Unable to verify session' }, 502)
  }
}
