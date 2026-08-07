<template>
  <div class="gen-layout">
    <!-- History Sidebar -->
    <aside class="sidebar" v-if="history.length">
      <h3>📋 历史报告</h3>
      <div class="hist-list">
        <div v-for="h in history" :key="h.id" class="hist-item">
          <div class="hist-title">{{ h.title || '未命名' }}</div>
          <div class="hist-meta">{{ h.time }} · {{ fmtSize(h.size) }}</div>
          <a v-if="h.download_url" :href="h.download_url" class="hist-dl">📥 下载</a>
          <span v-else class="hist-dl disabled">⏳</span>
        </div>
      </div>
      <button class="hist-refresh" @click="loadHistory">🔄 刷新</button>
    </aside>

    <!-- Main -->
    <div class="gen">
      <header class="gh">
        <h1>众拓AI智能报告生成</h1>
        <p>上传项目资料，AI 自动编制专业报告</p>
      </header>

      <!-- ① Domain -->
      <section class="gs">
        <h2>① 选择报告类型</h2>
        <div class="dc">
          <div :class="['dc-card', { sel: domain === 'stability' }]" @click="domain = 'stability'">
            <span class="dc-icon">📊</span>
            <span class="dc-title">社会稳定风险评估报告</span>
          </div>
          <div :class="['dc-card', { sel: domain === 'bidding' }]" @click="domain = 'bidding'">
            <span class="dc-icon">📋</span>
            <span class="dc-title">投标文件编写</span>
          </div>
        </div>
      </section>

      <!-- ② Upload -->
      <section class="gs">
        <h2>② 上传资料文档 <span v-if="uploading" class="up-stat">上传中 {{ uploadDone }}/{{ uploadTotal }}...</span></h2>
        <div class="up-zone" @click="clickFile" @dragover.prevent @drop.prevent="onDrop">
          <div class="up-inner">
            <span class="up-icon">📁</span>
            <p v-if="!uploading">拖拽文件到此处，或点击选择</p>
            <p v-else>正在上传...</p>
            <small>支持 PDF、DOCX、DOC、TXT、图片、文件夹</small>
          </div>
        </div>
        <div v-if="files.length" class="fl">
          <div v-for="(f, i) in files" :key="i" class="fl-item">
            <span :class="['fl-badge', badge(f)]">{{ ext(f) }}</span>
            <span class="fl-name">{{ f.name }}</span>
            <span class="fl-size">{{ fmtSize(f.size) }}</span>
            <button class="fl-del" @click="files.splice(i, 1)">✕</button>
          </div>
        </div>
        <div class="up-btns">
          <button class="ubtn" @click.stop="clickFile" :disabled="isRunning">📎 选择文件</button>
          <button class="ubtn" @click.stop="clickFolder" :disabled="isRunning">📁 选择文件夹</button>
          <button v-if="files.length && !isRunning" class="ubtn ubtn-clear" @click="files=[]">清空全部</button>
        </div>
      </section>

      <!-- ③ Generate + Cancel -->
      <section class="gs">
        <h2>③ 开始生成</h2>
        <div class="gen-row">
          <button class="gbtn" :disabled="!canGenerate || isRunning" @click="startGenerate">
            {{ isRunning ? '⏳ 生成中...' : '🚀 开始生成报告' }}
          </button>
          <button v-if="isRunning" class="gbtn gbtn-cancel" @click="cancelGenerate">
            ⏹ 取消
          </button>
        </div>
        <p v-if="!files.length && !isRunning" class="ghint">请先上传资料文档</p>
      </section>

      <!-- Progress -->
      <section v-if="showProgress" class="gs progress-section">
        <h2>
          {{ phase === 'complete' ? '✅ 报告生成完成' : '生成进度' }}
          <span v-if="chInfo && phase !== 'complete'" class="ch-info">{{ chInfo }}</span>
        </h2>
        <div class="pbar-wrap">
          <div class="pbar"><div class="pbar-fill" :style="{ width: pct + '%' }"></div></div>
          <span class="pbar-pct">{{ pct }}%</span>
        </div>
        <p class="pmsg">{{ statusMessage }}</p>
        <div v-if="steps.length" class="steps">
          <div v-for="s in steps" :key="s.key" :class="['step', { done: s.done, active: s.active }]">
            <span class="step-dot"></span><span class="step-label">{{ s.label }}</span>
          </div>
        </div>
        <div v-if="phase === 'complete' && downloadUrl" class="dl-wrap">
          <a :href="downloadUrl" class="dlbtn" @click="onDownload">📥 下载报告 (.docx)</a>
          <button class="dlbtn dlbtn-new" @click="resetAll">🔄 生成新报告</button>
        </div>
        <!-- 🔴 缺失信息弹窗 -->
        <div v-if="reportStore.workflowPaused && missingFields.length" class="missing-modal">
          <div class="missing-card">
            <h3>⏸️ 需要补充以下信息</h3>
            <p class="missing-hint">{{ statusMessage }}</p>
            <div v-for="f in missingFields" :key="f.key" class="missing-field">
              <label>{{ f.label }} <small>{{ f.desc }}</small></label>
              <input v-model="missingForm[f.key]" :placeholder="'例如：' + (f.example || '')" />
            </div>
            <div class="missing-actions">
              <button class="dlbtn" @click="submitMissing">✅ 提交并继续生成</button>
              <button class="dlbtn dlbtn-new" @click="skipMissing">跳过（使用默认值）</button>
            </div>
          </div>
        </div>
        <!-- 实时日志 -->
        <div v-if="showProgress && workflowLogs.length" class="log-panel">
          <div class="log-header">📋 运行日志</div>
          <div class="log-body" ref="logBody">
            <div v-for="(log, i) in workflowLogs" :key="i" class="log-line" :class="{ 'log-done': log.includes('✅'), 'log-running': log.includes('...') || log.includes('正在') }">{{ log }}</div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useReportStore } from '@/stores/report'
import { ElMessage, ElMessageBox } from 'element-plus'

const reportStore = useReportStore()

const domain = ref('stability')
const files = ref([])
const showProgress = ref(false)
const uploading = ref(false)
const uploadTotal = ref(0)
const uploadDone = ref(0)
const history = reactive([])
const workflowLogs = ref([])
const logBody = ref(null)
const missingFields = ref([])
const missingForm = reactive({})

async function submitMissing() {
  const data = {}
  for (const f of missingFields.value) {
    if (missingForm[f.key]) data[f.key] = missingForm[f.key]
  }
  if (!Object.keys(data).length) { ElMessage.warning('请至少填写一项'); return }
  missingFields.value = []
  await reportStore.resumeWorkflow(data)
}
function skipMissing() {
  missingFields.value = []
  reportStore.resumeWorkflow({})
}

const isRunning = computed(() => reportStore.isStreaming || reportStore.phase === 'generating')
const phase = computed(() => reportStore.phase)
const downloadUrl = computed(() => reportStore.downloadUrl)
const statusMessage = computed(() => reportStore.statusMessage || '准备中...')

let _maxPct = 0
const pct = computed(() => {
  const steps = reportStore.progressSteps || []
  if (!steps.length) return 0
  // Weighted progress: prep steps 10%, generation 75%, post steps 15%
  const genStep = steps.find(s => s.key === 'generation')
  const qualityStep = steps.find(s => s.key === 'quality')
  const assemblyStep = steps.find(s => s.key === 'assembly')

  // Pre-generation: up to 10%
  const preDone = steps.filter(s => ['analysis','outline','fixed_data','knowledge'].includes(s.key) && s.done).length
  let base = Math.round(preDone / 4 * 10)

  // Generation phase: 10%-85% (75% of total)
  if (genStep) {
    if (genStep.active || genStep.done) {
      const ch = reportStore.currentChapter || 1
      const total = reportStore.totalChapters || 10
      base = Math.max(base, 10 + Math.round((ch / total) * 75))
    }
  }

  // Post-generation: 85%-100%
  if (qualityStep && qualityStep.done) base = Math.max(base, 92)
  if (assemblyStep && assemblyStep.done) base = Math.max(base, 100)

  const v = Math.min(base, 100)
  if (v > _maxPct) _maxPct = v
  // Snap to 100 when assembly is done or phase is complete
  if (assemblyStep && assemblyStep.done) _maxPct = 100
  if (reportStore.phase === 'complete') _maxPct = 100
  return _maxPct
})
const chInfo = computed(() => {
  const ch = reportStore.currentChapter
  const total = reportStore.totalChapters
  return ch && total ? `第 ${ch}/${total} 章` : ''
})
const steps = computed(() => reportStore.progressSteps || [])
const canGenerate = computed(() => files.value.length > 0)

// ── History ──
onMounted(() => {
  loadHistory()
  // 🔴 页面刷新/关闭时取消正在运行的工作流
  window.addEventListener('beforeunload', _onUnload)
})
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => { window.removeEventListener('beforeunload', _onUnload) })
function _onUnload() {
  if (reportStore.workflowRunning && reportStore.sessionId) {
    // Send cancel signal (fire-and-forget, don't block page unload)
    navigator.sendBeacon(`/api/v1/reports/generate/${reportStore.sessionId}/cancel`)
  }
}
async function loadHistory() {
  try {
    const r = await fetch('/api/v1/history/reports?page=1&page_size=20')
    const d = await r.json()
    const items = d.data?.items || d.data || []
    history.splice(0, history.length, ...items.map(i => ({
      id: i.id,
      title: i.title || '未命名',
      time: i.created_at ? new Date(i.created_at).toLocaleDateString() : '',
      size: i.file_size || 0,
      download_url: i.report_file_path ? `/api/v1/files/${i.report_file_path}` : (i.download_url || ''),
    })))
  } catch { /* silent */ }
}

// ── Watch: complete → auto download ──
watch(() => reportStore.phase, (p) => {
  if (p === 'complete') {
    const url = reportStore.downloadUrl
    if (url) {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = url; a.download = ''
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
      }, 300)
    }
    files.value = []
    _maxPct = 0
    loadHistory()
    ElMessage.success('报告生成完成！')
  }
})

// ── Upload ──
function clickFile() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.multiple = true
  inp.accept = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt'
  inp.onchange = (e) => { onFiles(e); inp.remove() }
  inp.click()
}
function clickFolder() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true
  inp.onchange = (e) => { onFolder(e); inp.remove() }
  inp.click()
}
async function onFiles(e) { await addFiles(e.target.files); e.target.value = '' }
async function onFolder(e) {
  const fs = e.target.files
  if (fs?.length) { await addFiles(fs); ElMessage.success(`已上传 ${fs.length} 个文件`) }
  e.target.value = ''
}
async function onDrop(e) { await addFiles(e.dataTransfer.files) }
async function addFiles(fileList) {
  console.log(`[UPLOAD] 开始上传 ${fileList.length} 个文件`)
  uploading.value = true
  uploadTotal.value = fileList.length
  uploadDone.value = 0
  for (const f of fileList) {
    try {
      if (!reportStore.sessionId) {
        reportStore.setSelectedDomain(domain.value)
        await reportStore.startGeneration('生成报告', 0, domain.value)
        console.log('[UPLOAD] 创建会话:', reportStore.sessionId)
      }
      const r = await reportStore.uploadFile(f)
      console.log(`[UPLOAD] ${f.name}:`, r?.file_path || 'FAILED')
      if (r?.file_path) files.value.push({ path: r.file_path, url: r.url || '', name: r.original_name || f.name, size: f.size || 0, ft: r.file_type || 'file' })
      uploadDone.value++
    } catch (e) { console.error(`[UPLOAD] ${f.name} 失败:`, e); ElMessage.error(f.name + ' 上传失败') }
  }
  uploading.value = false
  console.log(`[UPLOAD] 完成 ${uploadDone.value}/${uploadTotal.value}`)
}

// ── Generate / Cancel ──
async function startGenerate() {
  showProgress.value = true
  _maxPct = 0
  workflowLogs.value = ['🚀 正在启动工作流...']
  try {
    if (!reportStore.sessionId) {
      reportStore.setSelectedDomain(domain.value)
      await reportStore.startGeneration('生成报告', 0, domain.value)
    }
    // 🔴 Use LangGraph workflow for generation (with progress bar)
    console.log('[GENERATE] 启动工作流, session:', reportStore.sessionId)
    await reportStore.generateWithWorkflow()
    console.log('[GENERATE] 工作流已启动, 开始轮询日志')
    // Start collecting logs via polling
    _collectLogs()
  } catch (e) {
    console.error('[GENERATE] 启动失败:', e)
    if (e.name !== 'AbortError') {
      ElMessage.error('生成失败: ' + (e.message || '未知错误'))
    }
    showProgress.value = false
  }
}
async function cancelGenerate() {
  try {
    await reportStore.cancelGeneration()
    showProgress.value = false
    ElMessage.info('生成已取消')
  } catch {}
}
let _logTimer = null
function _collectLogs() {
  console.log('[POLL] 开始轮询工作流状态...')
  if (_logTimer) clearInterval(_logTimer)
  _logTimer = setInterval(async () => {
    if (!showProgress.value || !reportStore.sessionId) { console.log('[POLL] 停止(页面关闭)'); clearInterval(_logTimer); return }
    try {
      const { getWorkflowStatus } = await import('@/api/report')
      const res = await getWorkflowStatus(reportStore.sessionId)
      const data = res.data || res
      if (data.logs && data.logs.length > workflowLogs.value.length) {
        console.log(`[POLL] 日志更新: ${workflowLogs.value.length}→${data.logs.length} 条`)
        workflowLogs.value = [...data.logs]
        setTimeout(() => { if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight }, 50)
      }
      if (data.phase === 'complete') { console.log('[POLL] 完成!'); clearInterval(_logTimer) }
      if (data.phase === 'paused') {
        console.log('[POLL] 暂停:', data.missing_fields?.length, '个缺失字段')
        missingFields.value = data.missing_fields || []
        if (data.missing_fields?.length) {
          for (const f of data.missing_fields) { missingForm[f.key] = '' }
        }
        clearInterval(_logTimer)
      }
    } catch(e) { console.error('[POLL] 错误:', e.message || e) }
  }, 2000)
}

function onDownload() { setTimeout(() => { showProgress.value = false }, 1000) }
function resetAll() {
  showProgress.value = false
  workflowLogs.value = []
  missingFields.value = []
  if (_logTimer) clearInterval(_logTimer)
  files.value = []
  _maxPct = 0
  reportStore.downloadUrl = ''
  reportStore.phase = 'idle'
  reportStore.statusMessage = ''
  reportStore.progressSteps = []
}

// Helpers
function ext(f) { const n = (f.name || '').toLowerCase(); if (n.endsWith('.pdf')) return 'PDF'; if (/\.(doc|docx)$/.test(n)) return 'DOC'; if (/\.(xls|xlsx|csv)$/.test(n)) return 'XLS'; if (/\.(png|jpg|jpeg|gif|webp)$/.test(n)) return 'IMG'; return 'FILE' }
function badge(f) { return 'b' + ext(f).toLowerCase() }
function fmtSize(b) { if (!b) return ''; return b < 1024 ? b + 'B' : b < 1048576 ? (b / 1024).toFixed(1) + 'KB' : (b / 1048576).toFixed(1) + 'MB' }
</script>

<style scoped>
.gen-layout { display: flex; height: 100vh; overflow: hidden; }
.sidebar { width: 220px; background: #f8fafc; border-right: 1px solid #e5e7eb; padding: 16px; overflow-y: auto; flex-shrink: 0; }
.sidebar h3 { font-size: 13px; margin: 0 0 12px; color: #374151; }
.hist-list { display: flex; flex-direction: column; gap: 8px; }
.hist-item { padding: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; }
.hist-title { font-weight: 600; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-meta { color: #9ca3af; font-size: 11px; margin: 2px 0; }
.hist-dl { color: #1d4ed8; font-size: 11px; text-decoration: none; }
.hist-dl.disabled { color: #d1d5db; }
.hist-refresh { margin-top: 10px; padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 11px; width: 100%; }

.gen { flex: 1; max-width: 780px; margin: 0 auto; padding: 24px 20px 60px; font-family: -apple-system,BlinkMacSystemFont,sans-serif; color: #1f2937; overflow-y: auto; }
.gh { text-align: center; margin-bottom: 32px; }
.gh h1 { font-size: 24px; margin: 0 0 4px; color: #111827; }
.gh p { font-size: 14px; color: #6b7280; margin: 0; }
.gs { margin-bottom: 24px; }
.gs h2 { font-size: 15px; font-weight: 600; margin: 0 0 12px; color: #374151; }
.up-stat { font-size: 12px; color: #1d4ed8; font-weight: 400; }

/* Domain */
.dc { display: flex; gap: 12px; }
.dc-card { flex: 1; padding: 20px 16px; border: 2px solid #e5e7eb; border-radius: 10px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all .15s; }
.dc-card:hover { border-color: #93c5fd; }
.dc-card.sel { border-color: #1d4ed8; background: #eff6ff; }
.dc-icon { font-size: 32px; }
.dc-title { font-size: 15px; font-weight: 600; }

/* Upload */
.up-zone { border: 2px dashed #d1d5db; border-radius: 10px; padding: 32px; text-align: center; cursor: pointer; transition: border-color .15s; }
.up-zone:hover { border-color: #1d4ed8; background: #f9fafb; }
.up-inner { pointer-events: none; }
.up-icon { font-size: 36px; }
.up-inner p { font-size: 14px; color: #374151; margin: 8px 0 4px; }
.up-inner small { font-size: 12px; color: #9ca3af; }
.fl { margin-top: 10px; }
.fl-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 4px; font-size: 13px; }
.fl-badge { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.bpdf { background: #ef4444; } .bdoc { background: #3b82f6; } .bxls { background: #059669; } .bimg { background: #8b5cf6; } .bfile { background: #9ca3af; }
.fl-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-size { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
.fl-del { border: none; background: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 2px 4px; }
.up-btns { display: flex; gap: 8px; margin-top: 10px; }
.ubtn { padding: 7px 14px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.ubtn:hover { background: #f3f4f6; }
.ubtn:disabled { opacity: .5; cursor: not-allowed; }
.ubtn-clear { color: #ef4444; border-color: #fca5a5; }

/* Generate */
.gen-row { display: flex; gap: 10px; }
.gbtn { flex: 1; padding: 14px; border: none; border-radius: 10px; background: #1d4ed8; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
.gbtn:disabled { background: #9ca3af; cursor: not-allowed; }
.gbtn:not(:disabled):hover { background: #1e40af; }
.gbtn-cancel { flex: 0 0 auto; padding: 14px 24px; background: #ef4444; }
.gbtn-cancel:hover { background: #dc2626 !important; }
.ghint { font-size: 12px; color: #f59e0b; margin: 8px 0 0; text-align: center; }

/* Progress */
.progress-section { background: #f9fafb; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; }
.log-panel { margin-top: 12px; background: #1e1e2e; border-radius: 8px; overflow: hidden; max-height: 200px; }
.log-header { padding: 6px 12px; font-size: 12px; color: #a0a0b0; background: #2a2a3a; border-bottom: 1px solid #3a3a4a; }
.log-body { padding: 8px 12px; max-height: 160px; overflow-y: auto; font-family: 'Menlo', 'Consolas', monospace; font-size: 11px; line-height: 1.6; }
.log-line { color: #c0c0d0; }
.log-line.log-done { color: #4ade80; }
.log-line.log-running { color: #60a5fa; }
.missing-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.missing-card { background: #fff; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.missing-card h3 { margin: 0 0 8px; font-size: 18px; }
.missing-hint { color: #666; font-size: 13px; margin-bottom: 16px; }
.missing-field { margin-bottom: 12px; }
.missing-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.missing-field label small { font-weight: 400; color: #999; }
.missing-field input { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
.missing-actions { display: flex; gap: 8px; margin-top: 16px; }
.pbar-wrap { display: flex; align-items: center; gap: 10px; }
.pbar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.pbar-fill { height: 100%; background: #1d4ed8; border-radius: 4px; transition: width .3s; }
.pbar-pct { font-size: 13px; font-weight: 600; color: #1d4ed8; min-width: 36px; }
.pmsg { font-size: 13px; color: #6b7280; margin: 10px 0 0; }
.ch-info { font-size: 13px; color: #1d4ed8; font-weight: 600; margin-left: 8px; }
.steps { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.step { display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #e5e7eb; color: #9ca3af; }
.step.done { background: #d1fae5; color: #059669; }
.step.active { background: #dbeafe; color: #1d4ed8; animation: pulse 1s infinite; }
.step-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

/* Download */
.dl-wrap { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: center; }
.dlbtn { display: inline-block; padding: 10px 24px; background: #059669; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }
.dlbtn:hover { background: #047857; }
.dlbtn-new { background: #1d4ed8; }
.dlbtn-new:hover { background: #1e40af; }
</style>
