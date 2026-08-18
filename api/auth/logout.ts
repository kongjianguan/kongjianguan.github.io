import { clearAuthCookies, hasValidCsrf, json } from '../_lib/github'

export const config = { runtime: 'edge' }

export default function handler(request: Request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!hasValidCsrf(request)) return json({ error: 'Invalid CSRF token' }, 403)
  return json({ ok: true }, 200, clearAuthCookies(request))
}
