<template>
  <div class="chat-page">
    <!-- Header -->
    <div class="chat-header">
      <div class="chat-title">
        <span class="title-icon">💬</span>
        <h2>知识库智能问答</h2>
        <el-tag size="small" type="info">{{ domainLabel }}</el-tag>
      </div>
      <div class="chat-actions">
        <el-select v-model="domain" size="small" style="width: 140px" @change="clearChat">
          <el-option label="社会稳定风险评估" value="stability" />
          <el-option label="投标文件编写" value="bidding" />
        </el-select>
        <el-button size="small" text @click="clearChat" :disabled="!messages.length">
          🗑️ 清空对话
        </el-button>
      </div>
    </div>

    <!-- Messages -->
    <div class="chat-messages" ref="msgContainer">
      <!-- Welcome hint -->
      <div v-if="!messages.length" class="welcome">
        <div class="welcome-icon">🤖</div>
        <h3>你好！我是小拓智能体 🤖</h3>
        <p>我可以回答关于社会稳定风险评估、征地政策、补偿标准、报告编制等方面的问题</p>
        <div class="welcome-hints">
          <span class="hint-label">试试这些问题：</span>
          <el-tag
            v-for="q in sampleQuestions"
            :key="q"
            class="hint-tag"
            @click="sendMessage(q)"
          >{{ q }}</el-tag>
        </div>
      </div>

      <!-- Message bubbles -->
      <div
        v-for="(msg, idx) in messages"
        :key="idx"
        :class="['msg-row', msg.role]"
      >
        <div :class="['msg-bubble', msg.role]">
          <!-- Web search badge -->
          <div v-if="msg.webSearchUsed" class="msg-web-badge">
            🌐 已联网搜索
          </div>
          <!-- Learned badge -->
          <div v-if="msg.learnedNote" class="msg-learned-badge">
            🧠 {{ msg.learnedNote }}
          </div>
          <!-- Sources -->
          <div v-if="msg.sources && msg.sources.length" class="msg-sources">
            <span class="src-label">📚 参考来源：</span>
            <el-tag
              v-for="(s, si) in msg.sources"
              :key="si"
              size="small"
              type="info"
              class="src-tag"
            >{{ s.title }}</el-tag>
          </div>

          <!-- Content with markdown -->
          <div class="msg-content" v-html="renderMarkdown(msg.content)" />
          <!-- Learn button for review results -->
          <div v-if="msg.isReview && msg._canLearn" class="review-actions">
            <el-button size="small" type="success" @click="learnCurrentReport(msg)" :loading="isLoading">
              📚 学习此报告
            </el-button>
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div v-if="isLoading" class="msg-row assistant">
        <div class="msg-bubble assistant loading">
          <span class="loading-dot">●</span>
          <span class="loading-dot">●</span>
          <span class="loading-dot">●</span>
        </div>
      </div>
    </div>

    <!-- File attachments -->
    <div v-if="attachedFiles.length" class="chat-files">
      <div v-for="(f, i) in attachedFiles" :key="i" class="chat-file-tag">
        <span>{{ f.icon }}</span>
        <span class="chat-file-name">{{ f.name }}</span>
        <span class="chat-file-size">({{ f.textLen }}字)</span>
        <el-button text size="small" @click="attachedFiles.splice(i,1)">✕</el-button>
      </div>
    </div>

    <!-- Mode tabs -->
    <div class="chat-mode-tabs">
      <span :class="['mode-tab', { active: mode === 'chat' }]" @click="mode='chat'">💬 问答</span>
      <span :class="['mode-tab', { active: mode === 'review' }]" @click="mode='review'">🔍 审核</span>
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <input ref="fileInput" type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv,.jpg,.png,.jpeg" multiple
             style="display:none" @change="onFilesSelected" />
      <input ref="folderInput" type="file" webkitdirectory directory multiple
             style="display:none" @change="onFilesSelected" />
      <input ref="reportInput" type="file" accept=".docx,.doc,.pdf" style="display:none" @change="onReportFileSelected" />
      <template v-if="mode === 'review'">
        <el-button type="warning" text :disabled="isLoading" @click="$refs.reportInput.click()" title="上传报告审核">📋 上传报告</el-button>
        <el-input v-model="reportText" type="textarea" :rows="2" :autosize="{minRows:1,maxRows:4}" placeholder="或直接粘贴报告文本..." :disabled="isLoading" resize="none" @keydown.enter.exact.prevent="reviewReport" />
        <el-button type="warning" @click="reviewReport" :disabled="(!reportText.trim() || isLoading)" :loading="isLoading">审核</el-button>
      </template>
      <template v-else>
      <el-button text :disabled="isLoading" @click="$refs.fileInput.click()" title="上传文件">📎</el-button>
      <el-button text :disabled="isLoading" @click="$refs.folderInput.click()" title="上传文件夹">📁</el-button>
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        :placeholder="attachedFiles.length ? '输入问题（附件内容将自动附加）...' : '输入你的问题，按 Enter 发送...'"
        @keydown.enter.exact.prevent="sendCurrent"
        :disabled="isLoading"
        resize="none"
      />
      <el-button
        type="primary"
        :icon="Promotion"
        @click="sendCurrent"
        :disabled="(!inputText.trim() && !attachedFiles.length) || isLoading"
        :loading="isLoading"
      >
        发送
      </el-button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed, watch } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { marked } from 'marked'

// ── State ────────────────────────────────────────────────────────────────────
const mode = ref('chat')  // 'chat' | 'review'
const domain = ref('stability')
const messages = ref([])
const inputText = ref('')
const reportText = ref('')  // for review mode
let _abortController = null
const isLoading = ref(false)
const msgContainer = ref(null)
const attachedFiles = ref([])  // 🔴 {name, text, textLen, icon}
const MAX_FILE_TEXT = 8000  // Truncate per file

async function onFilesSelected(e) {
  const files = [...e.target.files]
  if (!files.length) return
  isLoading.value = true
  for (const file of files) {
    const icon = file.name.endsWith('.pdf') ? '📄' : file.name.endsWith('.docx')||file.name.endsWith('.doc') ? '📝'
      : /\.(jpg|png|jpeg|gif|webp)$/i.test(file.name) ? '🖼️' : '📎'
    try {
      const form = new FormData(); form.append('file', file)
      const r = await fetch('/api/knowledge/extract-file', { method: 'POST', body: form })
      const d = await r.json()
      const text = (d.data?.text || '').slice(0, MAX_FILE_TEXT)
      attachedFiles.value.push({ name: file.name, text, textLen: text.length, icon })
    } catch (err) {
      attachedFiles.value.push({ name: file.name, text: '', textLen: 0, icon, error: true })
    }
  }
  e.target.value = ''  // Reset so same file can be re-selected
  isLoading.value = false
}

// ── Report Review ──────────────────────────────────────────────────────────
async function onReportFileSelected(e) {
  const file = e.target.files[0]
  if (!file) return
  isLoading.value = true
  messages.value.push({ role: 'user', content: `📋 审核报告: ${file.name}`, sources: [] })
  const aiIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '', sources: [], isReview: true })
  await nextTick(); scrollToBottom()

  try {
    const form = new FormData(); form.append('file', file)
    const token = localStorage.getItem('zhongtuo_token') || ''
    const r = await fetch('/api/knowledge/review-report-file?domain=' + domain.value, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form,
    })
    const reader = r.body.getReader(); const decoder = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      let evt = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) evt = line.slice(7).trim()
        else if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6).trim())
            if (evt === 'review_result') { messages.value[aiIdx].content = d.summary || ''; messages.value[aiIdx].reviewData = d }
            else if (evt === 'done' && d.can_learn) { messages.value[aiIdx].learnedNote = '✅ 该报告可存入知识库'; messages.value[aiIdx]._canLearn = true; messages.value[aiIdx]._reportText = d.report_json ? JSON.parse(d.report_json) : null }
            else if (evt === 'error') { messages.value[aiIdx].content = `⚠️ ${d.message}` }
          } catch {}
        }
      }
    }
  } catch (err) { messages.value[aiIdx].content = `⚠️ 审核请求失败: ${err.message}` }
  isLoading.value = false; e.target.value = ''
}

async function reviewReport() {
  const text = reportText.value.trim()
  if (!text || isLoading.value) return
  reportText.value = ''
  isLoading.value = true
  messages.value.push({ role: 'user', content: '📋 审核报告文本', sources: [] })
  const aiIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '', sources: [], isReview: true })
  await nextTick(); scrollToBottom()

  try {
    const token = localStorage.getItem('zhongtuo_token') || ''
    const r = await fetch('/api/knowledge/review-report', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text, domain: domain.value }),
    })
    const reader = r.body.getReader(); const decoder = new TextDecoder(); let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n'); buf = lines.pop() || ''
      let evt = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) evt = line.slice(7).trim()
        else if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6).trim())
            if (evt === 'review_result') { messages.value[aiIdx].content = d.summary || ''; messages.value[aiIdx].reviewData = d }
            else if (evt === 'done' && d.can_learn) { messages.value[aiIdx].learnedNote = '✅ 该报告可存入知识库'; messages.value[aiIdx]._canLearn = true; messages.value[aiIdx]._reportText = text }
            else if (evt === 'error') { messages.value[aiIdx].content = `⚠️ ${d.message}` }
          } catch {}
        }
      }
    }
  } catch (err) { messages.value[aiIdx].content = `⚠️ 审核请求失败: ${err.message}` }
  isLoading.value = false
}

async function learnCurrentReport(msg) {
  if (!msg._canLearn || isLoading.value) return
  const text = msg._reportText
  if (!text && typeof text !== 'string') return
  isLoading.value = true
  try {
    const token = localStorage.getItem('zhongtuo_token') || ''
    const r = await fetch('/api/knowledge/learn-report', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text, domain: domain.value }),
    })
    const d = await r.json()
    if (d.code === 0) { msg.learnedNote = '✅ 报告已存入知识库'; msg._canLearn = false }
    else { msg.learnedNote = `⚠️ ${d.message}` }
  } catch (err) { msg.learnedNote = `⚠️ 学习失败: ${err.message}` }
  isLoading.value = false
}

// Persistent session for context memory
const sessionId = ref(localStorage.getItem('kb_chat_session') || generateSessionId())

// ── Computed ─────────────────────────────────────────────────────────────────
const domainLabel = computed(() => domain.value === 'stability' ? '稳评知识库' : '招标知识库')

const sampleQuestions = computed(() => {
  if (domain.value === 'stability') {
    return [
      '淮安市征地补偿标准是多少？',
      '社会稳定风险等级怎么划分？',
      '征地稳评报告包括哪些内容？',
      '被征地农民社保怎么办理？',
    ]
  }
  return [
    '投标文件的基本结构是什么？',
    '技术标书包含哪些内容？',
  ]
})

// ── Methods ───────────────────────────────────────────────────────────────────
function generateSessionId() {
  const id = 'kb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  localStorage.setItem('kb_chat_session', id)
  return id
}

function clearChat() {
  messages.value = []
  // Start a new session for fresh context
  sessionId.value = generateSessionId()
}

function sendMessage(text) {
  inputText.value = text
  sendCurrent()
}

async function sendCurrent() {
  const text = inputText.value.trim()
  const files = attachedFiles.value
  if (!text && !files.length || isLoading.value) return

  // Build message with file content
  let fullMessage = text
  if (files.length) {
    const fileTexts = files.map(f => `【附件：${f.name}】\n${f.text}`).join('\n\n')
    fullMessage = text ? `${text}\n\n${fileTexts}` : fileTexts
    attachedFiles.value = []  // Clear after sending
  }

  // Abort any in-flight request
  if (_abortController) { _abortController.abort(); _abortController = null }
  _abortController = new AbortController()

  inputText.value = ''

  // Add user message
  messages.value.push({ role: 'user', content: text || '(上传了文件)', sources: [] })

  // Add placeholder for AI response
  const aiIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '', sources: [], webSearchUsed: false })
  isLoading.value = true

  await nextTick()
  scrollToBottom()

  try {
    // Build history (excluding current AI placeholder)
    const history = messages.value
      .slice(0, -1)
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }))

    const token = localStorage.getItem('zhongtuo_token') || ''
    const response = await fetch('/api/knowledge/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: fullMessage,
        history: history.slice(-20),
        domain: domain.value,
        top_k: 5,
        session_id: sessionId.value,
      }),
      signal: _abortController?.signal,  // 🔴 Abortable SSE stream
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE events
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      let eventType = ''
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue

          try {
            const data = JSON.parse(dataStr)

            switch (eventType) {
              case 'thinking':
                // Update sources if retrieved
                if (data.sources && data.sources.length) {
                  messages.value[aiIdx].sources = data.sources
                }
                // Track web search status
                if (data.web_search) {
                  messages.value[aiIdx].webSearchUsed = true
                }
                break

              case 'content':
                // Append delta to AI message
                if (data.delta) {
                  messages.value[aiIdx].content += data.delta
                  await nextTick()
                  scrollToBottom()
                }
                break

              case 'done':
                // Finalize
                if (data.sources && data.sources.length) {
                  messages.value[aiIdx].sources = data.sources
                }
                if (data.web_search_used) {
                  messages.value[aiIdx].webSearchUsed = true
                }
                if (data.session_id) {
                  sessionId.value = data.session_id
                  localStorage.setItem('kb_chat_session', data.session_id)
                }
                break

              case 'learned':
                // Show learning feedback
                if (data.message) {
                  messages.value[aiIdx].learnedNote = data.message
                }
                break

              case 'review_result':
                // Render the structured review report
                messages.value[aiIdx].content = data.summary || renderReviewMarkdown(data)
                messages.value[aiIdx].reviewData = data
                messages.value[aiIdx].isReview = true
                await nextTick(); scrollToBottom()
                break

              case 'error':
                messages.value[aiIdx].content = `⚠️ ${data.message}`
                break
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      messages.value[aiIdx].content = `⚠️ 请求失败: ${err.message}`
    }
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function scrollToBottom() {
  if (msgContainer.value) {
    msgContainer.value.scrollTop = msgContainer.value.scrollHeight
  }
}

function renderMarkdown(text) {
  if (!text) return ''
  try {
    return marked.parse(text, { breaks: true })
  } catch {
    return text.replace(/\n/g, '<br>')
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 136px);
  max-width: 900px;
  margin: 0 auto;
}

/* Header */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #fff;
  border-radius: 12px 12px 0 0;
  border-bottom: 1px solid #ebeef5;
}
.chat-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.chat-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.title-icon { font-size: 24px; }
.chat-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Messages area */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafbfc;
  scroll-behavior: smooth;
}

/* Welcome */
.welcome {
  text-align: center;
  padding: 60px 20px;
}
.welcome-icon { font-size: 56px; margin-bottom: 16px; }
.welcome h3 { font-size: 20px; color: #303133; margin: 0 0 8px; }
.welcome p { color: #909399; margin: 0 0 24px; }
.welcome-hints { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.hint-label { width: 100%; font-size: 13px; color: #909399; margin-bottom: 4px; }
.hint-tag { cursor: pointer; transition: all .2s; }
.hint-tag:hover { background: #ecf5ff; color: #409eff; border-color: #409eff; }

/* Message rows */
.msg-row {
  display: flex;
  margin-bottom: 16px;
}
.msg-row.user { justify-content: flex-end; }
.msg-row.assistant { justify-content: flex-start; }

.msg-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.7;
  word-break: break-word;
}
.msg-bubble.user {
  background: #409eff;
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg-bubble.assistant {
  background: #fff;
  color: #303133;
  border: 1px solid #e4e7ed;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}

/* Sources */
.msg-sources {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #e4e7ed;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.src-label { font-size: 12px; color: #909399; }
.src-tag { font-size: 11px; }

/* Badges */
.msg-web-badge {
  font-size: 11px;
  color: #67c23a;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.msg-learned-badge {
  font-size: 11px;
  color: #e6a23c;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Loading dots */
.msg-bubble.loading {
  padding: 12px 24px;
  display: flex;
  gap: 6px;
}
.loading-dot {
  font-size: 12px;
  animation: blink 1.4s infinite both;
}
.loading-dot:nth-child(2) { animation-delay: .2s; }
.loading-dot:nth-child(3) { animation-delay: .4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}

/* Markdown content */
.msg-content :deep(p) { margin: 0 0 8px; }
.msg-content :deep(p:last-child) { margin-bottom: 0; }
.msg-content :deep(strong) { font-weight: 600; }
.msg-content :deep(ul), .msg-content :deep(ol) { margin: 4px 0; padding-left: 20px; }
.msg-content :deep(li) { margin-bottom: 2px; }
.msg-content :deep(code) {
  background: #f0f2f5;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}
.msg-content :deep(pre) {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 8px 0;
}
.msg-content :deep(pre code) { background: none; padding: 0; }

/* Input area */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 0 0 12px 12px;
  border-top: 1px solid #ebeef5;
}
.chat-input-area :deep(.el-textarea__inner) {
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.6;
}
</style>
