<script setup lang="ts" name="CodeMirrorEditor">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView } from '@codemirror/view'

const props = withDefaults(defineProps<{
  modelValue: string
  initialSelection?: number
}>(), {
  initialSelection: 0,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  navigate: [direction: 'previous' | 'next']
  escape: []
}>()

const editorRef = ref<HTMLDivElement>()
let view: EditorView | null = null
let history: string[] = []
let historyIndex = 0
let applyingHistory = false

function applyHistory(nextIndex: number): boolean {
  if (!view || nextIndex < 0 || nextIndex >= history.length || nextIndex === historyIndex) {
    return false
  }

  historyIndex = nextIndex
  const value = history[historyIndex]
  applyingHistory = true
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: value },
    selection: { anchor: value.length },
  })
  applyingHistory = false
  return true
}

function createEditor() {
  if (!editorRef.value) return

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const value = update.state.doc.toString()
      if (!applyingHistory) {
        history = history.slice(0, historyIndex + 1)
        history.push(value)
        historyIndex = history.length - 1
      }
      emit('update:modelValue', value)
    }
  })

  const navigationHandlers = EditorView.domEventHandlers({
    keydown: (event, editor) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        return applyHistory(event.shiftKey ? historyIndex + 1 : historyIndex - 1)
      }
      if (event.key === 'Escape') {
        emit('escape')
        return true
      }
      if (event.key === 'ArrowUp') {
        const selection = editor.state.selection.main
        if (selection.empty && selection.head === 0) {
          emit('navigate', 'previous')
          return true
        }
      }
      if (event.key === 'ArrowDown') {
        const selection = editor.state.selection.main
        if (selection.empty && selection.head === editor.state.doc.length) {
          emit('navigate', 'next')
          return true
        }
      }
      return false
    },
  })

  const selection = Math.max(0, Math.min(props.initialSelection, props.modelValue.length))
  history = [props.modelValue]
  historyIndex = 0
  view = new EditorView({
    doc: props.modelValue,
    selection: { anchor: selection },
    extensions: [
      EditorView.lineWrapping,
      navigationHandlers,
      updateListener,
      EditorView.theme({
          '&': {
            width: '100%',
            fontSize: '16px',
            background: 'var(--vp-c-bg)',
          },
          '&.cm-focused': {
            outline: 'none',
          },
          '.cm-scroller': {
            overflow: 'auto',
            maxHeight: '60vh',
            lineHeight: '1.75',
            fontFamily: 'var(--vp-font-family-base)',
          },
          '.cm-content': {
            padding: '8px 4px',
            caretColor: 'var(--vp-c-brand-1)',
          },
          '.cm-line': {
            padding: '0 8px',
          },
          '.cm-gutters': {
            display: 'none',
          },
          '.cm-activeLine': {
            background: 'transparent',
          },
          '.cm-selectionBackground, ::selection': {
            backgroundColor: 'var(--vp-c-brand-soft) !important',
          },
          '.cm-cursor': {
            borderLeftColor: 'var(--vp-c-brand-1)',
          },
      }),
    ],
    parent: editorRef.value,
  })

  requestAnimationFrame(() => {
    view?.focus()
    view?.dispatch({ scrollIntoView: true })
  })
}

onMounted(createEditor)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString()) return
    history = [value]
    historyIndex = 0
    applyingHistory = true
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
    })
    applyingHistory = false
  },
)
</script>

<template>
  <div ref="editorRef" class="cm-inline-block-editor" />
</template>

<style scoped>
.cm-inline-block-editor {
  width: 100%;
  min-height: 44px;
  overflow: hidden;
  border-top: 1px solid var(--vp-c-brand-1);
  border-bottom: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-bg);
}

.cm-inline-block-editor :deep(.cm-editor) {
  color: var(--vp-c-text-1);
}
</style>
