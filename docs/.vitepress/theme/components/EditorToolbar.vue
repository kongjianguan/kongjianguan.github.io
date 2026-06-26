<script setup lang="ts" name="EditorToolbar">
defineProps<{
  filePath: string
  title: string
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
    <div class="toolbar-left">
      <span v-if="title" class="toolbar-title">{{ title }}</span>
      <span class="toolbar-path">{{ filePath || '(新建文件)' }}</span>
    </div>

    <span v-if="!isLoggedIn" class="toolbar-status no-auth">需要登录</span>
    <span v-else-if="isSaving" class="toolbar-status saving">提交中...</span>
    <span v-else-if="isDirty" class="toolbar-status dirty">未保存</span>

    <div class="toolbar-actions">
      <button class="tb-btn" :disabled="!isLoggedIn || !isDirty" @click="emit('saveDraft')">
        保存草稿
      </button>
      <button class="tb-btn tb-btn-primary" :disabled="!isLoggedIn || isSaving" @click="emit('commit')">
        提交
      </button>
      <button class="tb-btn" @click="emit('togglePreview')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="2"/>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        </svg>
      </button>
      <button class="tb-btn" @click="emit('exitEdit')">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        退出
      </button>
    </div>
  </div>
</template>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  flex-wrap: wrap;
}

.toolbar-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
}

.toolbar-path {
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-status {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.toolbar-status.dirty { color: var(--vp-c-yellow-1); }
.toolbar-status.saving { color: var(--vp-c-brand-1); }
.toolbar-status.no-auth { color: var(--vp-c-text-3); }

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tb-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 12px;
  line-height: 20px;
  transition: color 0.15s, background 0.15s;
}

.tb-btn:hover:not(:disabled) {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.tb-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.tb-btn-primary {
  color: var(--vp-c-brand-1);
}

.tb-btn-primary:hover:not(:disabled) {
  color: var(--vp-c-brand-2);
  background: var(--vp-c-brand-soft);
}

@media (max-width: 767px) {
  .toolbar-title { display: none; }
  .toolbar-status { display: none; }
}
</style>
