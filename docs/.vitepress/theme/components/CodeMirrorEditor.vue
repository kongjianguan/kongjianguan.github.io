<script setup lang="ts" name="CodeMirrorEditor">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorView } from '@codemirror/view'

const props = withDefaults(defineProps<{
  modelValue: string
  initialSelection?: number
  stageImage?: (file: File) => Promise<string | null>
}>(), {
  initialSelection: 0,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  navigate: [direction: 'previous' | 'next']
  escape: []
  'image-error': [message: string]
}>()

const editorRef = ref<HTMLDivElement>()
const uploadingImage = ref(false)
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

function getClipboardImage(event: ClipboardEvent): File | null {
  const files = Array.from(event.clipboardData?.files || [])
  const directFile = files.find(file => file.type.startsWith('image/'))
  if (directFile) return directFile

  for (const item of Array.from(event.clipboardData?.items || [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }

  return null
}

function getImageAlt(file: File): string {
  const name = file.name.replace(/\.[^.]+$/, '').trim().replace(/[\[\]]/g, '')
  return name || '图片'
}

async function stageAndInsertImage(editor: EditorView, file: File): Promise<void> {
  if (!props.stageImage || uploadingImage.value) return

  const selection = editor.state.selection.main
  uploadingImage.value = true
  try {
    const url = await props.stageImage(file)
    if (!url) throw new Error('图片上传失败')
    if (view !== editor) return

    const insert = `![${getImageAlt(file)}](${url})`
    const from = Math.min(selection.from, editor.state.doc.length)
    const to = Math.min(selection.to, editor.state.doc.length)
    editor.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
    })
  } catch (error) {
    emit('image-error', error instanceof Error ? error.message : '图片上传失败')
  } finally {
    uploadingImage.value = false
  }
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
    paste: (event, editor) => {
      const file = getClipboardImage(event)
      if (!file || !props.stageImage || uploadingImage.value) return false
      event.preventDefault()
      void stageAndInsertImage(editor, file)
      return true
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
  <div ref="editorRef" class="cm-inline-block-editor" :class="{ 'is-uploading-image': uploadingImage }">
    <span v-if="uploadingImage" class="image-upload-status" role="status">图片准备中...</span>
  </div>
</template>

<style scoped>
.cm-inline-block-editor {
  position: relative;
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

.image-upload-status {
  position: absolute;
  top: 6px;
  right: 8px;
  z-index: 1;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 11px;
  pointer-events: none;
}
</style>
