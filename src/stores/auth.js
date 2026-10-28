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
  // 🔴 「内部人员」= 管理员 **或** 挂内部公司的同事。
  //    与后端 `deps.require_staff` 同口径 —— 对不上就会出现
  //    「菜单点进去 403」或「明明能用却藏起来」。
  //    `company_is_internal` 由后端在登录/`/me` 时给出。
  const isStaff = computed(() => isAdmin.value || !!user.value?.company_is_internal)
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
    // 🔴 注册**不再自动登录**：自助注册出来的账号是「待审核」状态
    //    （后端写 is_active=False 且不签发 token），要等管理员在后台开通。
    //    这里只把后端的话原样返回，由页面提示用户。
    const { data } = await axios.post('/api/v1/auth/register', {
      username,
      password,
      email: email || null,
      display_name: displayName || username,
    })
    return data
  }

  function logout() {
    clearAuth()
  }

  return {
    token, user, isLoggedIn, isAdmin, isStaff, displayName,
    login, register, logout, clearAuth,
  }
})
