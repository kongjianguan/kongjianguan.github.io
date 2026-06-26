<script setup lang="ts" name="LoginButton">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useGitHubAuth } from '../composables/useGitHubAuth'

const { isLoggedIn, user, login, logout } = useGitHubAuth()
const menuOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function handleLogout() {
  menuOpen.value = false
  logout()
}

function handleClickOutside(e: MouseEvent) {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="login-btn-wrapper" ref="wrapperRef">
    <template v-if="isLoggedIn && user">
      <button
        class="login-btn logged-in"
        :title="user.login"
        @click="toggleMenu"
      >
        <img :src="user.avatar_url" :alt="user.login" class="avatar" />
        <span class="username">{{ user.login }}</span>
      </button>
      <Transition name="user-menu">
        <div v-if="menuOpen" class="user-menu">
          <button class="user-menu-item" @click="handleLogout">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            退出登录
          </button>
        </div>
      </Transition>
    </template>
    <button
      v-else
      class="login-btn login-prompt"
      @click="login"
    >
      <svg class="gh-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      登录
    </button>
  </div>
</template>

<style scoped>
.login-btn-wrapper {
  display: flex;
  align-items: center;
  position: relative;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  line-height: var(--vp-nav-height);
  font-size: 14px;
  font-weight: 500;
  border: none;
  background: none;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: color 0.25s;
}

.login-btn:hover {
  color: var(--vp-c-brand-1);
}

.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.gh-icon {
  flex-shrink: 0;
}

.user-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 120px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 4px;
  z-index: 100;
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  border-radius: 4px;
  font-size: 13px;
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: background 0.2s;
}

.user-menu-item:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-brand-1);
}

.user-menu-enter-active,
.user-menu-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.user-menu-enter-from,
.user-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
