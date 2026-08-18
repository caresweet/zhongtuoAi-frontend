/**
 * Report Generation Store — RAG + LangGraph chapter-by-chapter streaming.
 *
 * Replaces the old template-fill-in-the-blanks store.
 * Manages: project setup, chapter generation, streaming content, user feedback.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElNotification } from 'element-plus'
import * as api from '@/api/report'
import { useAgentStatusStore } from '@/stores/useAgentStatus'
import { useStepWizardStore } from '@/stores/useStepWizard'
import { useChapterStore } from '@/stores/chapter'

let _msgIdCounter = 0
function _nextMsgId() { return ++_msgIdCounter }

// Message history cap — prevent unbounded memory growth
const _MAX_MESSAGES = 100
function _trimMessages(msgs) {
  if (msgs.length > _MAX_MESSAGES) {
    return msgs.slice(-_MAX_MESSAGES)
  }
  return msgs
}

export const useReportStore = defineStore('report', () => {
  // ---- Session ----
  const sessionId = ref(null)
  const reportTitle = ref('')
  const templateId = ref(0)
  const templateName = ref('')
  const phase = ref('idle') // idle | setup | collecting | reviewing | assembling | complete
  const status = ref('idle')
  const error = ref(null)
  const useMasterAgent = ref(true)  // Master Agent mode enabled by default
  const generationMode = ref('chat')  // 'chat' | 'chapter_by_chapter'
  const selectedDomain = ref('')      // stability | bidding

  // ---- Chapter-by-Chapter Review State ----
  const chapterReviewPending = ref(false)
  const currentReviewChapter = ref(0)
  const approvingChapter = ref(false)
  const revisingChapter = ref(false)
  const skippingChapter = ref(false)

  // ---- Chapters ----
  const chapters = ref({})       // {1: {title, status, markdown, tables, sources, revisionCount}}
  const currentChapter = ref(1)

  // ---- Template Placeholders & Filled Data (for DataProgress sidebar) ----
  const templatePlaceholders = ref([])   // [{key, display_name, section_title, expected_type, ...}]
  const filledData = ref({})             // {placeholder_key: value}

  // ---- Material analysis ----
  const materialSummary = ref(null)
  const outline = ref(null)

  // ---- Streaming ----
  const streamingContent = ref('')  // Currently streaming chapter delta
  const isStreaming = ref(false)
  const thinkingLog = ref([])       // AI thinking messages (agent steps)
  const statusMessage = ref('')     // 🔴 Current status for progress display
  const statusPhase = ref('')       // Current phase label
  const progressSteps = ref([])     // 🔴 Step progress with timing
  const totalElapsed = ref(0)       // 🔴 Total elapsed time
  const llmReasoning = ref('')      // Accumulated LLM chain-of-thought reasoning (DeepSeek-style)
  const isReasoning = ref(false)    // Whether LLM is currently streaming reasoning
  const collectingPrompt = ref(null)  // Current collect question

  // ---- Chat ----
  const messages = ref([])          // Conversation history

  // ---- Output ----
  const generatedReportId = ref(null)
  const downloadUrl = ref('')

  // ---- Quality Report (Test Skill: T1-T4) ----
  const qualityReport = ref(null)  // { overall_score, overall_grade, dimensions[], recommendations[] }

  // ---- Field Analysis (Product Skill: A/B/C/D/E) ----
  const fieldAnalysis = ref(null)  // { fields[], summary{}, questions[] }

  // ---- Section Form Mode ----
  const sectionFormData = ref(null)   // Current section batch: {section_title, progress, questions[]}
  const sectionsCompleted = ref(0)
  const sectionsTotal = ref(0)

  // ---- Computed ----
  const isGenerating = computed(() =>
    ['generating', 'reviewing', 'assembling'].includes(phase.value)
  )

  const approvedCount = computed(() =>
    Object.values(chapters.value).filter(ch => ch.status === 'approved').length
  )

  const _totalChaptersOverride = ref(0)  // 🔴 Set by backend poll (total_chapters)
  const totalChapters = computed(() => _totalChaptersOverride.value || outline.value?.total || outline.value?.chapters?.length || progressSteps.value.find(s => s.key === 'generation')?.total || 0)


  const canSendMessage = computed(() =>
    !isStreaming.value && ['setup', 'collecting', 'reviewing', 'outline_review', 'chapter_review', 'chapter_generation', 'outline_generation', 'analysis', 'analysis_review', 'integration', 'quality_review', 'review_table', 'assembling'].includes(phase.value)
  )

  const canInput = computed(() =>
    ['setup', 'collecting', 'reviewing', 'outline_review', 'chapter_review', 'chapter_generation', 'outline_generation', 'analysis', 'analysis_review', 'integration', 'quality_review', 'review_table', 'assembling'].includes(phase.value) && !isStreaming.value
  )

  /** Current question's placeholder type, for ChatInput mode switching. */
  const chatPlaceholderType = computed(() => {
    // In Master Agent mode, always enable image upload alongside text
    if (useMasterAgent.value) return 'text_image'
    const cp = collectingPrompt.value
    if (cp && typeof cp === 'object') {
      return cp.placeholderType || 'text'
    }
    return 'text'
  })

  const totalPlaceholders = ref(0)
  const filledPlaceholders = ref(0)
  const fillPercent = computed(() => {
    if (totalPlaceholders.value === 0) return 0
    return Math.round((filledPlaceholders.value / totalPlaceholders.value) * 100)
  })

  const collectingPromptText = computed(() => {
    const cp = collectingPrompt.value
    if (!cp) return ''
    if (typeof cp === 'string') return cp
    if (cp.question) return `[${cp.sectionTitle || ''}] ${cp.question}`
    return ''
  })

  // ---- WebSocket ----
  let _ws = null
  let _wsReconnectTimer = null
  let _wsReconnectAttempts = 0
  const _WS_MAX_RECONNECT_ATTEMPTS = 10
  const _wsReady = ref(false)  // Exposed so AssistantView knows not to double-send via SSE

  function wsConnect() {
    if (!sessionId.value) return
    if (_ws && _ws.readyState === WebSocket.OPEN) return

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = import.meta.env.DEV ? 'localhost:8000' : location.host
    const url = `${protocol}//${host}/api/v1/reports/ws/${sessionId.value}`
    _ws = new WebSocket(url)

    _ws.onopen = () => {
      console.log('[WS] connected')
      _wsReady.value = true
      _wsReconnectAttempts = 0  // Reset on successful connection
      if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null }
    }

    _ws.onmessage = (evt) => {
      try {
        const { event, data } = JSON.parse(evt.data)
        switch (event) {
          case 'stream':
            // Sentence-level streaming — accumulate, DON'T push to messages yet
            // (AssistantView streamingContent watcher handles rendering)
            streamingContent.value += (data.delta || '')
            isStreaming.value = true
            break
          case 'done':
            // Streaming complete — finalize with full text from backend
            if (data.text) {
              if (messages.value.length > 0) {
                const last = messages.value[messages.value.length - 1]
                if (last.role === 'agent' && last.content !== data.text) {
                  last.content = data.text
                }
              }
              // If no agent message was pushed during streaming, push now
              if (!messages.value.length || messages.value[messages.value.length - 1].role !== 'agent') {
                messages.value.push({
                  id: _nextMsgId(), role: 'agent', content: data.text,
                  messageType: data.message_type || 'text', timestamp: new Date().toISOString(),
                })
              }
            }
            streamingContent.value = ''
            isStreaming.value = false
            break
          case 'thinking':
            thinkingLog.value.push({ content: data.content, complete: true, type: 'step' })
            break
          case 'message':
            if (data.content) {
              messages.value.push({
                id: _nextMsgId(), role: 'agent', content: data.content,
                messageType: 'text', timestamp: new Date().toISOString(),
              })
            }
            isStreaming.value = false
            break
          case 'error':
            messages.value.push({
              id: _nextMsgId(), role: 'system', content: '❌ ' + (data.message || '未知错误'),
              messageType: 'error', timestamp: new Date().toISOString(),
            })
            isStreaming.value = false
            break
          // Forward other events to existing SSE handlers
          default:
            if (event && data) handleSSEEvent(event, data)
        }
      } catch (e) { console.error('[WS] parse error:', e) }
    }

    _ws.onclose = () => {
      console.log('[WS] disconnected')
      _wsReady.value = false
      _ws = null
      // Auto-reconnect with exponential backoff (max 10 attempts)
      if (_wsReconnectAttempts < _WS_MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(1000 * Math.pow(2, _wsReconnectAttempts), 30000)
        _wsReconnectAttempts++
        console.log(`[WS] reconnect attempt ${_wsReconnectAttempts}/${_WS_MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)
        _wsReconnectTimer = setTimeout(() => wsConnect(), delay)
      } else {
        console.log('[WS] max reconnect attempts reached, giving up')
      }
    }

    _ws.onerror = (e) => { console.error('[WS] error:', e) }
  }

  function wsDisconnect() {
    if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null }
    _wsReconnectAttempts = _WS_MAX_RECONNECT_ATTEMPTS  // Prevent further reconnects
    if (_ws) { _ws.close(); _ws = null }
  }

  function wsSend(type, payload = {}) {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) {
      wsConnect()
      // Queue for after connect — only if WS was just created
      let waitCount = 0
      const _trySend = () => {
        if (_ws && _ws.readyState === WebSocket.OPEN) {
          _ws.send(JSON.stringify({ type, ...payload }))
        } else if (waitCount < 10) {
          waitCount++
          setTimeout(_trySend, 300)
        } else {
          console.error('[WS] failed to send after 3s, giving up')
        }
      }
      setTimeout(_trySend, 300)
      return
    }
    _ws.send(JSON.stringify({ type, ...payload }))
  }

  // ---- Actions ----

  function setSelectedDomain(domain) {
    selectedDomain.value = domain || ''
  }

  /**
   * Start a new report generation session.
   * @param {string} initialMessage - User's project description.
   */
  async function startGeneration(initialMessage, tplId, tplName, intent = '', domain = '') {
    resetState()
    selectedDomain.value = domain || intent || selectedDomain.value || ''
    phase.value = 'setup'
    status.value = 'setup'
    templateId.value = tplId || 0
    templateName.value = tplName || '默认模板'

    try {
      const res = await api.startGeneration(templateId.value, initialMessage, intent, selectedDomain.value)
      const data = res.data

      sessionId.value = data.session_id
      wsConnect()  // Establish WebSocket on session start
      selectedDomain.value = data.domain || selectedDomain.value
      status.value = data.status || 'setup'
      phase.value = 'setup'
      reportTitle.value = ''  // Will be set when user provides the actual title
      templateName.value = data.template_name || templateName.value

      // Add agent's first message
      if (data.agent_message) {
        messages.value.push({
          id: _nextMsgId(),
          role: 'agent',
          content: data.agent_message,
          messageType: 'text',
          timestamp: new Date().toISOString(),
        })
      }
    } catch (e) {
      error.value = e.response?.data?.detail || e.message || '启动生成失败'
      phase.value = 'idle'
      status.value = 'error'
      ElNotification({ title: '启动失败', message: error.value, type: 'error' })
    }
  }

  // 🔴 AbortController for cancelling in-flight SSE requests
  let _abortController = null

  /**
   * Shared SSE stream reader — parses event: + data: lines from a ReadableStream.
   * Avoids duplicating the buffer/decoder/parser logic across sendMessage/generateReport.
   */
  async function _readSSEStream(response, signal) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        let currentEvent = ''
        for (const line of lines) {
          if (signal?.aborted) return
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6)
            try {
              const data = JSON.parse(dataStr)
              handleSSEEvent(currentEvent, data)
            } catch {
              // Malformed JSON at buffer boundary — skip, will be re-emitted next chunk
            }
          }
        }
      }
    } finally {
      // Release reader if cancelled mid-stream
      try { reader.releaseLock() } catch {}
    }
  }

  /**
   * Send a user message (project info or chapter feedback).
   * Opens SSE stream for chapter generation.
   * @param {string} text - User message text.
   * @param {Array<string>|null} attachments - Optional uploaded file_paths.
   * @param {number|null} currentStep - Optional StepWizard current step (1-12).
   * @param {Array<object>|null} imageMetas - Optional [{path, url, name}] for chat display.
   */
  async function sendMessage(text, attachments = null, currentStep = null, imageMetas = null, folderStructure = null, intent = '') {
    // 🔴 Abort any in-flight request before starting a new one
    if (_abortController) {
      _abortController.abort()
      _abortController = null
    }
    _abortController = new AbortController()

    if (!sessionId.value) {
      // 🔴 Auto-recover: try to create a new session
      try {
        const res = await api.startGeneration(0, text || '你好', intent, selectedDomain.value || intent)
        const data = res.data
        sessionId.value = data.session_id
        selectedDomain.value = data.domain || selectedDomain.value || intent
        status.value = data.status || 'setup'
        phase.value = 'setup'
        templateName.value = data.template_name || ''
        if (data.agent_message) {
          messages.value.push({
            id: _nextMsgId(), role: 'agent', content: data.agent_message,
            messageType: 'text', timestamp: new Date().toISOString(),
          })
        }
        // Retry the message after session creation
        if (!text) {
          isStreaming.value = false
          return
        }
      } catch (_) {
        const errMsg = '会话未初始化，请刷新页面后重试。'
        error.value = errMsg
        messages.value.push({
          id: _nextMsgId(), role: 'system',
          content: `❌ ${errMsg}`, messageType: 'error',
          timestamp: new Date().toISOString(),
        })
        ElNotification({ title: '发送失败', message: errMsg, type: 'error', duration: 6000 })
        return
      }
    }

    isStreaming.value = true
    streamingContent.value = ''
    thinkingLog.value = []

    // Clear the current question prompt while waiting for the next one,
    // so the old question doesn't appear to "persist" across submissions.
    collectingPrompt.value = null
    // Build user message with optional image previews
    const userMsg = {
      id: _nextMsgId(),
      role: 'user',
      content: text || (attachments?.length ? `[上传了 ${attachments.length} 张图片]` : ''),
      messageType: attachments?.length ? 'text_image' : 'text',
      timestamp: new Date().toISOString(),
    }
    // Use imageMetas if provided (has correct URLs from upload response),
    // otherwise fall back to constructing from attachment paths
    if (imageMetas?.length) {
      userMsg.images = imageMetas.map(m => ({
        path: m.path,
        url: m.url,
        name: m.name || m.path?.split('/').pop() || '图片',
      }))
    } else if (attachments?.length) {
      userMsg.images = attachments.map(p => ({
        path: p,
        url: '',
        name: p.split('/').pop() || p,
      }))
    }
    messages.value.push(userMsg)

    try {
      const response = await api.sendChatMessage(sessionId.value, text, attachments, currentStep, folderStructure, _abortController?.signal, intent || selectedDomain.value, selectedDomain.value || intent)

      // 🔴 Handle session loss: backend --reload wipes in-memory sessions.
      // The fetch returns a 404 JSON body, not an SSE stream.
      if (!response.ok) {
        let detail = ''
        try {
          const errBody = await response.json()
          detail = errBody.detail || ''
        } catch (_) { /* body may not be JSON */ }
        if (response.status === 404) {
          throw new Error('SESSION_LOST')
        }
        throw new Error(detail || `服务器错误 (${response.status})`)
      }

      await _readSSEStream(response, _abortController?.signal)
    } catch (e) {
      if (e.name !== 'AbortError') {
        // 🔴 Handle session loss (backend --reload wipes in-memory sessions)
        if (e.message === 'SESSION_LOST') {
          const errMsg = '后端服务已重启，会话已过期。请刷新页面后重新开始。'
          error.value = errMsg
          phase.value = 'idle'
          status.value = 'idle'
          sessionId.value = null
          messages.value.push({
            id: _nextMsgId(),
            role: 'system',
            content: `🔄 ${errMsg}`,
            messageType: 'error',
            timestamp: new Date().toISOString(),
          })
          ElNotification({ title: '会话已过期', message: '请点击"重新开始"按钮或刷新页面', type: 'warning', duration: 8000 })
        } else {
          error.value = e.message || '通信失败'
          messages.value.push({
            id: _nextMsgId(),
            role: 'system',
            content: `通信错误: ${error.value}`,
            messageType: 'error',
            timestamp: new Date().toISOString(),
          })
        }
      }
    } finally {
      isStreaming.value = false
      streamingContent.value = ''
    }
  }

  /**
   * Handle incoming SSE events.
   */
  function handleSSEEvent(event, data) {
    switch (event) {
      case 'status_change':
        status.value = data.status
        if (data.status === 'generating') phase.value = 'generating'
        if (data.status === 'completed') phase.value = 'complete'
        break

      case 'step_progress': {
        // Progress tracking with timing — emitted by orchestrator at each step
        const steps = data.timings || {}
        const prevSteps = progressSteps.value || []
        progressSteps.value = [
          { key: 'analysis', label: '分析资料', elapsed: steps.analysis || 0, done: !!steps.analysis },
          { key: 'outline', label: '生成大纲', elapsed: steps.outline || 0, done: !!steps.outline },
          { key: 'fixed_data', label: '公司数据', elapsed: steps.fixed_data || 0, done: !!steps.fixed_data },
          { key: 'knowledge', label: '知识库', elapsed: steps.knowledge || 0, done: !!steps.knowledge },
          { key: 'generation', label: '逐章生成', elapsed: steps.generation || 0, done: !!steps.generation },
          { key: 'quality', label: '质量审核', elapsed: steps.quality || 0, done: !!steps.quality },
          { key: 'assembly', label: '组装报告', elapsed: steps.assembly || 0, done: !!steps.assembly },
        ]
        // Set active on current step; preserve active on previously active steps
        const cur = progressSteps.value.find(s => s.key === data.step)
        if (cur) cur.active = data.status === 'running'
        // Preserve active state from previous render for steps not in this event
        for (const prev of prevSteps) {
          if (prev.active && prev.key !== data.step) {
            const s = progressSteps.value.find(x => x.key === prev.key)
            if (s) s.active = true
          }
        }
        if (data.message) statusMessage.value = data.message
        if (data.total_elapsed) totalElapsed.value = data.total_elapsed
        break
      }

      case 'phase_change':
        phase.value = data.phase
        if (data.phase === 'analysis') {
          materialSummary.value = {
            ...(materialSummary.value || {}),
            ...data,
          }
        }
        // Update status message — prefer event message, fall back to defaults
        if (data.message) {
          statusMessage.value = data.message
        } else if (data.phase === 'analysis' || data.phase === 'outline_generation') {
          statusMessage.value = '正在分析上传的资料，提取关键数据...'
          statusPhase.value = '资料分析'
        } else if (data.phase === 'chapter_generation') {
          statusMessage.value = '正在逐章生成报告...'
          statusPhase.value = '生成中'
        } else if (data.phase === 'quality_review') {
          statusMessage.value = '正在跨章节质量审核...'
          statusPhase.value = '审核中'
        } else if (data.phase === 'review_table') {
          statusMessage.value = '正在生成评审表...'
          statusPhase.value = '评审表'
        }
        // Sync review state with wizard store
        if (data.phase === 'reviewing') {
          useStepWizardStore().setNeedsReview(true)
        } else if (data.phase === 'collecting') {
          useStepWizardStore().setNeedsReview(false)
        }
        break

      case 'chapter_start':
        currentChapter.value = data.chapter
        streamingContent.value = ''
        statusMessage.value = `正在编写第${data.chapter}章「${data.title || ''}」...`
        statusPhase.value = `第${data.chapter}章`
        chapters.value[data.chapter] = {
          number: data.chapter,
          title: data.title || `第${data.chapter}章`,
          status: 'generating',
          markdown: '',
          tables: [],
          sources: [],
          revisionCount: 0,
        }
        break

      case 'chapter_stream':
        streamingContent.value += data.delta || ''
        if (chapters.value[data.chapter]) {
          chapters.value[data.chapter].markdown += data.delta || ''
        }
        break

      case 'chapter_complete':
        if (chapters.value[data.chapter]) {
          chapters.value[data.chapter].status = 'review'
          chapters.value[data.chapter].tables = data.tables || []
          chapters.value[data.chapter].sources = data.sources || []
        }
        streamingContent.value = ''
        break

      case 'thinking':
        // Mark previous thinking stream as complete
        if (thinkingLog.value.length > 0) {
          thinkingLog.value[thinkingLog.value.length - 1].complete = true
        }
        thinkingLog.value.push({ content: data.content, timestamp: Date.now(), complete: true, type: 'step' })
        // Show thinking as live status message
        if (data.content && !data.content.startsWith('⏳')) {
          statusMessage.value = data.content
        }
        break

      case 'thinking_stream':
        // Check source: "llm" = DeepSeek chain-of-thought, "agent" = agent step thinking
        if (data.source === 'llm') {
          // LLM reasoning stream — accumulate separately
          if (!isReasoning.value) isReasoning.value = true
          llmReasoning.value += data.delta || ''
        } else {
          // Agent step thinking (existing behavior)
          if (thinkingLog.value.length > 0) {
            const last = thinkingLog.value[thinkingLog.value.length - 1]
            if (last && !last.complete) {
              last.content += data.delta || ''
            } else {
              thinkingLog.value.push({ content: data.delta || '', timestamp: Date.now(), complete: false, type: 'step' })
            }
          } else {
            thinkingLog.value.push({ content: data.delta || '', timestamp: Date.now(), complete: false, type: 'step' })
          }
        }
        break

      case 'reasoning_start':
        // LLM chain-of-thought reasoning block begins (DeepSeek-style)
        llmReasoning.value = ''
        isReasoning.value = true
        break

      case 'reasoning_end':
        // LLM chain-of-thought reasoning block ends
        isReasoning.value = false
        break

      case 'collecting_question':
        // Store current section-by-section question for sidebar + ChatInput
        if (data.question && data.section_title) {
          collectingPrompt.value = {
            question: data.question,
            sectionTitle: data.section_title,
            progress: data.progress || '',
            placeholderType: data.placeholder_type || 'text',
            imageRequired: data.image_required || false,
          }
          // Also push the question as a chat message so user can see it
          const qMsg = {
            id: _nextMsgId(),
            role: 'agent',
            content: `**[${data.progress}] ${data.section_title}**\n\n${data.question}`,
            messageType: 'collecting_question',
            timestamp: new Date().toISOString(),
          }
          // Attach accumulated thinking
          if (thinkingLog.value.length > 0) {
            qMsg.thinking = [...thinkingLog.value]
            thinkingLog.value = []
          }
          messages.value.push(qMsg)
        }
        break

      case 'placeholder_filled':
        if (data.location && data.new_value) {
          const oldShort = data.old_value
            ? (data.old_value.length > 40 ? data.old_value.substring(0, 37) + '...' : data.old_value)
            : '空白'
          const newShort = data.new_value.length > 40
            ? data.new_value.substring(0, 37) + '...'
            : data.new_value
          thinkingLog.value.push({
            content: `${data.location}：${oldShort} → ${newShort}`,
            timestamp: Date.now(),
            complete: true,
            type: 'fill',
          })
        }
        break

      case 'rag_results':
        if (chapters.value[data.chapter]) {
          chapters.value[data.chapter].sources = data.sources || []
        }
        break

      case 'revision_diff':
        if (chapters.value[data.chapter]) {
          chapters.value[data.chapter].diff = {
            old: data.old,
            new: data.new,
            description: data.change_description,
          }
        }
        break

      case 'material_analysis_complete':
        materialSummary.value = data
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: `📎 **资料解析完成**\n\n已完成 ${data.completed_files || 0}/${data.total_files || 0} 个文件解析。`
            + ((data.missing_fields || []).length
              ? `\n建议补充：${(data.missing_fields || []).join('、')}`
              : '\n可开始生成报告。'),
          messageType: 'system_event',
          metadata: data,
          timestamp: new Date().toISOString(),
        })
        break

      case 'message':
        if (data.content) {
          const msg = {
            id: _nextMsgId(),
            role: data.role || 'agent',
            content: data.content,
            messageType: data.message_type || 'text',
            metadata: data,
            timestamp: new Date().toISOString(),
          }
          // ---- Attach LLM chain-of-thought reasoning (DeepSeek-style) ----
          if (llmReasoning.value && !isReasoning.value) {
            msg.reasoning = llmReasoning.value
            llmReasoning.value = ''
          }
          // Attach thinking log to fill_summary messages
          if (data.message_type === 'fill_summary' && thinkingLog.value.length > 0) {
            msg.thinking = [...thinkingLog.value]
            thinkingLog.value = []
          }
          // Store collecting prompt for inline display
          if (data.message_type === 'collecting_prompt') {
            collectingPrompt.value = typeof data.content === 'string'
              ? data.content
              : { question: data.content, sectionTitle: '', progress: '', placeholderType: 'text', imageRequired: false }
            // Attach any accumulated thinking
            if (thinkingLog.value.length > 0) {
              msg.thinking = [...thinkingLog.value]
              thinkingLog.value = []
            }
            // Also attach LLM reasoning
            if (llmReasoning.value && !isReasoning.value) {
              msg.reasoning = llmReasoning.value
              llmReasoning.value = ''
            }
          }
          messages.value.push(msg)
        }
        if (data.message_type === 'chapter_presentation') {
          phase.value = 'reviewing'
        }
        break

      case 'progress':
        break

      case 'complete':
        phase.value = 'complete'
        status.value = 'completed'
        generatedReportId.value = data.report_id
        downloadUrl.value = data.download_url
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: data.message || '报告生成成功！',
          messageType: 'system_event',
          timestamp: new Date().toISOString(),
        })
        thinkingLog.value = []
        ElNotification({
          title: '报告生成成功',
          message: '您可以下载报告或查看历史记录',
          type: 'success',
          duration: 5000,
        })
        break

      case 'cancelled':
        // Backend confirmed cancellation — update UI
        phase.value = 'setup'
        isStreaming.value = false
        streamingContent.value = ''
        thinkingLog.value = []
        chapterReviewPending.value = false
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: data.message || '⏹️ 生成已停止',
          messageType: 'warning',
          timestamp: new Date().toISOString(),
        })
        break

      case 'error':
        error.value = data.message
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: ` ${data.message}`,
          messageType: 'error',
          timestamp: new Date().toISOString(),
        })
        if (!data.recoverable) {
          status.value = 'failed'
        }
        break

      // ---- Section Form Mode Events ----
      case 'section_questions':
        // Batch section questions for form-based filling
        if (data.section_title && data.questions) {
          sectionFormData.value = data
          const match = data.progress?.match(/(\d+)\/(\d+)/)
          if (match) {
            sectionsCompleted.value = parseInt(match[1]) - 1
            sectionsTotal.value = parseInt(match[2])
          }
          // Push a summary message so the chat shows context
          messages.value.push({
            id: _nextMsgId(),
            role: 'agent',
            content: `**[${data.progress}] ${data.section_title}**\n\n_共 ${data.total_in_section} 个字段需要填写_`,
            messageType: 'section_batch',
            timestamp: new Date().toISOString(),
          })
        }
        break

      case 'section_answers_confirmed':
        // Section batch submitted, move to next section (or finish)
        sectionsCompleted.value = (sectionsCompleted.value || 0) + 1
        if (data.next_section) {
          sectionFormData.value = data.next_section
          const match = data.next_section.progress?.match(/(\d+)\/(\d+)/)
          if (match) {
            sectionsTotal.value = parseInt(match[2])
          }
          messages.value.push({
            id: _nextMsgId(),
            role: 'agent',
            content: `**[${data.next_section.progress}] ${data.next_section.section_title}**\n\n_共 ${data.next_section.total_in_section} 个字段需要填写_`,
            messageType: 'section_batch',
            timestamp: new Date().toISOString(),
          })
        } else {
          sectionFormData.value = null
          messages.value.push({
            id: _nextMsgId(),
            role: 'system',
            content: '✅ 所有章节内容已收集完毕！回复「生成报告」开始逐章生成报告（每章可确认/修改）。',
            messageType: 'system_event',
            timestamp: new Date().toISOString(),
          })
        }
        break

      // ---- Multi-Agent Events ----
      case 'agent_status':
      case 'thinking':
        // Forward to AgentStatusBar via useAgentStatusStore
        useAgentStatusStore().handleAgentSSE(event, data)
        if (event === 'agent_status') break
        // For 'thinking' events, also display in thinkingLog (fall through to thinking handling above)
        // Already handled above, so just break
        break

      case 'step_transition':
        // Forward to AgentStatusBar
        useAgentStatusStore().handleAgentSSE(event, data)
        if (data.step) {
          // Update local collecting prompt with step info
          collectingPrompt.value = {
            question: `步骤${data.step}/12: ${data.label || ''}`,
            sectionTitle: data.label || '',
            progress: `${data.step}/12`,
            placeholderType: data.needs_review ? 'text' : 'text',
            imageRequired: false,
          }
        }
        break

      case 'step_progress_sync':
        // Update fill progress for sidebar
        if (data.total_placeholders) totalPlaceholders.value = data.total_placeholders
        if (data.filled_placeholders !== undefined) filledPlaceholders.value = data.filled_placeholders
        // Update placeholder list for DataProgress sidebar
        if (data.placeholders) {
          templatePlaceholders.value = data.placeholders
        }
        if (data.filled_data) {
          filledData.value = { ...filledData.value, ...data.filled_data }
        }
        break

      case 'data_preview':
        // Store data preview for StepWizard to display
        break

      case 'analysis_result':
        // Push AI-generated analysis content as a chat message
        if (data.content) {
          const labelMap = {
            legality: '合法性分析',
            rationality: '合理性分析',
            feasibility: '可行性分析',
            controllability: '可控性分析',
            risk_scores: '风险等级量化评分',
            risk_factor_table: '风险因素初始等级表',
            mitigation_measures: '风险防范与化解措施',
            post_measure_scores: '措施后风险等级评分',
            conclusion: '评估结论',
            recommendations: '实施建议',
            final_summary: '完整汇总表',
          }
          const sectionLabel = labelMap[data.section] || data.section || '分析结果'
          messages.value.push({
            id: _nextMsgId(),
            role: 'agent',
            content: `## 📊 ${sectionLabel}\n\n${data.content}`,
            messageType: 'analysis_result',
            metadata: { section: data.section },
            timestamp: new Date().toISOString(),
          })
        }
        break

      case 'validation_result':
        // Report format validation results (including T1-T4 quality from test skill)
        if (data.summary) {
          // Try to parse T1-T4 quality data from extended validation
          if (data.overall_score !== undefined) {
            qualityReport.value = {
              overall_score: data.overall_score || 0,
              overall_grade: data.overall_grade || 'N/A',
              passed: data.passed !== undefined ? data.passed : false,
              summary: data.summary || '',
              details: data.details || '',
              dimensions: data.dimensions || [],
              recommendations: data.recommendations || [],
            }
          }
          messages.value.push({
            id: _nextMsgId(),
            role: 'system',
            content: `**📋 格式验证结果**：${data.summary}\n\n${data.details || ''}`,
            messageType: 'system_event',
            timestamp: new Date().toISOString(),
          })
        }
        break

      // ═══════════════════════════════════════════════════════
      // Chapter-by-Chapter Generation Events
      // ═══════════════════════════════════════════════════════

      case 'outline_generated':
        // Outline has been generated from user materials
        outline.value = data
        phase.value = 'outline_review'
        // 🔴 Update generation step with chapter total
        const genStep2 = progressSteps.value.find(s => s.key === 'generation')
        if (genStep2 && data.total) genStep2.total = data.total
        if (useChapterStore) {
          const chStore = useChapterStore()
          chStore.phase = 'outline_review'
          // Initialize chapter statuses from outline data
          if (data.chapters) {
            data.chapters.forEach(ch => {
              chStore.chapters[ch.number - 1] = {
                ...chStore.chapters[ch.number - 1],
                dataQuality: ch.data_quality,
                availableCount: ch.available_count,
                missingCount: ch.missing_count,
                missingItems: ch.missing_items || [],
              }
            })
          }
        }
        break

      case 'chapter_review_prompt':
        // A chapter has been generated and is ready for review
        currentReviewChapter.value = data.chapter
        chapterReviewPending.value = true
        phase.value = 'chapter_review'
        statusMessage.value = `第${data.chapter}章已完成，等待确认`
        statusPhase.value = '待确认'
        if (useChapterStore) {
          const chStore = useChapterStore()
          chStore.updateChapterContent(
            data.chapter,
            chapters.value[data.chapter]?.markdown || '',
            data.tables || chapters.value[data.chapter]?.tables || [],
            chapters.value[data.chapter]?.sources || []
          )
          chStore.phase = 'chapter_review'
        }
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: `📝 **第${data.chapter}章「${data.title}」已生成** — ${data.summary || ''}`,
          messageType: 'system_event',
          timestamp: new Date().toISOString(),
          metadata: {
            chapter: data.chapter,
            title: data.title,
            summary: data.summary,
            tables_count: data.tables_count || 0,
            word_count: data.word_count || 0,
            actions: data.actions || ['approve', 'revise', 'skip'],
            is_regeneration: data.is_regeneration || false,
          },
        })
        break

      case 'chapter_confirmed':
        // User confirmed a chapter
        if (useChapterStore) {
          const chStore = useChapterStore()
          chStore.confirmChapter(data.chapter)
          chStore.phase = 'generating'
        }
        chapterReviewPending.value = false
        currentReviewChapter.value = 0
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: `✅ **第${data.chapter}章已确认**`,
          messageType: 'system_event',
          timestamp: new Date().toISOString(),
        })
        break

      case 'chapter_progress':
        // Overall chapter progress update
        if (data.current) currentChapter.value = data.current
        // 🔴 Update progress step with chapter count
        const genStep = progressSteps.value.find(s => s.key === 'generation')
        if (genStep) {
          if (data.total) genStep.total = data.total
          if (data.current) genStep.current = data.current
        }
        if (useChapterStore) {
          const chStore = useChapterStore()
          chStore.currentChapter = data.current
          if (data.status === 'confirmed') {
            chStore.confirmChapter(data.current)
          } else if (data.status === 'generating') {
            chStore.setChapterGenerating(data.current)
          }
        }
        break

      case 'missing_data_prompt':
        // Agent needs more data for a chapter
        chapterReviewPending.value = false
        isStreaming.value = false
        messages.value.push({
          id: _nextMsgId(),
          role: 'agent',
          content: `⚠️ **第${data.chapter}章「${data.title}」缺少数据**\n\n`
            + `请提供以下 ${data.total_missing || 0} 项数据：\n`
            + (data.data_items || []).map(item =>
                `- **${item.display_name || item.key}**：${item.description || ''}`
              ).join('\n'),
          messageType: 'missing_data',
          timestamp: new Date().toISOString(),
          metadata: { chapter: data.chapter, data_items: data.data_items },
        })
        break

      case 'review_table_start':
        phase.value = 'review_table'
        messages.value.push({
          id: _nextMsgId(),
          role: 'system',
          content: '📊 正在从已确认的10章内容中提取数据，生成评审表...',
          messageType: 'system_event',
          timestamp: new Date().toISOString(),
        })
        break

      case 'review_table_complete':
        phase.value = 'assembling'
        if (data.download_url) {
          messages.value.push({
            id: _nextMsgId(),
            role: 'system',
            content: `✅ **评审表生成完成**\n\n[📥 下载评审表](${data.download_url})`,
            messageType: 'system_event',
            timestamp: new Date().toISOString(),
          })
        }
        break
    }

    // 🔴 Trim messages if over cap (keep last 100)
    if (messages.value.length > _MAX_MESSAGES) {
      messages.value = messages.value.slice(-_MAX_MESSAGES)
    }
    // 🔴 Trim thinkingLog (keep last 50)
    if (thinkingLog.value.length > 50) {
      thinkingLog.value = thinkingLog.value.slice(-50)
    }
  }

  async function approveOutline() {
    await sendMessage('确认大纲')
  }

  async function reviseOutline(revisionText) {
    await sendMessage(`修改大纲：${revisionText}`)
  }

  // ═══════════════════════════════════════════════════════
  // Chapter-by-Chapter Actions
  // ═══════════════════════════════════════════════════════

  async function confirmChapter(chapter) {
    chapterReviewPending.value = false
    approvingChapter.value = true
    try {
      await api.confirmChapter(sessionId.value, chapter, 'approve')
      if (useChapterStore) {
        useChapterStore().confirmChapter(chapter)
      }
    } catch (e) {
      ElNotification({ title: '确认失败', message: e.message || '请重试', type: 'error' })
    } finally {
      approvingChapter.value = false
    }
  }

  async function reviseChapter(chapter, revisionText) {
    chapterReviewPending.value = false
    revisingChapter.value = true
    try {
      // API sets user_action="revise" → orchestrator re-generates the chapter
      await api.confirmChapter(sessionId.value, chapter, 'revise', revisionText)
      if (useChapterStore) {
        useChapterStore().addRevisionHistory(chapter, revisionText)
        useChapterStore().setChapterRevision(chapter)
      }
      // Orchestrator will emit new chapter_start/stream/complete via existing SSE stream
    } catch (e) {
      ElNotification({ title: '提交修改失败', message: e.message || '请重试', type: 'error' })
    } finally {
      revisingChapter.value = false
    }
  }

  async function skipChapterAction(chapter) {
    chapterReviewPending.value = false
    skippingChapter.value = true
    try {
      await api.confirmChapter(sessionId.value, chapter, 'skip')
      if (useChapterStore) {
        useChapterStore().skipChapter(chapter)
      }
    } catch (e) {
      ElNotification({ title: '跳过失败', message: e.message || '请重试', type: 'error' })
    } finally {
      skippingChapter.value = false
    }
  }

  async function approveChapter() {
    await sendMessage('确认，继续下一章')
  }

  // ═══════════════════════════════════════════════════════
  // Workflow-based Generation (LangGraph pipeline)
  // ═══════════════════════════════════════════════════════

  const workflowRunning = ref(false)
  const workflowPaused = ref(false)
  const workflowMissingFields = ref([])
  const workflowProgress = ref({ current: 0, total: 10 })

  async function generateWithWorkflow(materialsDir = '') {
    if (!sessionId.value) {
      // Create session first
      await startGeneration('生成报告', 0, '默认模板', 'stability')
    }
    if (!sessionId.value) return

    workflowRunning.value = true
    workflowPaused.value = false
    phase.value = 'generating'
    status.value = 'generating'
    statusMessage.value = '正在启动工作流...'
    progressSteps.value = [
      { key: 'analysis', label: '解析资料', status: 'running', elapsed: 0 },
      { key: 'generation', label: '生成章节', status: 'pending', elapsed: 0 },
      { key: 'assembly', label: '组装报告', status: 'pending', elapsed: 0 },
    ]

    try {
      // Fire-and-forget: backend runs workflow in background
      const res = await api.startWorkflow(sessionId.value, {
        materialsDir: materialsDir,
        projectContext: reportTitle.value || '',
        reportTitle: reportTitle.value || '',
      })
      const data = res.data
      statusMessage.value = data.message || '🚀 工作流已启动'

      // Start polling immediately (backend returns immediately, workflow runs in background)
      pollWorkflowProgress()
    } catch (e) {
      workflowRunning.value = false
      statusMessage.value = `❌ 工作流启动失败: ${e.message || e}`
      phase.value = 'error'
    }
  }

  let _pollTimer = null
  let _pollSafetyTimeout = null  // Safety timeout ID — cleared on stop/cancel

  function _stopPolling(reason = '') {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
    if (_pollSafetyTimeout) { clearTimeout(_pollSafetyTimeout); _pollSafetyTimeout = null }
    if (reason) statusMessage.value = reason
  }

  function pollWorkflowProgress() {
    _stopPolling()  // Clear any previous polling + safety timeout
    _pollTimer = setInterval(async () => {
      if (!workflowRunning.value || !sessionId.value) {
        _stopPolling(); return
      }
      try {
        const res = await api.getWorkflowStatus(sessionId.value)
        const data = res.data || res
        // Update step statuses from backend
        if (data.step_statuses) {
          const steps = progressSteps.value || []
          const ss = data.step_statuses
          if (ss.analysis === 'done') { const s = steps.find(x => x.key === 'analysis') || {}; if (s) s.status = 'done'; s.elapsed = 1 }
          if (ss.analysis === 'running') { const s = steps.find(x => x.key === 'analysis') || {}; if (s) s.status = 'running' }
          if (ss.generation === 'done') { const s = steps.find(x => x.key === 'generation') || {}; if (s) s.status = 'done'; s.elapsed = 1 }
          if (ss.generation === 'running') { const s = steps.find(x => x.key === 'generation') || {}; if (s) s.status = 'running' }
          if (ss.assembly === 'done') { const s = steps.find(x => x.key === 'assembly') || {}; if (s) s.status = 'done'; s.elapsed = 1 }
          if (ss.assembly === 'running') { const s = steps.find(x => x.key === 'assembly') || {}; if (s) s.status = 'running' }
        }
        // 🔴 Update chapter count from backend
        if (data.total_chapters) {
          const gs = progressSteps.value.find(s => s.key === 'generation')
          if (gs) gs.total = data.total_chapters
        }
        if (data.current_chapter) {
          const gs = progressSteps.value.find(s => s.key === 'generation')
          if (gs) gs.current = data.current_chapter
        }
        if (data.phase === 'error' || data.error) {
          workflowRunning.value = false
          phase.value = 'error'
          status.value = 'error'
          statusMessage.value = data.error || '❌ 生成失败，请重试'
          _stopPolling()
        } else if (data.phase === 'complete' || data.output_path || (data.running === false && data.phase !== 'paused' && data.phase !== 'idle' && data.phase !== 'error')) {
          workflowRunning.value = false
          phase.value = 'complete'
          status.value = 'completed'
          statusMessage.value = '✅ 报告生成完成'
          progressSteps.value.forEach(s => { s.status = 'done'; s.elapsed = 1 })
          if (data.download_url) downloadUrl.value = data.download_url
          if (data.output_path) downloadUrl.value = `/api/v1/files/${data.output_path}`
          _stopPolling()
        } else if (data.phase === 'paused' || data.paused) {
          workflowPaused.value = true
          workflowMissingFields.value = data.missing_fields || []
          statusMessage.value = '⏸️ 需要补充信息'
          _stopPolling()
        }
      } catch(e) { /* polling error, ignore */ }
    }, 5000)  // Poll every 5 seconds

    // 🔴 Safety timeout: 45 minutes (质量循环 + 逐章生成可能超30分钟)
    _pollSafetyTimeout = setTimeout(() => {
      if (_pollTimer && workflowRunning.value) {
        _stopPolling('⏰ 生成超时（45分钟），请刷新页面重试')
        workflowRunning.value = false
        phase.value = 'error'
      }
    }, 2700000)  // 45 min
  }

  async function resumeWorkflow(data) {
    if (!sessionId.value) return
    workflowPaused.value = false
    phase.value = 'generating'  // 🔴 Immediately prevent duplicate start button clicks
    statusMessage.value = '正在继续生成...'
    try {
      const res = await api.resumeWorkflow(sessionId.value, data)
      const d = res.data
      if (d.phase === 'paused') {
        workflowPaused.value = true
        phase.value = 'paused'
        workflowMissingFields.value = d.missing_fields || []
        statusMessage.value = d.pause_message || '还有信息需要补充'
      } else {
        pollWorkflowProgress()
      }
    } catch(e) {
      statusMessage.value = `❌ 恢复失败: ${e.message || e}`
    }
  }

  function cancelWorkflow() {
    workflowRunning.value = false
    workflowPaused.value = false
    _stopPolling()
    phase.value = 'idle'
    status.value = 'idle'
  }

  async function requestRevision(request) {
    if (chapters.value[currentChapter.value]) {
      chapters.value[currentChapter.value].revisionCount =
        (chapters.value[currentChapter.value].revisionCount || 0) + 1
    }
    await sendMessage(request)
  }

  async function skipChapter() {
    await sendMessage('跳过')
  }

  async function assembleReport() {
    await sendMessage('生成报告')  // Now routes to ChapterOrchestrator (chapter-by-chapter)
  }

  async function uploadFile(file) {
    if (!sessionId.value) {
      // Session never initialized — try to create one
      try {
        await startGeneration('你好', 0, '')
        if (!sessionId.value) throw new Error('no session')
      } catch (_) {
        ElNotification({ title: '上传失败', message: '请刷新页面后重试', type: 'error', duration: 5000 })
        return null
      }
    }
    try {
      const res = await api.uploadAttachment(sessionId.value, file)
      return res.data
    } catch (e) {
      if (e.response?.status === 404 || (e.message || '').includes('404')) {
        // Session lost → force reload
        error.value = '会话已过期'
        sessionId.value = null
        status.value = 'idle'
        ElNotification({
          title: '会话已过期',
          message: '页面将自动刷新...',
          type: 'warning',
          duration: 2000,
          onClose: () => window.location.reload()
        })
        return null
      }
      // Show specific error for all other failures
      const errMsg = e.response?.data?.detail || e.message || '未知错误'
      const fileName = file?.name || '文件'
      ElNotification({
        title: `上传失败: ${fileName}`,
        message: errMsg,
        type: 'error',
        duration: 8000,
      })
      return null
    }
  }

  /** Submit batch section answers in form mode. */
  async function submitSectionAnswers(answers) {
    const payload = JSON.stringify(answers)
    await sendMessage(`__section_submit__${payload}`)
  }

  /** Skip the current section in form mode. */
  async function skipSection() {
    await sendMessage('__section_skip__')
  }

  /** Fetch T1-T4 quality report from test skill. */
  async function fetchQualityReport() {
    if (!sessionId.value) return null
    try {
      const res = await api.getQualityReport(sessionId.value)
      qualityReport.value = res.data
      return res.data
    } catch (e) {
      console.error('Failed to fetch quality report:', e)
      return null
    }
  }

  /** Fetch classified template fields from product skill. */
  async function fetchFieldAnalysis() {
    if (!sessionId.value) return null
    try {
      const res = await api.getTemplateFields(sessionId.value)
      fieldAnalysis.value = res.data
      return res.data
    } catch (e) {
      console.error('Failed to fetch field analysis:', e)
      return null
    }
  }

  async function cancelGeneration() {
    // 1. Abort the in-flight SSE fetch immediately (stops frontend streaming)
    if (_abortController) {
      _abortController.abort()
      _abortController = null
    }

    // 2. Tell backend to stop orchestrator (non-blocking, fire-and-forget)
    if (sessionId.value) {
      try {
        await api.cancelGeneration(sessionId.value)
      } catch (e) { /* session may already be gone, ignore */ }
    }

    // 3. Reset streaming state but keep conversation messages
    isStreaming.value = false
    streamingContent.value = ''
    thinkingLog.value = []
    llmReasoning.value = ''
    isReasoning.value = false
    phase.value = 'idle'
    chapterReviewPending.value = false
    currentReviewChapter.value = 0

    // 4. Set phase to setup so user can continue typing
    phase.value = 'setup'

    // 5. Add cancellation notice to chat
    messages.value.push({
      id: _nextMsgId(),
      role: 'system',
      content: '⏹️ 生成已停止。您可以继续对话或重新开始。',
      messageType: 'warning',
      timestamp: new Date().toISOString(),
    })
  }

  /** Direct generation — upload files then generate, no chat. */
  async function generateReport() {
    if (!sessionId.value) throw new Error('请先创建会话')
    if (_abortController) { _abortController.abort(); _abortController = null }
    _abortController = new AbortController()

    isStreaming.value = true
    streamingContent.value = ''
    thinkingLog.value = []
    phase.value = 'generating'
    status.value = 'generating'
    statusMessage.value = '正在启动生成...'
    // Init progress steps so UI shows pipeline structure immediately
    progressSteps.value = [
      { key: 'analysis', label: '分析资料', elapsed: 0, done: false, active: true },
      { key: 'outline', label: '生成大纲', elapsed: 0, done: false },
      { key: 'generation', label: '逐章生成', elapsed: 0, done: false },
      { key: 'quality', label: '质量审核', elapsed: 0, done: false },
      { key: 'assembly', label: '组装报告', elapsed: 0, done: false },
    ]

    try {
      const response = await api.generateReport(sessionId.value, _abortController?.signal)
      if (!response.ok) {
        let detail = ''
        try { const err = await response.json(); detail = err.detail || '' } catch {}
        throw new Error(detail || `服务器错误 (${response.status})`)
      }

      await _readSSEStream(response, _abortController?.signal)
    } catch (e) {
      if (e.name !== 'AbortError') {
        error.value = e.message || '生成失败'
        phase.value = 'idle'
        status.value = 'error'
        messages.value.push({
          id: _nextMsgId(), role: 'system',
          content: `❌ 生成失败: ${error.value}`,
          messageType: 'error', timestamp: new Date().toISOString(),
        })
      }
    } finally {
      isStreaming.value = false
      streamingContent.value = ''
    }
  }

  function resetState() {
    // 🔴 Abort in-flight SSE request
    if (_abortController) { _abortController.abort(); _abortController = null }
    // 🔴 Clean up all timers
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null }
    // Stop WebSocket with no reconnect
    wsDisconnect()
    sessionId.value = null
    reportTitle.value = ''
    templateId.value = 0
    templateName.value = ''
    useMasterAgent.value = true
    generationMode.value = 'chat'
    selectedDomain.value = ''
    phase.value = 'idle'
    status.value = 'idle'
    error.value = null
    chapters.value = {}
    currentChapter.value = 1
    streamingContent.value = ''
    collectingPrompt.value = null
    isStreaming.value = false
    thinkingLog.value = []
    llmReasoning.value = ''
    isReasoning.value = false
    messages.value = []
    generatedReportId.value = null
    downloadUrl.value = ''
    qualityReport.value = null
    fieldAnalysis.value = null
    materialSummary.value = null
    outline.value = null
    sectionFormData.value = null
    sectionsCompleted.value = 0
    sectionsTotal.value = 0
    templatePlaceholders.value = []
    filledData.value = {}
    totalPlaceholders.value = 0
    filledPlaceholders.value = 0
  }

  return {
    sessionId, reportTitle, templateId, templateName, phase, status, error, useMasterAgent,
    generationMode, selectedDomain, chapterReviewPending, currentReviewChapter,
    approvingChapter, revisingChapter, skippingChapter,
    fillPercent, totalPlaceholders, filledPlaceholders,
    templatePlaceholders, filledData,
    chapters, currentChapter,
    statusMessage, statusPhase, progressSteps, totalElapsed,
    streamingContent, isStreaming, thinkingLog, llmReasoning, isReasoning, collectingPrompt, collectingPromptText,
    messages,
    generatedReportId, downloadUrl, qualityReport, fieldAnalysis, materialSummary, outline,
    sectionFormData, sectionsCompleted, sectionsTotal,
    isGenerating, approvedCount, totalChapters, _totalChaptersOverride, canSendMessage, canInput, chatPlaceholderType,
    setSelectedDomain, startGeneration, sendMessage, approveChapter, requestRevision,
    approveOutline, reviseOutline,
    skipChapter, assembleReport, uploadFile, fetchQualityReport, fetchFieldAnalysis,
    cancelGeneration, resetState, submitSectionAnswers, skipSection,
    generateReport,
    // Workflow API
    generateWithWorkflow, resumeWorkflow, cancelWorkflow,
    workflowRunning, workflowPaused, workflowMissingFields, workflowProgress,
    _wsReady, wsConnect, wsDisconnect, wsSend,
    confirmChapter, reviseChapter, skipChapterAction,
  }
})
