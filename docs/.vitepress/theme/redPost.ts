export function isRedPost(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.layout === 'red' || frontmatter.type === 'red'
}

export function getPostPhotos(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((photo): photo is string => typeof photo === 'string' && Boolean(photo.trim()))
    : []
}

export function getPostAuthor(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') return value.name
  return ''
}

export function resolvePostImage(path: string, imageBase: string, siteBase: string): string {
  if (!path.startsWith('/images/')) return path
  if (imageBase === '/images') return `${siteBase}${path.slice(1)}`

  return `${imageBase}/${path.slice('/images/'.length)}`
}
