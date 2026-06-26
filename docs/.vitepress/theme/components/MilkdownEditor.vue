<script setup lang="ts" name="MilkdownEditor">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { Crepe } from '@milkdown/crepe'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorRef = ref<HTMLDivElement>()
let crepe: Crepe | null = null
let initFailed = false

onMounted(async () => {
  try {
    const { Crepe: CrepeClass } = await import('@milkdown/crepe')
    await import('@milkdown/crepe/lib/theme/crepe/style.css')
    await import('@milkdown/crepe/lib/theme/common/style.css')

    if (!editorRef.value) return

    crepe = new CrepeClass({
      root: editorRef.value,
      defaultValue: props.modelValue
    })

    await crepe.create()

    crepe.on(listener => {
      listener.markdownUpdated((_, md) => {
        emit('update:modelValue', md)
      })
    })
  } catch (e) {
    console.error('Milkdown init failed:', e)
    initFailed = true
  }
})

onBeforeUnmount(async () => {
  if (crepe) {
    await crepe.destroy()
    crepe = null
  }
})
</script>

<template>
  <div class="milkdown-container">
    <div v-if="!initFailed" ref="editorRef" class="milkdown-editor" />
    <textarea
      v-else
      class="fallback-editor"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style scoped>
.milkdown-container {
  min-height: 300px;
}

.milkdown-editor {
  --crepe-color-primary: var(--vp-c-brand);
  --crepe-color-background: var(--vp-c-bg);
  --crepe-color-surface: var(--vp-c-bg-soft);
  --crepe-color-on-background: var(--vp-c-text-1);
  --crepe-color-on-surface: var(--vp-c-text-2);
  --crepe-color-outline: var(--vp-c-divider);
}

.fallback-editor {
  width: 100%;
  min-height: 400px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  box-sizing: border-box;
  outline: none;
}

.fallback-editor:focus {
  border-color: var(--vp-c-brand);
}

@media (max-width: 767px) {
  .milkdown-container {
    min-height: 200px;
  }
}
</style>
