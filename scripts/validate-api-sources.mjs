import { access } from 'node:fs/promises'

const requiredFiles = [
  'api/_lib/github.ts',
  'api/auth/callback.ts',
  'api/auth/me.ts',
  'api/auth/logout.ts',
  'api/github/contents.ts',
  'api/github/upload.ts',
]

const missing = []
for (const file of requiredFiles) {
  try {
    await access(file)
  } catch {
    missing.push(file)
  }
}

if (missing.length > 0) {
  console.error('Editor API source check failed; missing:')
  for (const file of missing) console.error(`- ${file}`)
  process.exitCode = 1
} else {
  console.log(`Editor API source check passed: ${requiredFiles.length} file(s)`)
}
