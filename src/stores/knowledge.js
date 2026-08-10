import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/knowledge'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const templates = ref([])
  const total = ref(0)
  const loading = ref(false)
  const currentTemplate = ref(null)
  const placeholders = ref([])

  async function fetchTemplates(params = {}) {
    loading.value = true
    try {
      const res = await api.listTemplates(params)
      templates.value = res.data.items || []
      total.value = res.data.total || 0
    } finally {
      loading.value = false
    }
  }

  async function fetchTemplate(id) {
    const res = await api.getTemplate(id)
    currentTemplate.value = res.data
    placeholders.value = res.data.placeholders || []
    return res.data
  }

  async function createTemplate(formData) {
    const res = await api.uploadTemplate(formData)
    await fetchTemplates()
    return res.data
  }

  async function updateTemplateData(id, data) {
    const res = await api.updateTemplate(id, data)
    return res.data
  }

  async function removeTemplate(id) {
    await api.deleteTemplate(id)
    await fetchTemplates()
  }

  async function triggerAnalysis(id) {
    const res = await api.analyzeTemplate(id)
    return res.data
  }

  // ---- Knowledge Documents ----
  const documents = ref([])
  const docTotal = ref(0)
  const docLoading = ref(false)

  async function fetchDocuments(params = {}) {
    docLoading.value = true
    try {
      const res = await api.listDocuments(params)
      documents.value = res.data?.items || []
      docTotal.value = res.data?.total || 0
    } finally {
      docLoading.value = false
    }
  }

  async function createDocument(formData) {
    const res = await api.uploadDocument(formData)
    return res.data
  }

  async function removeDocument(id) {
    await api.deleteDocument(id)
  }

  async function reindexDocument(id) {
    const res = await api.reindexDocument(id)
    return res.data
  }

  return {
    templates, total, loading, currentTemplate, placeholders,
    fetchTemplates, fetchTemplate, createTemplate,
    updateTemplateData, removeTemplate, triggerAnalysis,
    // Documents
    documents, docTotal, docLoading,
    fetchDocuments, createDocument, removeDocument, reindexDocument,
  }
})
