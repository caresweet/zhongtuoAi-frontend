import client from './client'

// ── 账号/公司管理（仅管理员）──────────────────────────────────────────────

export function listUsers(params = {}) {
  return client.get('/admin/users', { params })
}

export function createUser(payload) {
  return client.post('/admin/users', payload)
}

export function updateUser(id, payload) {
  return client.put(`/admin/users/${id}`, payload)
}

export function approveUser(id, payload = {}) {
  return client.post(`/admin/users/${id}/approve`, payload)
}

export function disableUser(id) {
  return client.post(`/admin/users/${id}/disable`)
}

export function resetUserPassword(id, password) {
  return client.post(`/admin/users/${id}/reset-password`, { password })
}

export function listCompanies() {
  return client.get('/admin/companies')
}

export function createCompany(payload) {
  return client.post('/admin/companies', payload)
}
