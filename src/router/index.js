import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'

const routes = [
  // 根路径 = 登录入口（对外门户页挪到 /portal，需要时再访问）
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/portal',
    name: 'Portal',
    component: () => import('@/views/Portal.vue'),
    meta: { title: '众拓AI · 社会稳定风险评估智能平台', public: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/app',
    component: () => import('@/components/layout/AppLayout.vue'),
    redirect: '/app/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据总览', icon: 'DataAnalysis' },
      },
      {
        path: 'knowledge',
        name: 'KnowledgeBase',
        component: () => import('@/views/KnowledgeBase.vue'),
        // 🔴 内部人员可见（管理员 或 挂内部公司的同事）—— 与后端 main.py 的
        //    ADMIN_ROUTERS（`require_staff`）**逐条对齐**，
        //    否则用户会看到菜单点进去 403。
        meta: { title: '知识库', icon: 'Document', requiresStaff: true },
      },
      {
        path: 'assistant',
        name: 'Assistant',
        component: () => import('@/views/AssistantView.vue'),
        meta: { title: '报告智能助手', icon: 'MagicStick' },
      },
      {
        path: 'knowledge-chat',
        name: 'KnowledgeChat',
        component: () => import('@/views/KnowledgeChat.vue'),
        meta: { title: '知识问答', icon: 'ChatDotSquare', requiresStaff: true },
      },
      {
        path: 'company',
        name: 'CompanyProfile',
        component: () => import('@/views/CompanyProfile.vue'),
        meta: { title: '公司信息', icon: 'OfficeBuilding' },
      },
      {
        path: 'admin/users',
        name: 'AdminUsers',
        component: () => import('@/views/AdminUsers.vue'),
        meta: { title: '账号管理', icon: 'UserFilled', requiresStaff: true },
      },
      // Legacy redirects: old URLs → new assistant
      {
        path: 'new-report',
        redirect: '/app/assistant',
      },
      {
        path: 'history',
        name: 'HistoryReports',
        component: () => import('@/views/HistoryReports.vue'),
        meta: { title: '历史报告', icon: 'Clock' },
      },
      {
        path: 'cleaning-workbench',
        name: 'CleaningWorkbench',
        component: () => import('@/views/CleaningWorkbench.vue'),
        meta: { title: '清洗工作台', icon: 'Brush', requiresStaff: true },
      },
      {
        path: 'ocr-review',
        name: 'OcrReview',
        component: () => import('@/views/OcrReview.vue'),
        meta: { title: '问卷校对', icon: 'EditPen', requiresStaff: true },
      },
      {
        path: 'check-rules',
        name: 'ValidationCenter',
        component: () => import('@/views/ValidationCenter.vue'),
        meta: { title: '校验中心', icon: 'SetUp', requiresStaff: true },
      },
      {
        path: 'approval',
        name: 'ApprovalIntake',
        component: () => import('@/views/ApprovalIntake.vue'),
        meta: { title: '审批回灌', icon: 'Checked', requiresStaff: true },
      },
    ],
  },
  // 旧路径兼容 → 工作台
  { path: '/dashboard', redirect: '/app/dashboard' },
  { path: '/knowledge', redirect: '/app/knowledge' },
  { path: '/knowledge-chat', redirect: '/app/knowledge-chat' },
  { path: '/assistant', redirect: '/app/assistant' },
  { path: '/history', redirect: '/app/history' },
  { path: '/cleaning-workbench', redirect: '/app/cleaning-workbench' },
  { path: '/ocr-review', redirect: '/app/ocr-review' },
  { path: '/check-rules', redirect: '/app/check-rules' },
  { path: '/approval', redirect: '/app/approval' },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── Auth Guard ────────────────────────────────────────────────────────────
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('zhongtuo_token')
  const needAuth = to.matched.some(r => r.meta.requiresAuth)

  if (needAuth && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  if (to.name === 'Login' && token) {
    next({ path: '/app/dashboard' })
    return
  }

  // 🔴 内部工具守卫。读的是 **localStorage** 而不是 Pinia：
  //    刷新页面时 Pinia 可能还没水合，用 store 会误判成「不是内部人员」。
  const needStaff = to.matched.some(r => r.meta.requiresStaff)
  if (needStaff) {
    let isStaff = false
    try {
      const u = JSON.parse(localStorage.getItem('zhongtuo_user') || 'null')
      // 与后端 `deps.require_staff` 同口径：管理员 **或** 挂内部公司的同事
      isStaff = !!(u && (u.role === 'admin' || u.is_superuser || u.company_is_internal))
    } catch { /* 坏数据按非内部人员处理 */ }
    if (!isStaff) {
      ElMessage.warning('该功能仅内部人员可用')
      next({ path: '/app/dashboard' })
      return
    }
  }
  next()
})

export default router
