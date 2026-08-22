import { ref } from 'vue'

const CLIENT_ID = 'Ov23liU7H301C2GpbL74'
const AUTH_CALLBACK_PATH = '/__auth/callback'
const REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}${AUTH_CALLBACK_PATH}`
  : ''
const LOCAL_EDIT = import.meta.env.DEV && import.meta.env.VITE_LOCALEDIT === '1'
const OAUTH_STATE_COOKIE = 'github_oauth_state'
const OAUTH_MESSAGE = 'github-oauth-complete'
const OAUTH_PENDING_PREFIX = 'github_oauth_pending:'

interface PendingOAuth {
  verifier: string
  returnTo: string
}

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

function getOAuthPendingKey(state: string): string {
  return `${OAUTH_PENDING_PREFIX}${state}`
}

function readPendingOAuth(state: string | null): PendingOAuth | null {
  if (typeof window === 'undefined' || !state) return null
  try {
    const raw = localStorage.getItem(getOAuthPendingKey(state))
    if (!raw) return null
    const pending = JSON.parse(raw)
    if (typeof pending.verifier !== 'string' || typeof pending.returnTo !== 'string') return null
    return pending
  } catch {
    return null
  }
}

function clearPendingOAuth(state: string | null): void {
  if (typeof window === 'undefined' || !state) return
  try { localStorage.removeItem(getOAuthPendingKey(state)) } catch { /* storage may be unavailable */ }
}

const isLoggedIn = ref(false)
const user = ref<GitHubUser | null>(null)
const loginPending = ref(false)
let sessionCheckStarted = false
let authPopup: Window | null = null
let popupCloseWatcher: number | null = null
let popupMessageListenerStarted = false

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

function releaseAuthPopup(): void {
  if (typeof window !== 'undefined' && popupCloseWatcher !== null) {
    window.clearInterval(popupCloseWatcher)
  }
  popupCloseWatcher = null
  authPopup = null
  loginPending.value = false
}

function watchAuthPopup(popup: Window): void {
  if (typeof window === 'undefined') return
  if (popupCloseWatcher !== null) window.clearInterval(popupCloseWatcher)
  popupCloseWatcher = window.setInterval(() => {
    if (popup.closed) releaseAuthPopup()
  }, 500)
}

function startPopupMessageListener(): void {
  if (typeof window === 'undefined' || popupMessageListenerStarted) return
  popupMessageListenerStarted = true
  window.addEventListener('message', (event: MessageEvent) => {
    if (
      event.origin !== window.location.origin ||
      event.source !== authPopup ||
      event.data?.type !== OAUTH_MESSAGE
    ) return

    releaseAuthPopup()
    if (event.data.ok) {
      void loadSession()
    } else if (event.data.error) {
      console.error('GitHub OAuth error:', event.data.error)
    }
  })
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
  startPopupMessageListener()

  async function login() {
    if (loginPending.value || (authPopup && !authPopup.closed)) return
    loginPending.value = true

    const popup = window.open(
      'about:blank',
      'github-oauth',
      'popup,width=520,height=720,noopener=no,toolbar=no,menubar=no,location=yes,status=no,scrollbars=yes,resizable=yes',
    )
    authPopup = popup && !popup.closed ? popup : null
    if (authPopup) watchAuthPopup(authPopup)

    const verifier = generateCodeVerifier()
    const state = generateState()
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
    try {
      localStorage.setItem(getOAuthPendingKey(state), JSON.stringify({ verifier, returnTo }))
    } catch {
      authPopup?.close()
      releaseAuthPopup()
      throw new Error('无法保存登录状态，请检查浏览器存储权限')
    }
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

    const authorizeUrl = `https://github.com/login/oauth/authorize?${params}`
    if (authPopup) {
      authPopup.location.href = authorizeUrl
      authPopup.focus()
    } else {
      window.location.href = authorizeUrl
    }
  }

  async function handleCallback(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const oauthError = urlParams.get('error')
    const state = urlParams.get('state')
    const pending = readPendingOAuth(state)
    const returnTo = pending?.returnTo || '/'
    const isPopup = window.opener && window.opener !== window

    function finishPopup(ok: boolean, error?: string): void {
      if (!isPopup) return
      window.opener?.postMessage({ type: OAUTH_MESSAGE, ok, error }, window.location.origin)
      window.close()
    }

    function clearCallbackState(): void {
      clearPendingOAuth(state)
      setCookie(OAUTH_STATE_COOKIE, '', 0)
    }

    if (!code) {
      if (oauthError) console.error('GitHub OAuth error:', oauthError)
      clearCallbackState()
      if (isPopup) {
        finishPopup(false, oauthError || 'GitHub 登录取消')
      } else if (oauthError) {
        window.location.replace(getSafeReturnTo(returnTo))
      }
      return
    }

    if (!pending?.verifier || !state) {
      console.error('Invalid OAuth callback state')
      clearCallbackState()
      finishPopup(false, '登录状态已失效，请重试')
      return
    }

    try {
      const res = await fetch('/api/auth/callback', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, code_verifier: pending.verifier, state }),
      })
      const data = await res.json()
      if (!res.ok || !data.user?.login) throw new Error(data.error || 'GitHub 登录失败')

      user.value = { login: data.user.login, avatar_url: data.user.avatar_url || '' }
      isLoggedIn.value = true
      clearCallbackState()
      if (isPopup) {
        finishPopup(true)
      } else {
        window.location.replace(getSafeReturnTo(returnTo))
      }
    } catch (error) {
      console.error('OAuth callback error:', error)
      clearCallbackState()
      finishPopup(false, error instanceof Error ? error.message : 'GitHub 登录失败')
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
    loginPending,
    handleCallback,
    logout,
    getCsrfToken: () => getCookie('github_csrf'),
  }
}
