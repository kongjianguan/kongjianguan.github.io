// docs/.vitepress/theme/composables/useGitHubAuth.ts
import { ref, type Ref } from 'vue'

const CLIENT_ID = 'Ov23liU7H301C2GpbL74'
const REDIRECT_URI = typeof window !== 'undefined'
  ? `${window.location.origin}/__auth/callback`
  : ''
const LOCAL_EDIT = import.meta.env.VITE_LOCALEDIT === '1'

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

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const isLoggedIn = ref(false)
const user = ref<GitHubUser | null>(null)
const token = ref<string | null>(
  typeof window !== 'undefined' ? localStorage.getItem('github_token') : null
)

async function verifyToken(t: string): Promise<boolean> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return false
    const u = await res.json()
    user.value = { login: u.login, avatar_url: u.avatar_url }
    isLoggedIn.value = true
    return true
  } catch {
    return false
  }
}

export function useGitHubAuth() {
  if (typeof window !== 'undefined' && LOCAL_EDIT && !isLoggedIn.value) {
    isLoggedIn.value = true
    user.value = { login: 'local-dev', avatar_url: '' }
    token.value = token.value || 'local-dev-token'
  }

  if (token.value && !isLoggedIn.value) {
    verifyToken(token.value).then(valid => {
      if (!valid) { token.value = null; localStorage.removeItem('github_token') }
    })
  }

  async function login() {

    const verifier = generateCodeVerifier()
    sessionStorage.setItem('code_verifier', verifier)
    const challenge = await generateCodeChallenge(verifier)

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'public_repo',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      response_type: 'code'
    })

    window.location.href = `https://github.com/login/oauth/authorize?${params}`
  }

  async function handleCallback(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    if (!code) return

    const verifier = sessionStorage.getItem('code_verifier')
    if (!verifier) {
      console.error('No code_verifier found in sessionStorage')
      return
    }

    try {
      const res = await fetch(`/api/auth/callback?code=${code}&code_verifier=${verifier}`)
      const data = await res.json()
      if (data.access_token) {
        token.value = data.access_token
        localStorage.setItem('github_token', data.access_token)
        sessionStorage.removeItem('code_verifier')
        await verifyToken(data.access_token)
        window.history.replaceState({}, '', window.location.pathname)
      } else {
        console.error('OAuth callback failed:', data)
      }
    } catch (e) {
      console.error('OAuth callback error:', e)
    }
  }

  function logout() {
    token.value = null
    isLoggedIn.value = false
    user.value = null
    localStorage.removeItem('github_token')
  }

  return { isLoggedIn, user, token, login, handleCallback, logout }
}
