import client from './client'

// ── Auth-aware fetch（SSE 流 / 文件下载 等必须绕过 axios 的场景）──────────────
// Raw fetch 不走 axios 拦截器，token 注入 + 401 跳登录都得手动来。
// 🔴 **统一用这一个**，别在各 .vue 里各写一份 —— 之前散落 6 处裸 `fetch`，
//    后端一开鉴权它们全部 401，而且没有任何一处会跳登录。
export function authFetch(url, options = {}) {
  const token = localStorage.getItem('zhongtuo_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return fetch(url, { ...options, headers }).then(response => {
    if (response.status === 401) {
      localStorage.removeItem('zhongtuo_token')
      localStorage.removeItem('zhongtuo_user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      throw new Error('UNAUTHORIZED')
    }
    return response
  })
}

// Start generation session
export function startGeneration(templateId, initialMessage, intent = '', domain = '') {
  return client.post('/reports/generate/start', {
    template_id: templateId || 0,
    initial_message: initialMessage,
    intent: intent || '',
    domain: domain || intent || '',
  })
}

// Get all chapter statuses
export function getChapters(sessionId) {
  return client.get(`/reports/generate/${sessionId}/chapters`)
}

// Upload a file attachment during report generation
export function uploadAttachment(sessionId, file) {
  const formData = new FormData()
  // 🔴 文件夹上传时必须把**相对路径**作为文件名一起发（第三个参数），
  //    否则浏览器只发 basename，「公示照片4/微信图片_x.jpg」的文件夹线索全丢，
  //    后端就判不出图片该进正文哪一章，最后只能全塞附件（正文一张图都没有）。
  formData.append('file', file, file.webkitRelativePath || file.name)
  return client.post(`/reports/generate/${sessionId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,  // 5 min for large files
  })
}

// Send chat message (returns SSE stream URL)
export function sendChatMessage(sessionId, message, attachments, currentStep = null, folderStructure = null, signal = null, intent = '', domain = '') {
  return authFetch(`/api/v1/reports/generate/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, attachments, current_step: currentStep, folder_structure: folderStructure, intent: intent || '', domain: domain || intent || '' }),
    signal,  // 🔴 AbortSignal for cancelling SSE stream
  })
}

// Direct generation — no chat, upload files then call this
export function generateReport(sessionId, signal) {
  return authFetch(`/api/v1/reports/generate/${sessionId}/generate`, {
    method: 'POST',
    signal,
  })
}

// Get generation status
export function getGenerationStatus(sessionId) {
  return client.get(`/reports/generate/${sessionId}/status`)
}

// Get conversation history
export function getConversation(sessionId) {
  return client.get(`/reports/generate/${sessionId}/conversation`)
}

// Skip current field
export function skipCurrent(sessionId) {
  return client.post(`/reports/generate/${sessionId}/skip`)
}

// Retry
export function retryGeneration(sessionId) {
  return client.post(`/reports/generate/${sessionId}/retry`)
}

// Cancel
export function cancelGeneration(sessionId) {
  return client.post(`/reports/generate/${sessionId}/cancel`)
}

// ═══════════════════════════════════════════════════════
// Workflow API — LangGraph human-in-the-loop generation
// ═══════════════════════════════════════════════════════

// Start LangGraph workflow generation (returns immediately, runs in background)
export function startWorkflow(sessionId, { materialsDir, projectContext, reportTitle, selectedPersonnel, selectedCertPersonnel } = {}) {
  return client.post(`/reports/generate/${sessionId}/workflow/start`, {
    materials_dir: materialsDir || '',
    project_context: projectContext || '',
    report_title: reportTitle || '',
    // 🔴 用户勾选的报告人员（前置工作组名单 + 培训证书取图）
    selected_personnel: selectedPersonnel || [],
    // 🔴 「选择证书」独立多选框（最多 3 人）→ 公司营业执照之后贴哪几张人员证书图
    selected_cert_personnel: selectedCertPersonnel || [],
  }, { timeout: 10000 })  // 10s timeout — backend returns immediately
}

// Resume workflow after user provides missing data
export function resumeWorkflow(sessionId, data) {
  return client.post(`/reports/generate/${sessionId}/workflow/resume`, { data })
}

// Get workflow status
export function getWorkflowStatus(sessionId) {
  return client.get(`/reports/generate/${sessionId}/workflow/status`)
}

// 🔴 人工复核闭环 API
// 获取待人工复核章节列表（含违规）
export function getHumanQueue(sessionId) {
  return client.get(`/reports/generate/${sessionId}/human-queue`)
}
// 提交人工意见 / 审批放行 / 人工改写
// mode: opinion(给思路AI重写) | approve(审批放行) | override(人工改写全文)
export function submitHumanOpinion(sessionId, chapter, mode, payload = {}) {
  return client.post(`/reports/generate/${sessionId}/human/opinion`, {
    chapter, mode, ...payload,
  })
}
// 触发 AI 携人工意见重写排队章节
export function triggerHumanRewrite(sessionId, chapters = []) {
  return client.post(`/reports/generate/${sessionId}/human/rewrite`, { chapters })
}

// Get material-analysis summary for a session
export function getMaterialSummary(sessionId) {
  return client.get(`/reports/generate/${sessionId}/materials`)
}

// 缺口清单 —— 「这章缺什么、为什么缺」（含遁词检测）。
// 🔴 生成结束后在界面上提示，**不写进交付稿**（业主 2026-10-10 口径：
//    交付稿里不许有批注气球，缺口走这里告知）。
export function getSessionGaps(sessionId) {
  return client.get(`/reports/generate/${sessionId}/gaps`)
}

// Get T1-T4 quality report (test skill)
export function getQualityReport(sessionId) {
  return client.get(`/reports/generate/${sessionId}/quality`)
}

// Get classified template fields (product skill)
export function getTemplateFields(sessionId) {
  return client.get(`/reports/generate/${sessionId}/fields`)
}

// ═══════════════════════════════════════════════════════
// Chapter-by-Chapter Generation API
// ═══════════════════════════════════════════════════════

// Confirm/revise/skip a generated chapter
export function confirmChapter(sessionId, chapter, action, revisionText = '') {
  return client.post(`/reports/generate/${sessionId}/chapter/confirm`, {
    chapter,
    action,
    revision_text: revisionText,
  })
}

// Get specific chapter status
export function getChapterStatus(sessionId, chapterNum) {
  return client.get(`/reports/generate/${sessionId}/chapter/${chapterNum}`)
}

// Get all chapters status
export function getAllChaptersStatus(sessionId) {
  return client.get(`/reports/generate/${sessionId}/chapters/all`)
}

// Submit missing data for a chapter
export function submitMissingData(sessionId, chapter, data) {
  return client.post(`/reports/generate/${sessionId}/missing-data`, {
    chapter,
    data,
  })
}

// Trigger generation of a specific chapter (SSE stream)
export function generateChapter(sessionId, chapter) {
  return authFetch(`/api/v1/reports/generate/${sessionId}/chapter/generate`, {
    method: 'POST',
    body: JSON.stringify({ chapter, domain: '' }),
  })
}
