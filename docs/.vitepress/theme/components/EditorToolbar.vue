<script setup lang="ts" name="EditorToolbar">
defineProps<{
  filePath: string
  isDirty: boolean
  isSaving: boolean
  isLoggedIn: boolean
  isNewFile: boolean
}>()

const emit = defineEmits<{
  saveDraft: []
  commit: []
  exitEdit: []
  togglePreview: []
}>()
</script>

<template>
  <div class="editor-toolbar">
    <span class="toolbar-path">{{ filePath || '(新建文件)' }}</span>

    <span v-if="!isLoggedIn" class="toolbar-status no-auth">需要登录</span>
    <span v-else-if="isSaving" class="toolbar-status saving">提交中...</span>
    <span v-else-if="isDirty" class="toolbar-status dirty">未保存</span>
    <span v-else class="toolbar-status clean">已保存</span>

    <div class="toolbar-actions">
      <button
        class="tb-btn"
        :disabled="!isLoggedIn || !isDirty"
        title="保存草稿"
        @click="emit('saveDraft')"
      >
        <span class="tb-btn-label">保存草稿</span>
        <svg class="tb-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      </button>

      <button
        class="tb-btn tb-btn-primary"
        :disabled="!isLoggedIn || isSaving"
        title="提交到 GitHub"
        @click="emit('commit')"
      >
        <span class="tb-btn-label">提交</span>
        <svg class="tb-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="16 3 21 3 21 8"/>
          <line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 13 21 19 5 21 3 5 9 3"/>
        </svg>
      </button>

      <button
        class="tb-btn"
        title="切换预览"
        @click="emit('togglePreview')"
      >
        <svg class="tb-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="2"/>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        </svg>
      </button>

      <button class="tb-btn tb-btn-danger" title="退出编辑" @click="emit('exitEdit')">
        <svg class="tb-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
}

.toolbar-path {
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-family: monospace;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-status {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.toolbar-status.clean { color: var(--vp-c-green); background: var(--vp-c-green-soft); }
.toolbar-status.dirty { color: var(--vp-c-yellow); background: var(--vp-c-yellow-soft); }
.toolbar-status.saving { color: var(--vp-c-brand); background: var(--vp-c-brand-soft); }
.toolbar-status.no-auth { color: var(--vp-c-text-3); background: var(--vp-c-bg-mute); }

.toolbar-actions {
  display: flex;
  gap: 4px;
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.tb-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.tb-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tb-btn-primary {
  background: var(--vp-c-brand);
  color: #fff;
  border-color: var(--vp-c-brand);
}

.tb-btn-primary:hover:not(:disabled) {
  background: var(--vp-c-brand-dark);
}

.tb-btn-danger:hover:not(:disabled) {
  color: var(--vp-c-red);
  border-color: var(--vp-c-red);
}

@media (max-width: 767px) {
  .toolbar-path { display: none; }
  .tb-btn { padding: 6px; }
  .tb-btn-label { display: none; }
  .tb-btn-icon { width: 18px; height: 18px; }
}
</style>
