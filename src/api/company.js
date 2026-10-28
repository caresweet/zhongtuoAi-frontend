import client from './client'

// ── 公司档案（登录即可，每人操作自己的公司）────────────────────────────────

// 当前用户公司的档案；没填过时返回空字段 + has_company=false
export function getCompanyProfile() {
  return client.get('/company/profile')
}

export function updateCompanyProfile(payload) {
  return client.put('/company/profile', payload)
}

// 本公司人员库（「选择报告人员」的数据源）
export function listPersonnel(params = {}) {
  return client.get('/company/personnel', { params })
}

export function syncPersonnel() {
  return client.post('/company/personnel/sync')
}

// 上传名册（xlsx/csv/docx）→ 导入本公司人员库
export function importPersonnel(file, replace = false) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('replace', replace ? 'true' : 'false')
  return client.post('/company/personnel/import', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

// ── 单个人的增改删（名册导入之外的补充入口）──────────────────────────────

export function createPersonnel(payload) {
  return client.post('/company/personnel', payload)
}

export function updatePersonnel(id, payload) {
  return client.put(`/company/personnel/${id}`, payload)
}

export function deletePersonnel(id) {
  return client.delete(`/company/personnel/${id}`)
}

// 给某位人员上传证书图片
export function uploadPersonnelCert(id, file, category = '其他') {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('category', category)
  return client.post(`/company/personnel/${id}/certs`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
