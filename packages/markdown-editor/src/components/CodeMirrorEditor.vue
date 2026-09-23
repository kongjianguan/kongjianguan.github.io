<script setup lang="ts" name="CodeMirrorEditor">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder as placeholderExt } from '@codemirror/view'
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown'
import { livePreview } from '../livePreview/plugin'
import { mathExtension } from '../livePreview/math'
import { editorHighlighting, editorTheme } from '../livePreview/theme'

const props = withDefaults(defineProps<{
  modelValue: string
  initialSelection?: number
  stageImage?: (file: File) => Promise<string | null>
  onImageError?: (message: string) => void
  onSave?: () => void
  placeholderText?: string
  readOnly?: boolean
}>(), {
  initialSelection: 0,
  placeholderText: '',
  readOnly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'image-error': [message: string]
}>()

const editorRef = ref<HTMLDivElement>()
const readOnlyCompartment = new Compartment()
let view: EditorView | null = null
let applyingExternal = false

function reportImageError(message: string): void {
  if (props.onImageError) props.onImageError(message)
  else emit('image-error', message)
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

async function insertStagedImage(editor: EditorView, file: File): Promise<void> {
  if (!props.stageImage) return

  const selection = editor.state.selection.main
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
    reportImageError(error instanceof Error ? error.message : '图片上传失败')
  }
}

function buildExtensions(readOnly: boolean): Extension[] {
  return [
    history(),
    markdown({
      base: markdownLanguage,
      // 公式语法必须由解析器本身识别，否则 $f[u]$ 会被当成链接并隐藏方括号。
      extensions: [mathExtension],
      addKeymap: false,
    }),
    // 回车延续列表与引用，标题行回车则另起一行。
    keymap.of(markdownKeymap),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
      {
        key: 'Mod-s',
        preventDefault: true,
        run: () => {
          props.onSave?.()
          return true
        },
      },
      {
        key: 'Escape',
        run: (editor) => {
          editor.contentDOM.blur()
          return true
        },
      },
    ]),
    EditorView.lineWrapping,
    livePreview(),
    editorTheme,
    editorHighlighting(),
    props.placeholderText ? placeholderExt(props.placeholderText) : [],
    readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || applyingExternal) return
      emit('update:modelValue', update.state.doc.toString())
    }),
    EditorView.domEventHandlers({
      paste: (event, editor) => {
        const file = getClipboardImage(event)
        if (!file || !props.stageImage) return false
        event.preventDefault()
        void insertStagedImage(editor, file)
        return true
      },
    }),
  ]
}

function createEditor(): void {
  if (!editorRef.value) return

  const selection = Math.max(0, Math.min(props.initialSelection, props.modelValue.length))
  view = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      selection: { anchor: selection },
      extensions: buildExtensions(false),
    }),
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

/*
 * 外部内容变化（切换文章、公式面板回填等）时整体替换文档。
 * 编辑器内部输入引起的变化会被比对过滤，避免重复派发。
 */
watch(
  () => props.modelValue,
  (value) => {
    if (!view || value === view.state.doc.toString()) return
    applyingExternal = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
    applyingExternal = false
  },
)

watch(
  () => props.readOnly,
  (readOnly) => {
    view?.dispatch({ effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)) })
  },
)

defineExpose({
  focus: () => view?.focus(),
  getView: () => view,
})
</script>

<template>
  <div ref="editorRef" class="mde-live-editor" />
</template>

<style scoped>
.mde-live-editor {
  width: 100%;
}

.mde-live-editor :deep(.cm-editor) {
  background: var(--mde-bg);
}
</style>
