<script setup lang="ts" name="LoginButton">
import { useGitHubAuth } from '../composables/useGitHubAuth'

const { isLoggedIn, user, login, logout } = useGitHubAuth()
</script>

<template>
  <div class="login-btn-wrapper">
    <button
      v-if="isLoggedIn && user"
      class="login-btn logged-in"
      title="点击退出登录"
      @click="logout"
    >
      <img :src="user.avatar_url" :alt="user.login" class="avatar" />
      <span class="username">{{ user.login }}</span>
    </button>
    <button
      v-else
      class="login-btn login-prompt"
      @click="login"
    >
      <svg class="gh-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      Login with GitHub
    </button>
  </div>
</template>

<style scoped>
.login-btn-wrapper {
  display: flex;
  align-items: center;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.login-btn:hover {
  background: var(--vp-c-bg-mute);
}

.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}

.gh-icon {
  flex-shrink: 0;
}
</style>
