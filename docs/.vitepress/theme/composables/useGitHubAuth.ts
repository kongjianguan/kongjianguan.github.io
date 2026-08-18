import { ref } from 'vue'

const CLIENT_ID = 'Ov23liU7H301C2GpbL74'
const REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/__auth/callback`
  : ''
const LOCAL_EDIT = import.meta.env.DEV && import.meta.env.VITE_LOCALEDIT === '1'
const RETURN_TO_KEY = 'github_oauth_return_to'
const STATE_KEY = 'github_oauth_state'
const OAUTH_STATE_COOKIE = 'github_oauth_state'

interface GitHubUser {
  login: string
  avatar_url: string
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(96)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const item = document.cookie.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))
  if (!item) return null
  try { return decodeURIComponent(item.slice(name.length + 1)) } catch { return null }
}

function setCookie(name: string, value: string, maxAge: number): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function getSafeReturnTo(value: string | null): string {
  if (typeof window === 'undefined' || !value) return '/'
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return '/'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/'
  }
}

const isLoggedIn = ref(false)
const user = ref<GitHubUser | null>(null)
let sessionCheckStarted = false

if (typeof window !== 'undefined') {
  try { localStorage.removeItem('github_token') } catch { /* storage may be unavailable */ }
}

async function loadSession(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' })
    if (!res.ok) {
      isLoggedIn.value = false
      user.value = null
      return
    }
    const data = await res.json()
    if (data.user?.login) {
      user.value = { login: data.user.login, avatar_url: data.user.avatar_url || '' }
      isLoggedIn.value = true
    }
  } catch {
    isLoggedIn.value = false
    user.value = null
  }
}

export function useGitHubAuth() {
  if (typeof window !== 'undefined' && LOCAL_EDIT && !isLoggedIn.value) {
    isLoggedIn.value = true
    user.value = { login: 'local-dev', avatar_url: '' }
  }

  if (typeof window !== 'undefined' && !LOCAL_EDIT && !sessionCheckStarted) {
    sessionCheckStarted = true
    void loadSession()
  }

  async function login() {
    const verifier = generateCodeVerifier()
    const state = generateState()
    sessionStorage.setItem('code_verifier', verifier)
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(
      RETURN_TO_KEY,
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    )
    setCookie(OAUTH_STATE_COOKIE, state, 10 * 60)
    const challenge = await generateCodeChallenge(verifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'public_repo',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      response_type: 'code',
    })

    window.location.href = `https://github.com/login/oauth/authorize?${params}`
  }

  async function handleCallback(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const oauthError = urlParams.get('error')
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY)

    if (!code) {
      if (oauthError) console.error('GitHub OAuth error:', oauthError)
      sessionStorage.removeItem('code_verifier')
      sessionStorage.removeItem(STATE_KEY)
      sessionStorage.removeItem(RETURN_TO_KEY)
      setCookie(OAUTH_STATE_COOKIE, '', 0)
      if (oauthError) window.location.replace(getSafeReturnTo(returnTo))
      return
    }

    const verifier = sessionStorage.getItem('code_verifier')
    const expectedState = sessionStorage.getItem(STATE_KEY)
    const state = urlParams.get('state')
    if (!verifier || !expectedState || !state || state !== expectedState) {
      console.error('Invalid OAuth callback state')
      return
    }

    try {
      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: verifier, state }),
      })
      const data = await res.json()
      if (!res.ok || !data.user?.login) throw new Error(data.error || 'GitHub 登录失败')

      user.value = { login: data.user.login, avatar_url: data.user.avatar_url || '' }
      isLoggedIn.value = true
      sessionStorage.removeItem('code_verifier')
      sessionStorage.removeItem(STATE_KEY)
      sessionStorage.removeItem(RETURN_TO_KEY)
      window.location.replace(getSafeReturnTo(returnTo))
    } catch (error) {
      console.error('OAuth callback error:', error)
      setCookie(OAUTH_STATE_COOKIE, '', 0)
    }
  }

  async function logout(): Promise<boolean> {
    if (LOCAL_EDIT) {
      isLoggedIn.value = false
      user.value = null
      return true
    }

    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': getCookie('github_csrf') || '' },
      })
      if (!res.ok) return false
      isLoggedIn.value = false
      user.value = null
      return true
    } catch {
      return false
    }
  }

  return {
    isLoggedIn,
    user,
    login,
    handleCallback,
    logout,
    getCsrfToken: () => getCookie('github_csrf'),
  }
}
