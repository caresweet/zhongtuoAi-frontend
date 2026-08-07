import client from './client'

// Upload template
export function uploadTemplate(formData) {
  return client.post('/knowledge/templates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,  // 5 min for large files + analysis
  })
}

// List templates
export function listTemplates(params = {}) {
  return client.get('/knowledge/templates', { params })
}

// Get template detail
export function getTemplate(id) {
  return client.get(`/knowledge/templates/${id}`)
}

// Update template
export function updateTemplate(id, data) {
  return client.put(`/knowledge/templates/${id}`, data)
}

// Delete template
export function deleteTemplate(id) {
  return client.delete(`/knowledge/templates/${id}`)
}

// Trigger AI analysis
export function analyzeTemplate(id) {
  return client.post(`/knowledge/templates/${id}/analyze`)
}

// Get placeholders
export function getPlaceholders(id) {
  return client.get(`/knowledge/templates/${id}/placeholders`)
}

// Download template file
export function downloadTemplate(id, type = 'template') {
  return `/api/v1/knowledge/templates/${id}/download?type=${type}`
}

// Get categories
export function getCategories() {
  return client.get('/knowledge/categories')
}

// ---- Knowledge Documents (regulations, standards, example reports) ----

// Upload knowledge document
export function uploadDocument(formData) {
  return client.post('/knowledge/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,  // 5 min for large files
  })
}

// List knowledge documents
export function listDocuments(params = {}) {
  return client.get('/knowledge/documents', { params })
}

// Get document detail
export function getDocument(id) {
  return client.get(`/knowledge/documents/${id}`)
}

// Delete document
export function deleteDocument(id) {
  return client.delete(`/knowledge/documents/${id}`)
}

// Reindex document (extract text + chunk + embed + store in ChromaDB)
export function reindexDocument(id) {
  return client.post(`/knowledge/documents/${id}/reindex`)
}

// ═══════════════════════════════════════════════════════════════
// Data Cleaning Workbench
// ═══════════════════════════════════════════════════════════════

// Get saved/default cleaning config for a document
export function getCleanConfig(id) {
  return client.get(`/knowledge/documents/${id}/clean/config`)
}

// Preview cleaning results (run pipeline, return side-by-side)
export function previewClean(id, config) {
  return client.post(`/knowledge/documents/${id}/clean/preview`, config)
}

// Save manually edited cleaned text
export function saveCleanedText(id, data) {
  return client.put(`/knowledge/documents/${id}/cleaned-text`, data)
}

// Confirm cleaning and mark as ready for indexing
export function applyClean(id, data) {
  return client.post(`/knowledge/documents/${id}/clean/apply`, data || {})
}

// Reset cleaning state
export function resetClean(id) {
  return client.post(`/knowledge/documents/${id}/clean/reset`)
}
