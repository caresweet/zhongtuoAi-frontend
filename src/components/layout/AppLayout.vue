<template>
  <div class="pl-shell">
    <!-- 顶部导航（产品/电商式，非后台管理） -->
    <header class="pl-top">
      <div class="pl-inner">
        <router-link class="pl-brand" to="/app/dashboard">
          <div class="pl-logo"><el-icon :size="20"><Files /></el-icon></div>
          <div>
            <div class="pl-name">众拓AI报告</div>
            <div class="pl-slogan">社会稳定风险评估平台</div>
          </div>
        </router-link>

        <nav class="pl-nav">
          <router-link v-for="n in navMain" :key="n.path" :to="n.path" class="pl-link" :class="{ on: isActive(n.path) }">{{ n.label }}</router-link>
          <!-- 普通账号没有「更多工具」（那些是内部工具，见 navMore 的注释） -->
          <el-dropdown v-if="navMore.length" trigger="hover" style="margin-left:6px">
            <span class="pl-link more-link">更多工具 <el-icon><ArrowDown /></el-icon></span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="n in navMore" :key="n.path" @click="$router.push(n.path)">{{ n.label }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </nav>

        <div class="pl-right">
          <span class="pl-live"><i></i>服务正常</span>
          <el-dropdown trigger="click" v-if="authStore.isLoggedIn">
            <div class="pl-user">
              <div class="pl-avatar">{{ avatarText }}</div>
              <span>{{ authStore.displayName }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>账号：{{ authStore.user?.username }}<el-tag v-if="authStore.isAdmin" size="small" type="danger" style="margin-left:6px">管理员</el-tag></el-dropdown-item>
                <el-dropdown-item divided @click="backPortal">返回门户页</el-dropdown-item>
                <el-dropdown-item @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <!-- 内容 -->
    <main class="pl-main">
      <div class="pl-content">
        <router-view />
      </div>
    </main>

    <!-- 悬浮智能客服 -->
    <CustomerServiceWidget />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Files, ArrowDown, SwitchButton } from '@element-plus/icons-vue'
import CustomerServiceWidget from '@/components/CustomerServiceWidget.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// 🔴 菜单必须与**后端 gating 逐条对齐**（main.py 的 USER_ROUTERS / ADMIN_ROUTERS）
//    —— 对不上就会出现「菜单点进去 403」或「功能藏起来了其实能用」。
//    「内部人员」= 管理员 **或** 挂内部公司的同事（与后端 `require_staff` 同口径）。
//    外部客户账号：只见自己的业务（报告助手/历史报告/公司信息）。
//    内部人员：另见知识库、问答、校对、校验、审批、清洗、账号管理。
const _navMainBase = [
  { label: '首页', path: '/app/dashboard' },
  { label: '报告助手', path: '/app/assistant' },
  { label: '历史报告', path: '/app/history' },
  { label: '公司信息', path: '/app/company' },
]
const _navMainAdmin = [
  { label: '知识问答', path: '/app/knowledge-chat' },
]
const _navMoreAdmin = [
  { label: '知识库管理', path: '/app/knowledge' },
  { label: '问卷校对', path: '/app/ocr-review' },
  { label: '校验中心', path: '/app/check-rules' },
  { label: '审批回灌', path: '/app/approval' },
  { label: '数据清洗工作台', path: '/app/cleaning-workbench' },
  { label: '账号管理', path: '/app/admin/users' },
]
const navMain = computed(() => authStore.isStaff ? [..._navMainBase, ..._navMainAdmin] : _navMainBase)
const navMore = computed(() => authStore.isStaff ? _navMoreAdmin : [])

const avatarText = computed(() => (authStore.displayName || '用').slice(0, 1))

function isActive(p) {
  if (p === '/app/dashboard') return route.path === '/app/dashboard' || route.path === '/app/'
  return route.path.startsWith(p)
}

function backPortal() { router.push('/portal') }

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
  } catch { return }
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.pl-shell { min-height: 100vh; display: flex; flex-direction: column; background: var(--app-bg-grad); font-family: var(--el-font-family) }

/* ── 顶部 ── */
.pl-top { position: sticky; top: 0; z-index: 60; background: rgba(255,255,255,.94); backdrop-filter: blur(10px); border-bottom: 1px solid #eef1f7 }
.pl-inner { max-width: 1280px; margin: 0 auto; padding: 10px 22px; display: flex; align-items: center; gap: 30px }
.pl-brand { display: flex; align-items: center; gap: 10px; text-decoration: none }
.pl-logo { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(135deg,#2e5bff,#6a3cff); color:#fff; display:flex; align-items:center; justify-content:center }
.pl-name { font-size: 17px; font-weight: 800; color:#18213a; line-height:1.1 }
.pl-slogan { font-size: 10px; color:#9aa3b8 }
.pl-nav { display: flex; align-items: center; gap: 4px; flex: 1 }
.pl-link { color:#3c4760; text-decoration:none; font-size:14.5px; padding: 8px 14px; border-radius: 10px; transition: all .15s }
.pl-link:hover { color:#2e5bff; background:#f2f5ff }
.pl-link.on { color:#2e5bff; font-weight:600; background:#eef2ff }
.more-link { cursor: pointer; display: inline-flex; align-items: center; gap:4px; font-size:13px; color:#6b7692 }
.pl-right { display: flex; align-items: center; gap: 18px }
.pl-live { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#6b7692 }
.pl-live i { width:8px; height:8px; border-radius:50%; background:#18b879; box-shadow:0 0 0 4px rgba(24,184,121,.15) }
.pl-user { display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 8px; border-radius:10px; color:#18213a; font-size:14px; font-weight:600 }
.pl-user:hover { background:#f2f5ff }
.pl-avatar { width:32px;height:32px;border-radius:50%; background:linear-gradient(135deg,#2e5bff,#5a3cff); color:#fff; display:flex; align-items:center; justify-content:center; font-size:14px }

/* ── 内容 ── */
.pl-main { flex:1; }
.pl-content { max-width: 1280px; margin: 0 auto; padding: 26px 22px 60px }
</style>
