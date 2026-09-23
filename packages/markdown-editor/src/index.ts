import './style.css'

/*
 * 只导出装配入口与不依赖 CodeMirror 的部件。
 * CodeMirrorEditor 由 MarkdownEditor 内部按需加载，从这里再静态导出会让
 * 打包工具把它并入主分块，进入编辑模式前就下载编辑器全部代码。
 */
export { default as MarkdownEditor } from './components/MarkdownEditor.vue'
export { default as EditorToolbar } from './components/EditorToolbar.vue'
export { default as FrontmatterPanel } from './components/FrontmatterPanel.vue'
export { default as CommitDialog } from './components/CommitDialog.vue'

export { createEditSession } from './composables/useEditMode'
export { createDraftStore } from './composables/useDrafts'
export { createPendingImages } from './composables/usePendingImages'
export { createMemoryStorage } from './storage/memory'

export { livePreview, buildDecorations, parseImageSyntax } from './livePreview/plugin'
export { mathExtension } from './livePreview/math'
export { editorTheme, editorHighlighting, markdownHighlightStyle } from './livePreview/theme'
export { intersectsSelection, isVerbatimContext, REVEAL_MARGIN } from './livePreview/model'

export { assembleMarkdown, buildFrontmatter, parseFrontmatter } from './frontmatter'

export type { ParsedFrontmatter } from './frontmatter'
export type { EditSessionOptions } from './composables/useEditMode'
export type { PendingImageOptions } from './composables/usePendingImages'
export type { MemoryStorageOptions } from './storage/memory'
export type { MarkerRange } from './livePreview/model'
export type {
  DraftRecord,
  EditorCommitResult,
  EditorFile,
  EditorStorage,
} from './types'
