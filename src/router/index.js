import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '数据展示', icon: 'DataAnalysis' },
      },
      {
        path: 'knowledge',
        name: 'KnowledgeBase',
        component: () => import('@/views/KnowledgeBase.vue'),
        meta: { title: '知识库', icon: 'Document' },
      },
      {
        path: 'assistant',
        name: 'Assistant',
        component: () => import('@/views/AssistantView.vue'),
        meta: { title: '智能助手', icon: 'ChatDotRound' },
      },
      {
        path: 'knowledge-chat',
        name: 'KnowledgeChat',
        component: () => import('@/views/KnowledgeChat.vue'),
        meta: { title: '知识问答', icon: 'ChatDotSquare' },
      },
      // Legacy redirects: old URLs → new assistant
      {
        path: 'new-report',
        redirect: '/assistant',
      },
      {
        path: 'step-wizard',
        redirect: '/assistant',
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
        meta: { title: '清洗工作台', icon: 'Brush' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ── Auth Guard ────────────────────────────────────────────────────────────
router.beforeEach((to, from, next) => {
  // Check for stored token
  const token = localStorage.getItem('zhongtuo_token')

  if (to.meta.requiresAuth && !token) {
    // Not logged in — redirect to login
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.name === 'Login' && token) {
    // Already logged in — go to dashboard
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
