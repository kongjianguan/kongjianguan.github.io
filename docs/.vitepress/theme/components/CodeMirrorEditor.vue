<script setup lang="ts" name="CodeMirrorEditor">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView, Decoration, WidgetType, ViewPlugin, ViewUpdate, DecorationSet } from '@codemirror/view'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import MarkdownIt from 'markdown-it'
import { basicSetup } from 'codemirror'

const md = MarkdownIt({ html: false, breaks: true, linkify: true })

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRef = ref<HTMLDivElement>()
let view: EditorView | null = null

class RenderedBlockWidget extends WidgetType {
  constructor(
    readonly html: string,
    readonly blockStart: number,
    readonly blockEnd: number,
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const div = document.createElement('div')
    div.className = 'cm-rendered-block'
    div.innerHTML = this.html
    div.addEventListener('dblclick', () => {
      view.dispatch({
        selection: { anchor: this.blockStart },
        scrollIntoView: true
      })
    })
    return div
  }

  eq(other: RenderedBlockWidget) {
    return other.html === this.html && other.blockStart === this.blockStart
  }
}

function splitBlocks(text: string): { startLine: number; endLine: number }[] {
  const lines = text.split('\n')
  const blocks: { startLine: number; endLine: number }[] = []
  let start = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      if (i > start && lines.slice(start, i).some(l => l.trim() !== '')) {
        blocks.push({ startLine: start, endLine: i })
      }
      start = i + 1
    }
  }
  if (start < lines.length && lines.slice(start).some(l => l.trim() !== '')) {
    blocks.push({ startLine: start, endLine: lines.length })
  }
  return blocks
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>()
      const doc = view.state.doc
      const cursor = view.state.selection.main.head

      const blocks = splitBlocks(doc.toString())

      for (const block of blocks) {
        const blockStartLine = doc.line(block.startLine + 1)
        const blockEndLine = doc.line(block.endLine)
        const blockFrom = blockStartLine.from
        const blockTo = blockEndLine.to

        if (cursor >= blockFrom && cursor <= blockTo) continue

        const blockText = doc.slice(blockFrom, blockTo).toString()
        if (!blockText.trim()) continue

        try {
          const html = md.render(blockText)
          builder.add(
            blockFrom, blockTo,
            Decoration.replace({
              widget: new RenderedBlockWidget(html, blockFrom, blockTo),
              inclusive: false,
            }),
          )
        } catch {
          // ignore render failures
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

.cm-rendered-block {
  pointer-events: auto;
  cursor: pointer;
  padding: 0 8px;
}

.cm-rendered-block:hover {
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
}

.cm-rendered-block h1,
.cm-rendered-block h2,
.cm-rendered-block h3 {
  color: var(--vp-c-text-1);
  margin: 0.5em 0 0.2em;
}

.cm-rendered-block p {
  margin: 0;
  color: var(--vp-c-text-2);
}

.cm-rendered-block ul,
.cm-rendered-block ol {
  margin: 0;
  padding-left: 1.5em;
  color: var(--vp-c-text-2);
}

.cm-rendered-block code {
  background: var(--vp-c-bg-soft);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.85em;
}

.cm-rendered-block pre {
  background: var(--vp-c-bg-soft);
  padding: 8px 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.cm-rendered-block blockquote {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid var(--vp-c-brand);
  color: var(--vp-c-text-2);
}

@media (max-width: 767px) {
  .cm-editor-container {
    min-height: 200px;
  }
}
</style>
