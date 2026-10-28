<template>
  <div class="login-page">
    <!-- 品牌区 -->
    <div class="login-brand">
      <div class="brand-glow glow-1"></div>
      <div class="brand-glow glow-2"></div>
      <div class="brand-inner">
        <div class="brand-logo">
          <el-icon :size="26"><Files /></el-icon>
        </div>
        <div class="brand-title">众拓AI报告系统</div>
        <div class="brand-sub">社会稳定风险评估 · 智能生成平台</div>

        <div class="brand-points">
          <div class="point"><el-icon><CircleCheckFilled /></el-icon><span>AI 智能生成 10 章标准稳评报告</span></div>
          <div class="point"><el-icon><CircleCheckFilled /></el-icon><span>知识库问答 · 报告审核 · 全流程智能辅助</span></div>
          <div class="point"><el-icon><CircleCheckFilled /></el-icon><span>符合 DB32/T4013 规范 · 专业可靠</span></div>
        </div>

        <div class="brand-foot">江苏众拓项目代理咨询有限公司 · 专业服务</div>
      </div>
    </div>

    <!-- 表单区 -->
    <div class="login-panel">
      <div class="login-card">
        <div class="login-head">
          <h2>欢迎回来 👋</h2>
          <p>登录你的账号，开始生成专业报告</p>
        </div>

        <el-tabs v-model="activeTab" class="login-tabs" stretch>
          <el-tab-pane label="账号登录" name="login">
            <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" label-position="top" @submit.prevent="handleLogin">
              <el-form-item label="用户名" prop="username">
                <el-input v-model="loginForm.username" placeholder="请输入用户名" prefix-icon="User" size="large" />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" prefix-icon="Lock" size="large" show-password @keyup.enter="handleLogin" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleLogin">
                  {{ loading ? '登录中…' : '登 录' }}
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="注册账号" name="register" v-if="allowRegistration">
            <el-form ref="registerFormRef" :model="registerForm" :rules="registerRules" label-position="top" @submit.prevent="handleRegister">
              <el-form-item label="用户名" prop="username">
                <el-input v-model="registerForm.username" placeholder="2-50 个字符" prefix-icon="User" size="large" />
              </el-form-item>
              <el-form-item label="显示名称" prop="displayName">
                <el-input v-model="registerForm.displayName" placeholder="可选，默认用户名" prefix-icon="Edit" size="large" />
              </el-form-item>
              <el-form-item label="邮箱" prop="email">
                <el-input v-model="registerForm.email" placeholder="可选" prefix-icon="Message" size="large" />
              </el-form-item>
              <el-form-item label="密码" prop="password">
                <el-input v-model="registerForm.password" type="password" placeholder="至少 6 个字符" prefix-icon="Lock" size="large" show-password />
              </el-form-item>
              <el-form-item label="确认密码" prop="confirmPassword">
                <el-input v-model="registerForm.confirmPassword" type="password" placeholder="请再次输入密码" prefix-icon="Lock" size="large" show-password @keyup.enter="handleRegister" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" size="large" :loading="loading" class="login-btn" @click="handleRegister">
                  {{ loading ? '注册中…' : '注 册' }}
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Files, CircleCheckFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref('login')
const loading = ref(false)
const allowRegistration = ref(true)

const loginFormRef = ref(null)
const loginForm = reactive({ username: '', password: '' })
const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  const valid = await loginFormRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await authStore.login(loginForm.username, loginForm.password)
    ElMessage.success('登录成功')
    router.push('/app/dashboard')
  } catch (e) {
    ElMessage.error(e.response?.data?.detail || e.message || '登录失败')
  } finally { loading.value = false }
}

const registerFormRef = ref(null)
const registerForm = reactive({ username: '', displayName: '', email: '', password: '', confirmPassword: '' })

const validateConfirmPassword = (_rule, value, callback) => {
  if (value !== registerForm.password) callback(new Error('两次输入的密码不一致'))
  else callback()
}
const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 50, message: '用户名长度需要 2-50 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

async function handleRegister() {
  const valid = await registerFormRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const res = await authStore.register(registerForm.username, registerForm.password, registerForm.email || null, registerForm.displayName || null)
    // 🔴 注册 = 提交申请。账号是「待审核」，此时**没有登录态**，
    //    所以只能回登录页等管理员开通 —— 不要再 router.push 到工作台。
    ElMessage.success(res?.message || '注册成功，请等待管理员审核开通后登录')
    activeTab.value = 'login'
    loginForm.username = registerForm.username
  } catch (e) {
    if (e.response?.status === 403) allowRegistration.value = false
    ElMessage.error(e.response?.data?.detail || e.message || '注册失败')
  } finally { loading.value = false }
}
</script>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  min-height: 100vh;
  background: #fff;
}
@media (max-width: 920px) { .login-page { grid-template-columns: 1fr } .login-brand { display: none } }

/* ── 品牌区 ── */
.login-brand {
  position: relative;
  overflow: hidden;
  background: linear-gradient(150deg, #0b1638 0%, #13255c 55%, #1d3b8f 100%);
  color: #fff;
  display: flex; align-items: center;
  padding: 60px;
}
.brand-glow { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .5; }
.glow-1 { width: 380px; height: 380px; background: #2e5bff; top: -120px; right: -90px; }
.glow-2 { width: 300px; height: 300px; background: #7a3cff; bottom: -100px; left: -60px; }
.brand-inner { position: relative; z-index: 2; max-width: 460px; }
.brand-logo {
  width: 60px; height: 60px; border-radius: 16px;
  background: linear-gradient(135deg, #2e5bff, #7a3cff);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 28px rgba(46,91,255,.5);
  margin-bottom: 26px;
}
.brand-title { font-size: 34px; font-weight: 800; letter-spacing: 1px; }
.brand-sub { font-size: 15px; color: #a9bcf0; margin-top: 12px; letter-spacing: 1px; }
.brand-points { margin-top: 46px; display: flex; flex-direction: column; gap: 18px; }
.point { display: flex; align-items: center; gap: 12px; font-size: 15px; color: #dfe7ff; }
.point .el-icon { color: #35e0a8; font-size: 20px; }
.brand-foot { position: absolute; bottom: 34px; left: 60px; font-size: 12.5px; color: #7d90c8 }

/* ── 表单区 ── */
.login-panel { display: flex; align-items: center; justify-content: center; padding: 40px; background: linear-gradient(160deg, #f6f8fe, #fff 60%); }
.login-card { width: 400px; max-width: 100%; }
.login-head h2 { font-size: 26px; margin: 0 0 6px; color: var(--app-text-main); }
.login-head p { font-size: 13.5px; color: var(--app-text-sub); margin: 0 0 26px; }
.login-btn { width: 100%; height: 44px; font-size: 15px; letter-spacing: 4px; border-radius: 10px; }
.login-tabs :deep(.el-tabs__nav-wrap) { margin-bottom: 14px; }
.login-card :deep(.el-input__wrapper) { border-radius: 10px; padding: 4px 12px; }
.login-card :deep(.el-form-item__label) { font-weight: 600; color: var(--app-text-main); }
</style>
