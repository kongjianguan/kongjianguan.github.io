<script setup lang="ts" name="CodeMirrorEditor">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  EditorView,
  Decoration,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
  DecorationSet,
} from '@codemirror/view'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { basicSetup } from 'codemirror'
import MarkdownIt from 'markdown-it'

const md = MarkdownIt({ html: false, breaks: true, linkify: true })

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRef = ref<HTMLDivElement>()
let view: EditorView | null = null

class RenderedLineWidget extends WidgetType {
  constructor(
    readonly html: string,
    readonly pos: number,
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const span = document.createElement('span')
    span.className = 'cm-rendered-line'
    span.innerHTML = this.html
    span.addEventListener('mousedown', (e) => {
      e.preventDefault()
      view.dispatch({ selection: { anchor: this.pos }, scrollIntoView: true })
    })
    return span
  }

  eq(other: RenderedLineWidget) {
    return other.html === this.html && other.pos === this.pos
  }
}

function renderLineContent(
  text: string,
): { html: string; className: string } | null {
  const trimmed = text.trim()

  if (trimmed === '') return null
  if (/^```/.test(trimmed)) return null

  const headingMatch = text.match(/^(#{1,6})\s+(.*)$/)
  if (headingMatch) {
    const level = headingMatch[1].length
    const content = md.renderInline(headingMatch[2])
    return { html: content, className: `cm-md-h${level}` }
  }

  const quoteMatch = text.match(/^>\s*(.*)$/)
  if (quoteMatch) {
    const content = md.renderInline(quoteMatch[1])
    return { html: content, className: 'cm-md-quote' }
  }

  const ulMatch = text.match(/^[-*+]\s+(.*)$/)
  if (ulMatch) {
    const content = md.renderInline(ulMatch[1])
    return { html: `• ${content}`, className: 'cm-md-list' }
  }

  const olMatch = text.match(/^(\d+)\.\s+(.*)$/)
  if (olMatch) {
    const content = md.renderInline(olMatch[2])
    return { html: `${olMatch[1]}. ${content}`, className: 'cm-md-list' }
  }

  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
    return { html: '<hr/>', className: 'cm-md-hr' }
  }

  const content = md.renderInline(text)
  return { html: content, className: 'cm-md-p' }
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc
      const cursorLine = doc.lineAt(view.state.selection.main.head).number

      let inCodeBlock = false
      let inFrontmatter = false
      let checkedFrontmatterStart = false

      for (let lineNum = 1; lineNum <= doc.lines; lineNum++) {
        const line = doc.line(lineNum)
        const text = line.text
        const trimmed = text.trim()

        if (!checkedFrontmatterStart && lineNum === 1 && trimmed === '---') {
          inFrontmatter = true
          checkedFrontmatterStart = true
          continue
        }
        checkedFrontmatterStart = true

        if (inFrontmatter) {
          if (trimmed === '---') inFrontmatter = false
          continue
        }

        if (/^```/.test(trimmed)) {
          inCodeBlock = !inCodeBlock
          continue
        }

        if (inCodeBlock) continue
        if (lineNum === cursorLine) continue

        const result = renderLineContent(text)
        if (!result) continue

        builder.add(
          line.from,
          line.from,
          Decoration.line({ class: result.className }),
        )

        if (line.from < line.to) {
          builder.add(
            line.from,
            line.to,
            Decoration.replace({
              widget: new RenderedLineWidget(result.html, line.from),
            }),
          )
        }
      }

      return builder.finish()
    }
  },
  { decorations: (v) => v.decorations },
)

function createEditor() {
  if (!editorRef.value) return

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      emit('update:modelValue', update.state.doc.toString())
    }
  })

  const extensions = [
    basicSetup,
    markdown(),
    updateListener,
    livePreviewPlugin,
    EditorView.theme({
      '&': {
        height: '100%',
        fontSize: '14px',
      },
      '.cm-scroller': {
        lineHeight: '1.7',
      },
      '.cm-content': {
        padding: '8px 4px',
      },
      '.cm-line': {
        padding: '0 8px',
      },
    }),
  ]

  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions,
    }),
    parent: editorRef.value,
  })
}

onMounted(() => {
  createEditor()
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (val) => {
    if (view && val !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: val,
        },
      })
    }
  },
)
</script>

<template>
  <div ref="editorRef" class="cm-editor-container" />
</template>

<style scoped>
.cm-editor-container {
  min-height: 300px;
  overflow: hidden;
}

.cm-editor-container :deep(.cm-editor) {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-radius: 0 0 8px 8px;
}

.cm-editor-container :deep(.cm-editor .cm-gutters) {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  border-right: 1px solid var(--vp-c-divider);
}

.cm-editor-container :deep(.cm-editor .cm-activeLineGutter) {
  background: var(--vp-c-bg-soft);
}

.cm-editor-container :deep(.cm-editor .cm-activeLine) {
  background: var(--vp-c-bg-soft);
}

.cm-editor-container :deep(.cm-editor .cm-cursor) {
  border-left-color: var(--vp-c-text-1) !important;
}

.cm-editor-container :deep(.cm-editor .cm-selectionBackground) {
  background: var(--vp-c-brand-soft) !important;
}

.cm-editor-container :deep(.cm-editor .cm-selectionMatch) {
  background: var(--vp-c-brand-soft);
}

/* Line-level styling — matches vp-doc article styles */
.cm-editor-container :deep(.cm-md-h1) {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 40px;
  color: var(--vp-c-text-1);
}
.cm-editor-container :deep(.cm-md-h2) {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 32px;
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 24px;
  margin: 48px 0 16px;
  color: var(--vp-c-text-1);
}
.cm-editor-container :deep(.cm-md-h3) {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 28px;
  margin: 32px 0 0;
  color: var(--vp-c-text-1);
}
.cm-editor-container :deep(.cm-md-h4) {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 24px;
  margin: 24px 0 0;
  color: var(--vp-c-text-1);
}
.cm-editor-container :deep(.cm-md-h5) {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--vp-c-text-1);
}
.cm-editor-container :deep(.cm-md-h6) {
  font-size: 15px;
  font-weight: 600;
  line-height: 24px;
  color: var(--vp-c-text-2);
}
.cm-editor-container :deep(.cm-md-quote) {
  color: var(--vp-c-text-2);
  border-left: 2px solid var(--vp-c-divider);
  padding-left: 16px;
  transition: border-color 0.5s;
}
.cm-editor-container :deep(.cm-md-list) {
  padding-left: 1.25rem;
  color: var(--vp-c-text-1);
}
.cm-editor-container :deep(.cm-md-hr) {
  margin: 16px 0;
  border-top: 1px solid var(--vp-c-divider);
}
.cm-editor-container :deep(.cm-md-p) {
  line-height: 28px;
  margin: 16px 0;
  color: var(--vp-c-text-1);
}

@media (min-width: 768px) {
  .cm-editor-container :deep(.cm-md-h1) {
    font-size: 32px;
    line-height: 40px;
  }
}

/* Widget content (rendered inline HTML) — matches vp-doc inline styles */
.cm-rendered-line {
  display: inline;
}

.cm-rendered-line :deep(strong) {
  font-weight: 600;
}

.cm-rendered-line :deep(em) {
  font-style: italic;
}

.cm-rendered-line :deep(del) {
  text-decoration: line-through;
}

.cm-rendered-line :deep(code) {
  font-size: var(--vp-code-font-size);
  color: var(--vp-code-color);
  background-color: var(--vp-code-bg);
  border-radius: 4px;
  padding: 3px 6px;
  font-family: var(--vp-font-family-mono);
  transition: color 0.25s, background-color 0.5s;
}

.cm-rendered-line :deep(a) {
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
  pointer-events: none;
}

.cm-rendered-line :deep(img) {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

.cm-rendered-line :deep(hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid var(--vp-c-divider);
}

@media (max-width: 767px) {
  .cm-editor-container {
    min-height: 200px;
  }
}
</style>
