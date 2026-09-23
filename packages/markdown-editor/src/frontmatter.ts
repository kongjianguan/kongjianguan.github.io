import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export interface ParsedFrontmatter {
  frontmatter: Record<string, unknown>
  body: string
  error?: string
}

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const normalized = markdown.replace(/\r\n?/g, '\n')
  const match = normalized.match(/^---\n(?:([\s\S]*?)\n)?---(?:\n|$)([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: markdown }

  try {
    const parsed = match[1] === undefined ? {} : parseYaml(match[1])
    if (parsed === null || parsed === undefined) {
      return { frontmatter: {}, body: match[2] || '' }
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('文章属性必须是 YAML 对象')
    }
    return { frontmatter: parsed as Record<string, unknown>, body: match[2] || '' }
  } catch (error) {
    const detail = error instanceof Error && error.message ? `：${error.message}` : ''
    return {
      frontmatter: {},
      body: match[2] || '',
      error: `文章属性 YAML 无法解析${detail}`,
    }
  }
}

export function buildFrontmatter(frontmatter: Record<string, unknown>): string {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd()
  return `---\n${yaml}\n---`
}

export function assembleMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  return `${buildFrontmatter(frontmatter)}\n${body}`
}
