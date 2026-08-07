export function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

export function formatFileSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function statusText(status) {
  const map = {
    created: '已创建',
    analyzing: '分析中',
    interviewing: '填写中',
    filling: '生成中',
    reviewing: '审核中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    pending: '待分析',
  }
  return map[status] || status
}

export function statusType(status) {
  const map = {
    created: 'info',
    analyzing: 'warning',
    interviewing: 'warning',
    filling: 'warning',
    reviewing: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info',
    pending: 'info',
  }
  return map[status] || 'info'
}
