<script setup lang="ts" name="NewArticleDialog">
import { ref, watch } from 'vue'
import { stringify as stringifyYaml } from 'yaml'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  create: [payload: { path: string; title: string; template: string }]
}>()

const title = ref('')
const directory = ref('随笔')
const slug = ref('')

const directories = ['programming', 'Software', 'Life', '历程', '随笔']
const directoryCategories: Record<string, string> = {
  programming: '编程',
  Software: '软件',
  Life: '生活',
  历程: '历程',
  随笔: '随笔',
}

function titleToSlug(t: string): string {
  if (!t) return ''
  return t
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'untitled'
}

watch(title, (t) => { slug.value = titleToSlug(t) })

watch(() => props.visible, (visible) => {
  if (!visible) {
    title.value = ''
    slug.value = ''
    directory.value = '随笔'
  }
})

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

function handleCreate() {
  if (!title.value.trim() || !slug.value.trim()) return
  const path = `${directory.value}/${slug.value}.md`
  const dateStr = formatLocalDateTime(new Date())

  const frontmatter = stringifyYaml({
    title: title.value,
    date: dateStr,
    categories: [directoryCategories[directory.value] || directory.value],
    tags: [],
    description: '',
  }, { lineWidth: 0 }).trimEnd()
  const template = `---\n${frontmatter}\n---\n\n`
  emit('create', { path, title: title.value, template })
  emit('update:visible', false)
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="handleCancel">
      <div class="dialog-content">
        <h3 class="dialog-title">新建文章</h3>

        <div class="field">
          <label class="field-label">标题</label>
          <input v-model="title" class="field-input" placeholder="文章标题" />
        </div>

        <div class="field">
          <label class="field-label">目录</label>
          <select v-model="directory" class="field-select">
            <option v-for="d in directories" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>

        <div class="field">
          <label class="field-label">文件路径 (自动生成)</label>
          <div class="slug-preview">{{ directory }}/{{ slug || '...' }}.md</div>
        </div>

        <div class="dialog-footer">
          <button class="btn-cancel" @click="handleCancel">取消</button>
          <button class="btn-confirm" @click="handleCreate" :disabled="!title.trim()">创建</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
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
  max-width: 400px;
}

.dialog-title { margin: 0 0 16px; font-size: 16px; font-weight: 600; color: var(--vp-c-text-1); }

.field { margin-bottom: 12px; }
.field-label { display: block; font-size: 12px; color: var(--vp-c-text-3); margin-bottom: 4px; }

.field-input, .field-select {
  width: 100%; padding: 6px 10px;
  border: 1px solid var(--vp-c-divider); border-radius: 4px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  font-size: 13px; outline: none; box-sizing: border-box;
}
.field-input:focus, .field-select:focus { border-color: var(--vp-c-brand); }

.slug-preview {
  padding: 6px 10px; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider);
  border-radius: 4px; font-size: 12px; font-family: monospace; color: var(--vp-c-text-2);
}

.dialog-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

.btn-cancel, .btn-confirm {
  padding: 6px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;
  border: 1px solid var(--vp-c-divider);
}
.btn-cancel { background: var(--vp-c-bg); color: var(--vp-c-text-2); }
.btn-confirm { background: var(--vp-c-brand); color: #fff; border-color: var(--vp-c-brand); }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

@media (max-width: 767px) {
  .dialog-content { max-width: none; width: calc(100% - 32px); }
}
</style>
