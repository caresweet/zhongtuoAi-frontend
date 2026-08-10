import client from './client'

// ── Auth-aware fetch for SSE streams ─────────────────────────────────────
// Raw fetch bypasses axios interceptors, so JWT injection + 401 redirect
// must be handled manually for SSE endpoints.
function _authFetch(url, options = {}) {
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
  formData.append('file', file)
  return client.post(`/reports/generate/${sessionId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,  // 5 min for large files
  })
}

// Send chat message (returns SSE stream URL)
export function sendChatMessage(sessionId, message, attachments, currentStep = null, folderStructure = null, signal = null, intent = '', domain = '') {
  return _authFetch(`/api/v1/reports/generate/${sessionId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, attachments, current_step: currentStep, folder_structure: folderStructure, intent: intent || '', domain: domain || intent || '' }),
    signal,  // 🔴 AbortSignal for cancelling SSE stream
  })
}

// Direct generation — no chat, upload files then call this
export function generateReport(sessionId, signal) {
  return _authFetch(`/api/v1/reports/generate/${sessionId}/generate`, {
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
export function startWorkflow(sessionId, { materialsDir, projectContext, reportTitle } = {}) {
  return client.post(`/reports/generate/${sessionId}/workflow/start`, {
    materials_dir: materialsDir || '',
    project_context: projectContext || '',
    report_title: reportTitle || '',
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

// Get material-analysis summary for a session
export function getMaterialSummary(sessionId) {
  return client.get(`/reports/generate/${sessionId}/materials`)
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
  return fetch(`/api/v1/reports/generate/${sessionId}/chapter/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter, domain: '' }),
  })
}
