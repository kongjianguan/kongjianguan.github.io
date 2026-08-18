import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

const docsDir = path.resolve('docs')
const articleDirs = ['programming', 'Software', '\u5386\u7a0b', '\u968f\u7b14', 'Life']
const ignoredDirs = new Set(['.vitepress', 'dist', 'node_modules'])
const maxMarkdownBytes = 2 * 1024 * 1024
const errors = []
let checkedFiles = 0

function isStringArray(value) {
  return value === undefined || value === null || (
    Array.isArray(value) && value.every(item => item === null || typeof item === 'string')
  )
}

function validateArticle(relativePath, content) {
  const normalized = content.replace(/\r\n?/g, '\n')
  if (!normalized.startsWith('---\n')) {
    errors.push(`${relativePath}: missing YAML frontmatter`)
    return
  }

  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)
  if (!match) {
    errors.push(`${relativePath}: unterminated YAML frontmatter`)
    return
  }

  let frontmatter
  try {
    frontmatter = parseYaml(match[1])
  } catch (error) {
    errors.push(`${relativePath}: invalid YAML (${error.message})`)
    return
  }

  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    errors.push(`${relativePath}: frontmatter must be an object`)
    return
  }

  if (typeof frontmatter.title !== 'string' || !frontmatter.title.trim()) {
    errors.push(`${relativePath}: title must be a non-empty string`)
  } else if (frontmatter.title.length > 200) {
    errors.push(`${relativePath}: title exceeds 200 characters`)
  }

  if (typeof frontmatter.date !== 'string' || !frontmatter.date.trim()) {
    errors.push(`${relativePath}: date must be a non-empty string`)
  }

  for (const field of ['categories', 'tags']) {
    if (!isStringArray(frontmatter[field])) {
      errors.push(`${relativePath}: ${field} must be an array of strings`)
    }
  }

  if (typeof frontmatter.description === 'string' && frontmatter.description.length > 5000) {
    errors.push(`${relativePath}: description exceeds 5000 characters`)
  }

  if (frontmatter.permalink !== undefined && frontmatter.permalink !== null) {
    const permalink = frontmatter.permalink
    if (
      typeof permalink !== 'string' ||
      !permalink.trim() ||
      permalink.length > 256 ||
      !permalink.startsWith('/') ||
      /[?#\s]/.test(permalink) ||
      permalink.includes('..') ||
      permalink === '/' ||
      permalink === '/archives' ||
      permalink.startsWith('/api/') ||
      permalink.startsWith('/__auth/')
    ) {
      errors.push(`${relativePath}: permalink is invalid or reserved`)
    }
  }
}

async function collectMarkdown(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        files.push(...await collectMarkdown(path.join(directory, entry.name)))
      }
      continue
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(path.join(directory, entry.name))
    }
  }

  return files
}

const files = await collectMarkdown(docsDir)
for (const file of files) {
  const relativePath = path.relative(docsDir, file).split(path.sep).join('/')
  const content = await readFile(file, 'utf8')
  checkedFiles += 1

  if (Buffer.byteLength(content, 'utf8') > maxMarkdownBytes) {
    errors.push(`${relativePath}: file exceeds 2MB`)
  }

  const isArticle = articleDirs.some(dir => relativePath.startsWith(`${dir}/`))
  if (isArticle) validateArticle(relativePath, content)
}

if (errors.length > 0) {
  console.error(`Content validation failed for ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Content validation passed: ${checkedFiles} Markdown file(s)`)
}
