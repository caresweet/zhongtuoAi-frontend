import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

const TOKEN_KEY = 'zhongtuo_token'
const USER_KEY = 'zhongtuo_user'

export const useAuthStore = defineStore('auth', () => {
  // ── State ──────────────────────────────────────────────────────────────
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const user = ref(JSON.parse(localStorage.getItem(USER_KEY) || 'null'))

  // ── Getters ────────────────────────────────────────────────────────────
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.is_superuser)
  const displayName = computed(() => user.value?.display_name || user.value?.username || '')

  // ── Actions ────────────────────────────────────────────────────────────
  function setAuth(accessToken, userInfo) {
    token.value = accessToken
    user.value = userInfo
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
  }

  function clearAuth() {
    token.value = ''
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async function login(username, password) {
    const { data } = await axios.post('/api/v1/auth/login', { username, password })
    const payload = data.data
    setAuth(payload.access_token, payload.user)
    return payload.user
  }

  async function register(username, password, email, displayName) {
    const { data } = await axios.post('/api/v1/auth/register', {
      username,
      password,
      email: email || null,
      display_name: displayName || username,
    })
    const payload = data.data
    setAuth(payload.access_token, payload.user)
    return payload.user
  }

  function logout() {
    clearAuth()
  }

  return {
    token, user, isLoggedIn, isAdmin, displayName,
    login, register, logout, clearAuth,
  }
})
