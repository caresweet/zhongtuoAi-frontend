import client from './client'
import { downloadFile } from '@/utils/download'

// List reports
export function listReports(params = {}) {
  return client.get('/history/reports', { params })
}

// Get report detail
export function getReport(id) {
  return client.get(`/history/reports/${id}`)
}

// Get report filled data
export function getReportData(id) {
  return client.get(`/history/reports/${id}/data`)
}

// Get report conversation
export function getReportConversation(id) {
  return client.get(`/history/reports/${id}/conversation`)
}

// Delete report
export function deleteReport(id) {
  return client.delete(`/history/reports/${id}`)
}

// 下载报告文件（带鉴权，见 utils/download.js 里为什么不能用直链）
export function downloadReport(id) {
  return downloadFile(`/api/v1/history/reports/${id}/download`)
}

// Dashboard stats
export function getDashboardStats() {
  return client.get('/dashboard/stats')
}

// Recent reports
export function getRecentReports(limit = 10) {
  return client.get('/dashboard/recent', { params: { limit } })
}

// Daily trends
export function getTrends(days = 30) {
  return client.get('/dashboard/trends', { params: { days } })
}
