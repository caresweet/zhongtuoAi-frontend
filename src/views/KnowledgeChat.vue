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

    <!-- Input -->
    <div class="chat-input-area">
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        placeholder="输入你的问题，按 Enter 发送..."
        @keydown.enter.exact.prevent="sendCurrent"
        :disabled="isLoading"
        resize="none"
      />
      <el-button
        type="primary"
        :icon="Promotion"
        @click="sendCurrent"
        :disabled="!inputText.trim() || isLoading"
        :loading="isLoading"
      >
        发送
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed, watch } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { marked } from 'marked'

// ── State ────────────────────────────────────────────────────────────────────
const domain = ref('stability')
const messages = ref([])
const inputText = ref('')
const isLoading = ref(false)
const msgContainer = ref(null)
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
  if (!text || isLoading.value) return

  inputText.value = ''

  // Add user message
  messages.value.push({ role: 'user', content: text, sources: [] })

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
        message: text,
        history: history.slice(-20),
        domain: domain.value,
        top_k: 5,
        session_id: sessionId.value,
      }),
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
    messages.value[aiIdx].content = `⚠️ 请求失败: ${err.message}`
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
