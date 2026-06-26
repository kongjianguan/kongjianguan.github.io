<script setup lang="ts" name="CodeMirrorEditor">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
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
const previewRef = ref<HTMLDivElement>()
const showPreview = ref(false)
let view: EditorView | null = null

const previewHtml = computed(() => md.render(props.modelValue))

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

function togglePreview() {
  showPreview.value = !showPreview.value
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

defineExpose({ togglePreview })
</script>

<template>
  <div class="cm-editor-container">
    <div class="editor-mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: !showPreview }"
        @click="showPreview = false"
      >
        编辑
      </button>
      <button
        class="mode-tab"
        :class="{ active: showPreview }"
        @click="showPreview = true"
      >
        预览
      </button>
    </div>

    <div v-show="!showPreview" ref="editorRef" class="cm-editor-area" />

    <div
      v-show="showPreview"
      ref="previewRef"
      class="preview-area"
      v-html="previewHtml"
    />
  </div>
</template>

<style scoped>
.cm-editor-container {
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.editor-mode-tabs {
  display: flex;
  border-bottom: 1px solid var(--vp-c-divider);
}

.mode-tab {
  padding: 4px 14px;
  border: none;
  background: none;
  color: var(--vp-c-text-3);
  cursor: pointer;
  font-size: 12px;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
}

.mode-tab:hover {
  color: var(--vp-c-text-1);
}

.mode-tab.active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand);
}

.cm-editor-area {
  flex: 1;
}

.preview-area {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
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

.preview-area {
  line-height: 1.7;
  color: var(--vp-c-text-1);
}

.preview-area :deep(h1) {
  font-size: 1.6em;
  margin: 0.5em 0 0.3em;
}

.preview-area :deep(h2) {
  font-size: 1.3em;
  margin: 0.4em 0 0.2em;
}

.preview-area :deep(p) {
  margin: 0 0 0.8em;
  color: var(--vp-c-text-2);
}

.preview-area :deep(code) {
  background: var(--vp-c-bg-soft);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.9em;
}

.preview-area :deep(pre) {
  background: var(--vp-c-bg-soft);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.preview-area :deep(blockquote) {
  margin: 0 0 0.8em;
  padding-left: 12px;
  border-left: 3px solid var(--vp-c-brand);
  color: var(--vp-c-text-2);
}

.preview-area :deep(ul),
.preview-area :deep(ol) {
  padding-left: 1.5em;
  color: var(--vp-c-text-2);
}

.preview-area :deep(a) {
  color: var(--vp-c-brand);
}

@media (max-width: 767px) {
  .cm-editor-container {
    min-height: 200px;
  }
}
</style>
