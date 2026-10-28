<template>
  <div class="cs-wrap">
    <!-- 收起态：右下角悬浮球 -->
    <transition name="cs-scale">
      <button v-if="!open" class="cs-launcher" @click="open = true" aria-label="打开智能客服">
        <el-icon :size="26"><ChatDotRound /></el-icon>
        <span class="cs-pulse"></span>
        <span class="cs-launcher-tip">小拓 · 智能客服</span>
      </button>
    </transition>

    <!-- 展开态：客服面板 -->
    <transition name="cs-pop">
      <div v-if="open" class="cs-panel">
        <!-- 头部 -->
        <div class="cs-head">
          <div class="cs-head-left">
            <div class="cs-avatar">
              <el-icon :size="20"><ChatLineRound /></el-icon>
            </div>
            <div>
              <div class="cs-title">众拓智能客服</div>
              <div class="cs-status"><i class="cs-dot"></i> 在线 · 基于知识库即时解答</div>
            </div>
          </div>
          <div class="cs-head-actions">
            <el-tooltip content="清空对话" placement="bottom">
              <el-icon class="cs-btn" @click="clearChat"><Delete /></el-icon>
            </el-tooltip>
            <el-tooltip content="收起" placement="bottom">
              <el-icon class="cs-btn" @click="open = false"><Fold /></el-icon>
            </el-tooltip>
          </div>
        </div>

        <!-- 消息区 -->
        <div class="cs-body" ref="bodyRef">
          <div v-if="!messages.length" class="cs-welcome">
            <div class="cs-welcome-avatar">
              <el-icon :size="34"><ChatDotSquare /></el-icon>
            </div>
            <p class="cs-welcome-title">您好，我是小拓 👋</p>
            <p class="cs-welcome-sub">我可以解答社会稳定风险评估、征地补偿、报告编制等专业问题。试试下方问题，或直接输入提问。</p>
            <div class="cs-domain">
              <span>知识库：</span>
              <el-select v-model="domain" size="small" style="width: 150px" @change="clearChat">
                <el-option label="社会稳定风险评估" value="stability" />
                <el-option label="投标文件编写" value="bidding" />
              </el-select>
            </div>
            <div class="cs-questions">
              <button v-for="q in sampleQuestions" :key="q" class="cs-q" @click="sendQuick(q)">{{ q }}</button>
            </div>
          </div>

          <div v-else class="cs-chat">
            <div v-for="(m, i) in messages" :key="i" :class="['cs-row', m.role]">
              <div v-if="m.role === 'assistant'" class="cs-bot-avatar"><el-icon :size="14"><ChatLineRound /></el-icon></div>
              <div class="cs-bubble">
                <div v-if="m.sources && m.sources.length" class="cs-sources">
                  <span class="cs-src-label">参考：</span>
                  <span v-for="(s, si) in m.sources.slice(0, 3)" :key="si" class="cs-src">{{ s.title }}</span>
                </div>
                <div class="cs-text" v-html="renderMarkdown(m.content)"></div>
              </div>
            </div>
            <div v-if="loading" class="cs-row assistant">
              <div class="cs-bot-avatar"><el-icon :size="14"><ChatLineRound /></el-icon></div>
              <div class="cs-bubble cs-typing">
                <i></i><i></i><i></i>
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="cs-input">
          <button class="cs-goto" @click="gotoFull">
            <el-icon :size="13"><FullScreen /></el-icon> 完整功能
          </button>
          <el-input
            v-model="text"
            :placeholder="placeholder"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 4 }"
            resize="none"
            @keydown.enter.exact.prevent="send"
          />
          <el-button type="primary" circle :icon="Promotion" :disabled="!text.trim() || loading" :loading="loading" @click="send" />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ChatDotRound, ChatDotSquare, ChatLineRound, Delete, Fold, FullScreen, Promotion } from '@element-plus/icons-vue'
import { marked } from 'marked'

const router = useRouter()
const open = ref(false)
const text = ref('')
const messages = ref([])
const loading = ref(false)
const bodyRef = ref(null)
const domain = ref('stability')
let abortCtrl = null

const sessionId = ref(localStorage.getItem('kb_widget_session') || newSessionId())

function newSessionId() {
  const id = 'kbw_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  localStorage.setItem('kb_widget_session', id)
  return id
}

const sampleQuestions = computed(() =>
  domain.value === 'stability'
    ? ['淮安市征地补偿标准是多少？', '社会稳定风险等级怎么划分？', '征地稳评报告包括哪些内容？', '被征地农民社保怎么办理？']
    : ['投标文件的基本结构是什么？', '技术标书包含哪些内容？']
)

const placeholder = computed(() => loading.value ? '思考中…' : '输入问题，Enter 发送')

function renderMarkdown(t) {
  if (!t) return ''
  try { return marked.parse(t, { breaks: true }) } catch { return String(t).replace(/\n/g, '<br>') }
}

function scrollBottom() {
  nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight })
}

function clearChat() {
  messages.value = []
  sessionId.value = newSessionId()
}

function sendQuick(q) {
  text.value = q
  send()
}

async function send() {
  const msg = text.value.trim()
  if (!msg || loading.value) return
  text.value = ''
  messages.value.push({ role: 'user', content: msg })
  messages.value.push({ role: 'assistant', content: '', sources: [] })
  loading.value = true
  const ai = messages.value.length - 1
  scrollBottom()

  if (abortCtrl) abortCtrl.abort()
  abortCtrl = new AbortController()

  try {
    const token = localStorage.getItem('zhongtuo_token') || ''
    const resp = await fetch('/api/knowledge/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: msg,
        history: messages.value.slice(0, -1).filter(m => m.content).slice(-10).map(m => ({ role: m.role, content: m.content })),
        domain: domain.value,
        top_k: 5,
        session_id: sessionId.value,
      }),
      signal: abortCtrl.signal,
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let evt = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('event: ')) { evt = line.slice(7).trim(); continue }
        if (!line.startsWith('data: ')) continue
        let d; try { d = JSON.parse(line.slice(6).trim()) } catch { continue }
        if (evt === 'thinking') {
          if (d.sources && d.sources.length) messages.value[ai].sources = d.sources
        } else if (evt === 'content') {
          if (d.delta) { messages.value[ai].content += d.delta; scrollBottom() }
        } else if (evt === 'done') {
          if (d.sources && d.sources.length) messages.value[ai].sources = d.sources
          if (d.session_id) { sessionId.value = d.session_id; localStorage.setItem('kb_widget_session', d.session_id) }
        } else if (evt === 'error') {
          messages.value[ai].content = `⚠️ ${d.message}`
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') messages.value[ai].content = `⚠️ 请求失败：${err.message}`
  } finally {
    loading.value = false
    scrollBottom()
  }
}

function gotoFull() {
  open.value = false
  router.push('/app/knowledge-chat')
}
</script>

<style scoped>
.cs-wrap { position: fixed; right: 24px; bottom: 24px; z-index: 3000; font-family: var(--el-font-family); }

/* 悬浮球 */
.cs-launcher {
  position: relative;
  width: 58px; height: 58px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #2e5bff 0%, #5a3cff 100%);
  box-shadow: 0 10px 26px rgba(46, 91, 255, 0.45);
  transition: transform .2s, box-shadow .2s;
}
.cs-launcher:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 14px 32px rgba(46, 91, 255, 0.55); }
.cs-pulse { position: absolute; inset: 0; border-radius: 50%; background: rgba(46, 91, 255, .35); animation: csPulse 2.2s infinite; }
@keyframes csPulse { 0% { transform: scale(1); opacity: .7 } 70% { transform: scale(1.55); opacity: 0 } 100% { opacity: 0 } }
.cs-launcher-tip {
  position: absolute; right: 66px; top: 50%; transform: translateY(-50%);
  background: #18213a; color: #fff; font-size: 12px; padding: 6px 10px; border-radius: 8px;
  white-space: nowrap; opacity: 0; transition: opacity .2s; pointer-events: none;
}
.cs-launcher:hover .cs-launcher-tip { opacity: 1 }

/* 面板 */
.cs-panel {
  width: 400px; max-width: calc(100vw - 40px);
  height: 620px; max-height: calc(100vh - 60px);
  border-radius: 18px;
  overflow: hidden;
  background: #fff;
  display: flex; flex-direction: column;
  box-shadow: var(--app-shadow-lg);
  border: 1px solid rgba(46, 91, 255, 0.10);
}
.cs-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: linear-gradient(120deg, #122052 0%, #1d3b8f 60%, #2e5bff 100%);
  color: #fff;
}
.cs-head-left { display: flex; align-items: center; gap: 10px; }
.cs-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,.16);
  display: flex; align-items: center; justify-content: center;
  border: 1px solid rgba(255,255,255,.35);
}
.cs-title { font-size: 16px; font-weight: 700; line-height: 1.2 }
.cs-status { font-size: 11px; opacity: .85; display: flex; align-items: center; gap: 5px; margin-top: 2px }
.cs-dot { width: 6px; height: 6px; border-radius: 50%; background: #2ee6a8; display: inline-block }
.cs-head-actions { display: flex; gap: 6px; }
.cs-btn { cursor: pointer; padding: 6px; border-radius: 8px; transition: background .2s }
.cs-btn:hover { background: rgba(255,255,255,.18) }

/* body */
.cs-body { flex: 1; overflow-y: auto; background: #f5f7fc; padding: 16px; }
.cs-welcome { text-align: center; padding: 22px 12px 8px }
.cs-welcome-avatar {
  width: 64px; height: 64px; margin: 0 auto 10px; border-radius: 18px;
  background: linear-gradient(135deg, #2e5bff, #5a3cff); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 20px rgba(46,91,255,.3);
}
.cs-welcome-title { font-size: 17px; font-weight: 700; color: #18213a; margin: 0 0 6px }
.cs-welcome-sub { font-size: 12.5px; color: #6b7692; margin: 0 auto 12px; max-width: 300px; line-height: 1.7 }
.cs-domain { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: #6b7692; margin-bottom: 12px }
.cs-questions { display: flex; flex-direction: column; gap: 8px; align-items: stretch; }
.cs-q {
  border: 1px solid #e4e9f2; background: #fff; color: #3c4760;
  padding: 9px 12px; border-radius: 10px; cursor: pointer; font-size: 13px;
  transition: all .18s; text-align: left;
}
.cs-q:hover { border-color: #2e5bff; color: #2e5bff; background: #f2f5ff; transform: translateX(2px) }

.cs-chat { display: flex; flex-direction: column; gap: 12px }
.cs-row { display: flex; align-items: flex-end; gap: 6px }
.cs-row.user { justify-content: flex-end }
.cs-bot-avatar {
  width: 24px; height: 24px; border-radius: 50%; flex: none;
  background: linear-gradient(135deg, #2e5bff, #5a3cff); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.cs-bubble { max-width: 84%; padding: 9px 12px; border-radius: 12px; font-size: 13px; line-height: 1.7; word-break: break-word; }
.cs-row.user .cs-bubble { background: linear-gradient(135deg, #2e5bff, #4a5bff); color: #fff; border-bottom-right-radius: 3px }
.cs-row.assistant .cs-bubble { background: #fff; color: #2a3348; border: 1px solid #e8ecf5; border-bottom-left-radius: 3px }
.cs-sources { margin-bottom: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center }
.cs-src-label { font-size: 11px; color: #8a93a6 }
.cs-src { font-size: 11px; color: #2e5bff; background: #eef2ff; padding: 1px 6px; border-radius: 6px }
.cs-text :deep(p) { margin: 4px 0 }
.cs-text :deep(pre) { background: #0f172a; color: #e2e8f0; padding: 8px; border-radius: 8px; overflow-x: auto; font-size: 12px }
.cs-text :deep(code) { font-family: ui-monospace, Menlo, monospace }
.cs-text :deep(a) { color: #2e5bff }

.cs-typing { display: flex; gap: 4px; padding: 14px 16px; }
.cs-typing i { width: 7px; height: 7px; border-radius: 50%; background: #9db0e8; animation: csTyping 1.1s infinite }
.cs-typing i:nth-child(2) { animation-delay: .15s }
.cs-typing i:nth-child(3) { animation-delay: .3s }
@keyframes csTyping { 0%, 60%, 100% { transform: translateY(0); opacity: .5 } 30% { transform: translateY(-5px); opacity: 1 } }

/* input */
.cs-input { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px 12px; background: #fff; border-top: 1px solid #eef1f7 }
.cs-input :deep(.el-textarea__inner) { border-radius: 10px; box-shadow: none }
.cs-input :deep(.el-textarea__inner:focus) { border-color: #2e5bff }
.cs-goto {
  align-self: stretch; display: flex; align-items: center; gap: 4px;
  border: none; background: none; color: #8a93a6; font-size: 12px; cursor: pointer;
  white-space: nowrap; padding: 0 2px;
}
.cs-goto:hover { color: #2e5bff }

/* transitions */
.cs-scale-enter-active, .cs-scale-leave-active { transition: all .18s ease }
.cs-scale-enter-from, .cs-scale-leave-to { opacity: 0; transform: scale(.6) }
.cs-pop-enter-active, .cs-pop-leave-active { transition: all .22s cubic-bezier(.2, .8, .3, 1.1); transform-origin: bottom right }
.cs-pop-enter-from, .cs-pop-leave-to { opacity: 0; transform: translateY(16px) scale(.94) }
</style>
