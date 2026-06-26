<script setup lang="ts" name="CommitDialog">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  isNewFile: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [payload: { message: string }]
}>()

const message = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(() => props.visible, (v) => {
  if (v) {
    message.value = props.isNewFile ? 'feat: add new article' : 'docs: update article'
    setTimeout(() => inputRef.value?.focus(), 100)
  }
})

function handleConfirm() {
  if (!message.value.trim()) return
  emit('confirm', { message: message.value.trim() })
  emit('update:visible', false)
}

function handleCancel() {
  emit('update:visible', false)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleConfirm()
  }
  if (e.key === 'Escape') {
    handleCancel()
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog-content" @keydown="handleKeydown">
        <h3 class="dialog-title">提交到 GitHub</h3>
        <div class="dialog-body">
          <label class="field-label" for="commit-msg">Commit Message</label>
          <input
            id="commit-msg"
            ref="inputRef"
            v-model="message"
            type="text"
            class="commit-input"
            placeholder="输入提交信息..."
          />
          <p class="dialog-hint">提交后将触发 CI 自动部署</p>
        </div>
        <div class="dialog-footer">
          <button class="btn-cancel" @click="handleCancel">取消</button>
          <button class="btn-confirm" @click="handleConfirm" :disabled="!message.trim()">提交</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.dialog-content {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.dialog-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.dialog-body {
  margin-bottom: 20px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: var(--vp-c-text-2);
  margin-bottom: 6px;
}

.commit-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.commit-input:focus {
  border-color: var(--vp-c-brand);
}

.dialog-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--vp-c-divider);
}

.btn-cancel {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
}

.btn-confirm {
  background: var(--vp-c-brand);
  color: #fff;
  border-color: var(--vp-c-brand);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .dialog-overlay {
    align-items: flex-end;
  }

  .dialog-content {
    width: 100%;
    max-width: none;
    border-radius: 16px 16px 0 0;
    padding: 20px 16px 24px;
  }
}
</style>
