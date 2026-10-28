<template>
  <div class="portal">
    <!-- 顶部导航 -->
    <header class="portal-nav">
      <div class="nav-inner">
        <a class="nav-brand" href="/portal">
          <div class="brand-logo"><el-icon :size="20"><Files /></el-icon></div>
          <div>
            <div class="brand-name">众拓AI报告</div>
            <div class="brand-sub">社会稳定风险评估平台</div>
          </div>
        </a>
        <nav class="nav-links">
          <a href="#services">核心服务</a>
          <a href="#stats">平台数据</a>
          <a href="#cases">成功案例</a>
          <a href="#steps">如何开始</a>
        </nav>
        <div class="nav-cta">
          <a class="btn-ghost" :href="loggedIn ? '/app/dashboard' : '/login'">登录</a>
          <a class="btn-primary" :href="loggedIn ? '/app/assistant' : '/login'">开始使用 →</a>
        </div>
      </div>
    </header>

    <!-- Hero -->
    <section class="hero">
      <div class="glow g1"></div><div class="glow g2"></div>
      <div class="hero-inner">
        <div class="hero-copy">
          <span class="hero-badge">🔖 符合 DB32/T4013 规范 · 覆盖淮安本地口径</span>
          <h1>一键生成<br /><em>专业合规</em>的征地稳评报告</h1>
          <p class="hero-sub">面向土地征收社会稳定风险评估的 AI 报告引擎：知识库范文驱动逐章生成、自动合规校验、审批经验沉淀，把 7 天报告周期压缩到分钟级初稿。</p>
          <div class="hero-cta">
            <a class="btn-primary lg" :href="loggedIn ? '/app/assistant' : '/login'">立即生成报告</a>
            <a class="btn-ghost lg" href="#contact">咨询顾问</a>
          </div>
          <div class="hero-trust">
            <span><el-icon><CircleCheckFilled /></el-icon> 政府报送级规范</span>
            <span><el-icon><CircleCheckFilled /></el-icon> 知识库范文驱动</span>
            <span><el-icon><CircleCheckFilled /></el-icon> 合规兜底自动体检</span>
          </div>
        </div>
        <div class="hero-card">
          <div class="mock-head">社会稳定风险评估报告</div>
          <div class="mock-line w60"></div><div class="mock-line w90"></div><div class="mock-line w80"></div>
          <div class="mock-sec">决策事项基本情况</div>
          <div class="mock-line w70"></div><div class="mock-line w85"></div>
          <div class="mock-sec grad">风险等级 · 低风险</div>
          <div class="mock-chip-row"><i v-for="n in 4" :key="n"></i></div>
          <div class="mock-foot">✓ 已完成合规体检 · 3 处提醒待确认</div>
        </div>
      </div>
    </section>

    <!-- 运营数据 -->
    <section id="stats" class="stats">
      <div class="stat" v-for="s in statItems" :key="s.label">
        <div class="stat-num">{{ s.value }}</div>
        <div class="stat-label">{{ s.label }}</div>
      </div>
    </section>

    <!-- 服务货架 -->
    <section id="services" class="services">
      <h2 class="sec-title">核心服务</h2>
      <p class="sec-sub">从报告生成到审核到知识问答，全流程 AI 化</p>
      <div class="cards">
        <div class="s-card" v-for="s in services" :key="s.title">
          <div class="s-icon" :style="{ background: s.bg }"><el-icon :size="24"><component :is="s.icon" /></el-icon></div>
          <h3>{{ s.title }}</h3>
          <p>{{ s.desc }}</p>
          <ul><li v-for="f in s.feats" :key="f">{{ f }}</li></ul>
          <a class="s-link" :href="s.href">{{ s.cta }} →</a>
        </div>
      </div>
    </section>

    <!-- 四步 -->
    <section id="steps" class="steps">
      <h2 class="sec-title">四步拿到一份可用报告</h2>
      <div class="step-row">
        <div class="step" v-for="(st, i) in steps" :key="st">
          <div class="step-no">{{ i + 1 }}</div>
          <h4>{{ st.title }}</h4><p>{{ st.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 案例/信任 -->
    <section id="cases" class="cases">
      <h2 class="sec-title">服务案例</h2>
      <p class="sec-sub">已在淮安、盱眙、南京等多地完成稳评/案卷支撑</p>
      <div class="case-grid">
        <div class="case" v-for="c in cases" :key="c.name">
          <div class="case-name">{{ c.name }}</div>
          <div class="case-loc">{{ c.loc }}</div>
          <div class="case-tag">{{ c.tag }}</div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section id="contact" class="cta">
      <h2>需要一份规范、过审率的稳评报告？</h2>
      <p>让专业顾问为你安排 · 或直接进入平台体验</p>
      <div class="cta-btns">
        <a class="btn-primary lg" :href="loggedIn ? '/app/assistant' : '/login'">进入工作台</a>
        <span class="contact-line">咨询：江苏众拓项目代理咨询有限公司</span>
      </div>
    </section>

    <footer class="footer">
      <div>© 2026 江苏众拓项目代理咨询有限公司 · 众拓AI报告</div>
      <div class="footer-links"><a href="/app/dashboard">登录工作台</a></div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Files, CircleCheckFilled, Document, MagicStick, ChatDotRound, DataAnalysis } from '@element-plus/icons-vue'

const loggedIn = computed(() => !!localStorage.getItem('zhongtuo_token'))
const stats = ref({ kb_docs: 0, kb_examples: 0, regulations: 0, templates: 0, skills: 0, reports: 0 })

onMounted(async () => {
  try {
    const r = await fetch('/api/v1/public/stats')
    const d = await r.json()
    stats.value = (d.data) || stats.value
  } catch { /* 离线兜底 */ }
})

const statItems = computed(() => [
  { value: stats.value.kb_examples, label: '篇入库完整稳评范文' },
  { value: stats.value.regulations, label: '部地方法规·规范' },
  { value: stats.value.skills, label: '条审核经验规则' },
  { value: stats.value.templates, label: '套公司报告模板' },
])

const services = [
  { title: 'AI 稳评报告生成', icon: 'MagicStick', bg: 'linear-gradient(135deg,#2e5bff,#5a3cff)', href: loggedIn.value ? '/app/assistant' : '/login', cta: '开始生成', desc: '上传材料，逐章 AI 生成，知识库范文驱动、符合规范结构。', feats: ['10/12 章标准结构自动组织', '同类型过审范文参考', '缺数据自动标注并追问'] },
  { title: '合规体检 · 报告审核', icon: 'DataAnalysis', bg: 'linear-gradient(135deg,#0aa58e,#2ec9a3)', href: loggedIn.value ? '/app/check-rules' : '/login', cta: '进入校验', desc: '阈值规则库+异常值识别+必填核对，生成后自动兜底。', feats: ['问卷回收/覆盖率等硬指标', '异常值人工复核提醒', '规则阈值业务可调'] },
  { title: '知识问答 · 客服', icon: 'ChatDotRound', bg: 'linear-gradient(135deg,#f5a524,#ff7a45)', href: loggedIn.value ? '/app/knowledge-chat' : '/login', cta: '立即咨询', desc: '基于法规库与本地范文的智能客服，随问随答。', feats: ['法规/政策即时解答', '参考来源可追溯', '多场景快捷提问'] },
]

const steps = [
  { title: '上传资料', desc: '预公告、勘测定界、问卷/座谈、公示照片' },
  { title: 'AI 逐章生成', desc: '知识库同类型范文参考，结合你的真实数据' },
  { title: '合规体检', desc: '规则阈值自动比对，缺口与异常一目了然' },
  { title: '审核定稿', desc: '审批意见回灌沉淀，持续提升通过率' },
]

const cases = [
  { name: '洪泽区朱坝三圩社区土地征收', loc: '淮安 · 洪泽', tag: '征地区片 45000元/亩' },
  { name: '盱城片区开发地块项目', loc: '淮安 · 盱眙', tag: '12章案卷 · 2026' },
  { name: '黄码片区土地征收案卷', loc: '淮安 · 清江浦', tag: '案例入库' },
  { name: '朱坝西片区成片开发', loc: '淮安 · 洪泽', tag: '含座谈/问卷材料' },
  { name: '龙华路·功能提升工程', loc: '南京 · 六合', tag: '备案级案卷' },
  { name: '大湖娃幼儿园北侧绿地', loc: '本地案卷', tag: '送审稿·专家评审' },
]
</script>

<style scoped>
.portal { font-family: var(--el-font-family); color: var(--app-text-main); background: #fff }
.el-icon { vertical-align: -2px }

/* nav */
.portal-nav { position: sticky; top: 0; z-index: 50; background: rgba(255,255,255,.92); backdrop-filter: blur(10px); border-bottom: 1px solid #eef1f7 }
.nav-inner { max-width: 1200px; margin: 0 auto; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; gap: 24px }
.nav-brand { display: flex; align-items: center; gap: 10px; text-decoration: none }
.brand-logo { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(135deg,#2e5bff,#5a3cff); color:#fff; display:flex; align-items:center; justify-content:center }
.brand-name { font-size: 17px; font-weight: 800; color:#18213a; line-height:1.1 }
.brand-sub { font-size: 10px; color:#8a93a6 }
.nav-links { display: flex; gap: 26px }
.nav-links a { color: #3c4760; text-decoration: none; font-size: 14px }
.nav-links a:hover { color: #2e5bff }
.nav-cta { display: flex; gap: 12px; align-items: center }

/* buttons */
.btn-primary { display:inline-flex; align-items:center; justify-content:center; gap:4px; background: linear-gradient(135deg,#2e5bff,#4a5bff); color:#fff; border-radius: 10px; padding: 10px 22px; font-weight: 600; text-decoration: none; box-shadow: 0 8px 20px rgba(46,91,255,.35); transition: transform .15s }
.btn-primary:hover { transform: translateY(-2px) }
.btn-primary.lg { padding: 14px 30px; font-size: 16px }
.btn-ghost { display:inline-flex; align-items:center; justify-content:center; color:#3c4760; border:1px solid #e4e9f2; background:#fff; border-radius: 10px; padding: 10px 22px; text-decoration: none; font-weight: 500 }
.btn-ghost.lg { padding: 14px 30px; font-size: 16px; border-color:#d6def5; color:#2e5bff }

/* hero */
.hero { position: relative; overflow: hidden; background: linear-gradient(150deg,#0b1638 0%,#13255c 55%,#1d3b8f 100%); color:#fff; padding: 84px 24px 96px }
.hero .glow { position:absolute; border-radius:50%; filter: blur(70px); opacity:.5 }
.g1 { width: 460px; height:460px; background:#2e5bff; top:-160px; right:-80px }
.g2 { width: 360px; height:360px; background:#7a3cff; bottom:-140px; left:-60px }
.hero-inner { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1.15fr .85fr; gap: 48px; align-items: center; position: relative; z-index: 2 }
.hero-badge { display:inline-block; font-size:13px; background: rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.22); padding: 6px 12px; border-radius: 20px; color:#dfe7ff; margin-bottom: 18px }
.hero h1 { font-size: 46px; line-height:1.2; font-weight: 800; margin: 0 0 16px }
.hero h1 em { font-style: normal; background: linear-gradient(90deg,#6ea3ff,#a37bff); -webkit-background-clip: text; background-clip: text; color: transparent }
.hero-sub { color:#aabcf0; font-size:16px; line-height:1.8; max-width: 520px; margin: 0 0 26px }
.hero-cta { display:flex; gap:14px; margin-bottom: 22px }
.btn-primary.lg { background:#fff; color:#13255c; box-shadow:none; font-size:16px }
.btn-ghost.lg { border-color: rgba(255,255,255,.35); color:#fff; background: rgba(255,255,255,.06) }
.hero-trust { display:flex; gap:20px; color:#dfe7ff; font-size:13px; flex-wrap: wrap }
.hero-trust .el-icon { color:#35e0a8 }

/* hero mock card */
.hero-card { background:#fff; color:#18213a; border-radius: 18px; padding: 22px; box-shadow: 0 30px 80px rgba(0,10,40,.45) }
.mock-head { font-weight:800; font-size:15px; margin-bottom:10px }
.mock-line { height:8px; border-radius:4px; background:#eef1f7; margin: 6px 0 }
.mock-sec { font-size:12px; font-weight:700; color:#2e5bff; margin: 14px 0 6px }
.mock-sec.grad { background: linear-gradient(90deg,#18b879,#2ec9a3); color:#fff; display:inline-block; padding:3px 10px; border-radius: 6px }
.w60{width:60%}.w90{width:90%}.w80{width:80%}.w70{width:70%}.w85{width:85%}
.mock-chip-row{display:flex; gap:8px; margin:12px 0}
.mock-chip-row i{width:26%; height:42px; border-radius:8px; background:#f4f6fb; border:1px dashed #dfe6f5}
.mock-foot{font-size:12px; color:#6b7692}

/* stats */
.stats { max-width:1200px; margin: 0 auto; display:grid; grid-template-columns: repeat(4,1fr); gap:20px; padding: 40px 24px 8px }
.stat { text-align:center; background:#fff; border:1px solid #eef1f7; border-radius:16px; padding: 26px 10px; box-shadow: var(--app-shadow) }
.stat-num { font-size: 40px; font-weight: 800; color: transparent; background: linear-gradient(135deg,#2e5bff,#7a3cff); -webkit-background-clip:text; background-clip:text }
.stat-label { color:#6b7692; margin-top:6px; font-size:13px }

/* sections */
section:not(.hero):not(.stats) { max-width:1200px; margin:0 auto; padding: 64px 24px }
.sec-title { font-size: 30px; text-align:center; margin: 0 0 8px }
.sec-sub { text-align:center; color:#6b7692; margin:0 0 36px }
.services .cards { display:grid; grid-template-columns: repeat(3,1fr); gap:22px }
.s-card { background:#fff; border:1px solid #eef1f7; border-radius:18px; padding: 26px; box-shadow: var(--app-shadow); display:flex; flex-direction:column }
.s-icon { width:52px;height:52px; border-radius:14px; color:#fff; display:flex; align-items:center; justify-content:center; margin-bottom:16px }
.s-card h3{font-size:19px;margin:0 0 8px}
.s-card p{color:#6b7692; font-size:13.5px; line-height:1.7; margin:0 0 12px}
.s-card ul{list-style:none; padding:0; margin:0 0 16px}
.s-card li{color:#3c4760; font-size:13.5px; padding:4px 0 4px 18px; position:relative}
.s-card li::before{content:'✓'; position:absolute; left:0; color:#2e5bff}
.s-link{margin-top:auto; color:#2e5bff; font-weight:600; text-decoration:none}

.step-row{display:grid; grid-template-columns: repeat(4,1fr); gap:18px}
.step{background:#f6f9ff; border:1px solid #e6edff; border-radius:16px; padding:24px; text-align:center}
.step-no{width:38px;height:38px; margin:0 auto 12px; border-radius:50%; background:linear-gradient(135deg,#2e5bff,#7a3cff); color:#fff; font-weight:800; display:flex; align-items:center; justify-content:center}
.step h4{margin:0 0 6px; font-size:16px}
.step p{color:#6b7692; font-size:12.5px; margin:0}

.case-grid{display:grid; grid-template-columns: repeat(3,1fr); gap:18px}
.case{background:#fff; border:1px solid #eef1f7; border-radius:16px; padding:20px; box-shadow: var(--app-shadow)}
.case-name{font-weight:600; margin-bottom:6px}
.case-loc{color:#8a93a6; font-size:12.5px; margin-bottom:10px}
.case-tag{display:inline-block; background:#eef2ff; color:#2e5bff; font-size:12px; padding:3px 10px; border-radius:14px}

.cta{ background: linear-gradient(135deg,#13255c,#1d3b8f); border-radius:24px; color:#fff; text-align:center; padding: 64px 24px; margin: 24px auto 40px !important }
.cta h2{font-size:28px; margin:0 0 8px}
.cta p{color:#aabcf0; margin:0 0 24px}
.cta-btns{display:flex; flex-direction:column; align-items:center; gap:14px}
.contact-line{font-size:13px; color:#aabcf0}
.cta .btn-primary.lg{ background:#fff; color:#13255c; box-shadow:none }

.footer{border-top:1px solid #eef1f7; padding: 26px 24px; display:flex; justify-content:space-between; color:#8a93a6; font-size:13px; max-width:1200px; margin:0 auto}
.footer a{color:#2e5bff; text-decoration:none}
@media (max-width: 900px){
  .hero-inner{grid-template-columns:1fr} .hero-card{display:none}
  .stats,.services .cards,.step-row,.case-grid{grid-template-columns:1fr 1fr}
  .nav-links{display:none}
}
</style>
