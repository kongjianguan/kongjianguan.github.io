import { createContentLoader } from 'vitepress'
import MarkdownIt from 'markdown-it'

declare const data: string[]
export { data }

const markdown = new MarkdownIt({ html: true })
const languages = ['mermaid', 'markmap', 'infographic']
const components = [
  '<MermaidChart', '<MarkmapRoot', '<InfographicChart',
  '<mermaid-chart', '<markmap-root', '<infographic-chart',
  '<PreviewMermaidPath', '<PreviewMarkmapPath', '<PreviewInfographicPath',
]

function containsDiagram(tokens: ReturnType<typeof markdown.parse>): boolean {
  return tokens.some(token => (
    (token.type === 'fence' && languages.includes(token.info.trim())) ||
    ((token.type === 'html_block' || token.type === 'html_inline') &&
      components.some(component => token.content.includes(component))) ||
    (token.children !== null && containsDiagram(token.children))
  ))
}

export default createContentLoader('**/*.md', {
  includeSrc: true,
  transform(pages) {
    return pages
      .filter(page => containsDiagram(markdown.parse(page.src!, {})))
      .flatMap(page => [page.url, page.frontmatter.permalink].filter(Boolean))
      .map(path => decodeURI(path).replace(/\/$/, ''))
  },
})
