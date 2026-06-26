// api/auth/callback.ts
export const config = { runtime: 'edge' }

export default async function handler(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const verifier = searchParams.get('code_verifier')

  if (!code || !verifier) {
    return new Response(JSON.stringify({ error: 'Missing code or code_verifier' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: 'Ov23liU7H301C2GpbL74',
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code'
      })
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
