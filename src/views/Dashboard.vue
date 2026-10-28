<template>
  <div class="work-home">
    <!-- 欢迎横幅 -->
    <section class="wh-hero">
      <div class="hero-glow"></div>
      <div class="wh-hero-copy">
        <div class="wh-greet">你好，{{ authStore.displayName || '用户' }} 👋</div>
        <h2>今天想生成哪份稳评报告？</h2>
        <p>上传材料即可 AI 逐章生成 · 知识库范文驱动 · 合规自动体检</p>
        <div class="wh-cta">
          <router-link class="btn-primary" to="/app/assistant">＋ 新建报告</router-link>
          <router-link class="btn-ghost" to="/app/knowledge-chat">咨询小拓</router-link>
        </div>
      </div>
      <div class="wh-mini-stats">
        <div v-for="s in heroStats" :key="s.label" class="mini">
          <div class="mini-n">{{ s.value }}</div>
          <div class="mini-l">{{ s.label }}</div>
        </div>
      </div>
    </section>

    <!-- 服务快捷 -->
    <section class="wh-quick">
      <div v-for="q in quicks" :key="q.path" class="q-card" @click="$router.push(q.path)">
        <div class="q-icon" :style="{ background: q.bg }"><el-icon :size="22"><component :is="q.icon" /></el-icon></div>
        <div>
          <div class="q-title">{{ q.title }}</div>
          <div class="q-desc">{{ q.desc }}</div>
        </div>
        <el-icon class="q-arrow"><ArrowRight /></el-icon>
      </div>
    </section>

    <!-- 最近报告 + 平台速览 -->
    <section class="wh-cols">
      <div class="wh-card">
        <div class="wh-card-head"><span>最近报告</span><router-link to="/app/history" class="wh-more">全部 ›</router-link></div>
        <RecentActivity :reports="recent" :loading="loadingRecent" />
      </div>
      <div class="wh-card">
        <div class="wh-card-head"><span>平台速览</span></div>
        <div class="kb-stats">
          <div class="kb-row"><span>完整稳评范文</span><b>{{ pub.kb_examples }}</b></div>
          <div class="kb-row"><span>地方法规/规范</span><b>{{ pub.regulations }}</b></div>
          <div class="kb-row"><span>公司报告模板</span><b>{{ pub.templates }}</b></div>
          <div class="kb-row"><span>审核经验规则</span><b>{{ pub.skills }}</b></div>
        </div>
        <el-button class="kb-go" @click="$router.push('/app/check-rules')">去做一次合规体检 →</el-button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { MagicStick, ChatDotSquare, Clock, DataAnalysis, ArrowRight } from '@element-plus/icons-vue'
import RecentActivity from '@/components/dashboard/RecentActivity.vue'
import { getDashboardStats, getRecentReports } from '@/api/history'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const stats = ref({})
const recent = ref([])
const loadingRecent = ref(false)
const pub = ref({ kb_examples: 0, regulations: 0, templates: 0, skills: 0 })

const quicks = [
  { title: 'AI 生成稳评报告', desc: '上传材料，逐章智能生成', icon: 'MagicStick', path: '/app/assistant', bg: 'linear-gradient(135deg,#2e5bff,#5a3cff)' },
  { title: '知识库智能问答', desc: '法规与范文即时解答', icon: 'ChatDotSquare', path: '/app/knowledge-chat', bg: 'linear-gradient(135deg,#0aa58e,#2ec9a3)' },
  { title: '历史报告', desc: '查看与管理生成报告', icon: 'Clock', path: '/app/history', bg: 'linear-gradient(135deg,#f5a524,#ff7a45)' },
  { title: '合规体检', desc: '阈值规则 · 必填核对', icon: 'DataAnalysis', path: '/app/check-rules', bg: 'linear-gradient(135deg,#7a5cff,#b03cff)' },
]

onMounted(async () => {
  try {
    const [sRes, rRes] = await Promise.all([getDashboardStats(), getRecentReports(8)])
    stats.value = sRes.data || {}
    recent.value = rRes.data || []
  } catch { /* 忽略 */ }
  loadingRecent.value = false
  try {
    const r = await fetch('/api/v1/public/stats')
    const d = await r.json()
    if (d.data) pub.value = d.data
  } catch { /* 忽略 */ }
})

const heroStats = computed(() => [
  { value: stats.value.total_reports ?? stats.value.report_count ?? '—', label: '累计生成报告' },
  { value: pub.value.kb_examples || '—', label: '入库稳评范文' },
  { value: pub.value.skills || '—', label: '审核经验规则' },
])
</script>

<style scoped>
.work-home { animation: appFadeIn .25s ease }
/* hero */
.wh-hero { position: relative; overflow: hidden; border-radius: 20px; background: linear-gradient(140deg,#0d1a3f,#1d3b8f 60%,#2e5bff); color:#fff; padding: 34px 36px; display:flex; justify-content:space-between; align-items:center; gap:30px }
.hero-glow { position:absolute; width:300px;height:300px;border-radius:50%;background:#7a3cff;filter:blur(70px); opacity:.45; right:-60px; top:-80px }
.wh-hero-copy { position:relative; z-index:1 }
.wh-greet { font-size:14px; opacity:.85; margin-bottom:6px }
.wh-hero h2 { font-size:26px; margin:0 0 6px; font-weight:800 }
.wh-hero p { color:#b9c8f2; margin:0 0 18px; font-size:14px }
.wh-cta { display:flex; gap:12px }
.btn-primary { background:#fff; color:#13255c; font-weight:700; padding:10px 20px; border-radius:10px; text-decoration:none }
.btn-ghost { color:#fff; border:1px solid rgba(255,255,255,.4); padding:10px 20px; border-radius:10px; text-decoration:none }
.wh-mini-stats { display:flex; gap:26px; position:relative; z-index:1 }
.mini-n { font-size:30px; font-weight:800 }
.mini-l { font-size:12px; opacity:.8 }
@media (max-width:900px){ .wh-hero{flex-direction:column;align-items:flex-start} }

/* quick */
.wh-quick { display:grid; grid-template-columns: repeat(4,1fr); gap:16px; margin:20px 0 }
.q-card { background:#fff; border-radius:16px; border:1px solid #eef1f7; box-shadow:var(--app-shadow); padding:18px; display:flex; gap:12px; align-items:center; cursor:pointer; transition: transform .15s }
.q-card:hover { transform: translateY(-3px) }
.q-icon { width:44px;height:44px;flex:none; border-radius:12px; color:#fff; display:flex; align-items:center; justify-content:center }
.q-title { font-weight:700; font-size:15px; color:#18213a }
.q-desc { font-size:12px; color:#8a93a6; margin-top:2px }
.q-arrow { margin-left:auto; color:#c6cee2 }

/* cols */
.wh-cols { display:grid; grid-template-columns: 1.6fr 1fr; gap:18px }
.wh-card { background:#fff; border-radius:16px; border:1px solid #eef1f7; box-shadow:var(--app-shadow); padding: 18px 20px }
.wh-card-head { display:flex; justify-content:space-between; align-items:center; font-weight:700; color:#18213a; margin-bottom:12px; font-size:16px }
.wh-more { color:#2e5bff; text-decoration:none; font-size:13px; font-weight:500 }
.kb-stats .kb-row { display:flex; justify-content:space-between; padding:11px 4px; border-bottom:1px dashed #eef1f7; color:#3c4760; font-size:14px }
.kb-stats b { color:#2e5bff; font-size:16px }
.kb-go { width:100%; margin-top:14px }
</style>
