import { ref } from 'vue'

const editRequested = ref(false)
const readModeRequest = ref(0)

export function useEditorEntry() {
  function requestEdit(): void {
    editRequested.value = true
  }

  function clearEditRequest(): void {
    editRequested.value = false
  }

  function requestReadMode(): void {
    readModeRequest.value += 1
  }

  return {
    editRequested,
    readModeRequest,
    requestEdit,
    clearEditRequest,
    requestReadMode,
  }
}
