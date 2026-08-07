import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/history'

export const useHistoryStore = defineStore('history', () => {
  const reports = ref([])
  const total = ref(0)
  const loading = ref(false)
  const currentReport = ref(null)

  async function fetchReports(params = {}) {
    loading.value = true
    try {
      const res = await api.listReports(params)
      reports.value = res.data.items || []
      total.value = res.data.total || 0
    } finally {
      loading.value = false
    }
  }

  async function fetchReport(id) {
    const res = await api.getReport(id)
    currentReport.value = res.data
    return res.data
  }

  async function fetchReportData(id) {
    const res = await api.getReportData(id)
    return res.data
  }

  async function removeReport(id) {
    await api.deleteReport(id)
    await fetchReports()
  }

  return {
    reports, total, loading, currentReport,
    fetchReports, fetchReport, fetchReportData, removeReport,
  }
})
