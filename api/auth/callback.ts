import {
  getGitHubUser,
  isAllowedGitHubLogin,
  json,
  randomToken,
  sealSessionToken,
  serializeCookie,
  parseCookies,
} from '../_lib/github'

export const config = { runtime: 'edge' }

const CLIENT_ID = 'Ov23liU7H301C2GpbL74'

function clearOAuthState(request: Request): Headers {
  const headers = new Headers()
  headers.append('Set-Cookie', serializeCookie('github_oauth_state', '', request, { maxAge: 0 }))
  return headers
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Invalid callback request' }, 400)
  }

  const code = payload?.code
  const verifier = payload?.code_verifier
  const state = payload?.state
  if (
    typeof code !== 'string' || !code || code.length > 2048 ||
    typeof verifier !== 'string' || !verifier || verifier.length > 256 ||
    typeof state !== 'string' || !state || state.length > 256
  ) {
    return json({ error: 'Missing or invalid OAuth callback data' }, 400)
  }

  const cookies = parseCookies(request.headers.get('cookie'))
  if (!cookies.github_oauth_state || cookies.github_oauth_state !== state) {
    return json({ error: 'Invalid OAuth state' }, 403, clearOAuthState(request))
  }

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
      }),
    })

    const data = await res.json()
    if (!res.ok || typeof data.access_token !== 'string') {
      return json({ error: 'GitHub token exchange failed' }, 502, clearOAuthState(request))
    }

    const user = await getGitHubUser(data.access_token)
    if (!user) return json({ error: 'GitHub user verification failed' }, 502, clearOAuthState(request))
    if (!isAllowedGitHubLogin(user.login)) {
      return json({ error: 'GitHub account is not allowed to edit this site' }, 403, clearOAuthState(request))
    }

    const sessionValue = await sealSessionToken(data.access_token)
    const csrfToken = randomToken()
    const headers = new Headers()
    headers.append(
      'Set-Cookie',
      serializeCookie('github_session', sessionValue, request, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7,
      }),
    )
    headers.append(
      'Set-Cookie',
      serializeCookie('github_csrf', csrfToken, request, {
        maxAge: 60 * 60 * 24 * 7,
      }),
    )
    headers.append('Set-Cookie', serializeCookie('github_oauth_state', '', request, { maxAge: 0 }))

    return json({
      user: {
        login: user.login,
        avatar_url: user.avatar_url || '',
      },
    }, 200, headers)
  } catch {
    return json({ error: 'Token exchange failed' }, 500, clearOAuthState(request))
  }
}
