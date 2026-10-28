<template>
  <div class="au-page">
    <div class="au-head">
      <h2>账号管理</h2>
      <p class="au-sub">
        自助注册的账号是<b>待审核</b>状态，必须在这里开通才能登录。也可以直接建号（建立即可用）。
      </p>
    </div>

    <el-card shadow="never">
      <div class="au-bar">
        <el-radio-group v-model="statusFilter" @change="load">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="pending">待审核</el-radio-button>
          <el-radio-button value="active">已启用</el-radio-button>
        </el-radio-group>
        <el-input v-model="keyword" placeholder="搜用户名 / 姓名" clearable style="width:220px"
                  @keyup.enter="load" @clear="load" />
        <el-button @click="load">查询</el-button>
        <div class="au-spacer" />
        <el-button type="primary" @click="openCreate">建号</el-button>
      </div>

      <el-table v-loading="loading" :data="users" size="small" style="width:100%">
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="display_name" label="姓名" width="120" />
        <el-table-column label="公司" min-width="180">
          <template #default="{ row }">
            {{ row.company_name || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="角色" width="90">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'info'" size="small">
              {{ row.role === 'admin' ? '管理员' : '普通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'warning'" size="small">
              {{ row.is_active ? '已启用' : '待审核' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="last_login_at" label="最近登录" width="170" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.is_active" size="small" type="primary" @click="doApprove(row)">开通</el-button>
            <el-button v-else size="small" @click="doDisable(row)">停用</el-button>
            <el-button size="small" @click="openReset(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !users.length" description="没有符合条件的账号" :image-size="70" />
    </el-card>

    <!-- 建号 -->
    <el-dialog v-model="createVisible" title="新建账号" width="460px">
      <el-form :model="createForm" label-width="90px">
        <el-form-item label="用户名" required>
          <el-input v-model="createForm.username" placeholder="登录用，2~50 字符" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="createForm.display_name" />
        </el-form-item>
        <el-form-item label="初始密码" required>
          <el-input v-model="createForm.password" placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="归属公司">
          <el-select v-model="createForm.company_id" clearable placeholder="留空则该账号报告里的公司信息显示「待填写」"
                     style="width:100%">
            <el-option v-for="c in companies" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="管理员">
          <el-switch v-model="createForm.role_admin" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码 -->
    <el-dialog v-model="resetVisible" :title="`重置 ${resetTarget?.username || ''} 的密码`" width="420px">
      <el-input v-model="newPassword" placeholder="新密码（至少 6 位）" show-password />
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doReset">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { approveUser, createUser, disableUser, listCompanies, listUsers, resetUserPassword } from '@/api/admin'

const loading = ref(false)
const saving = ref(false)
const users = ref([])
const companies = ref([])
const statusFilter = ref('')
const keyword = ref('')

const createVisible = ref(false)
const createForm = reactive({ username: '', display_name: '', password: '', company_id: null, role_admin: false })
const resetVisible = ref(false)
const resetTarget = ref(null)
const newPassword = ref('')

async function load() {
  loading.value = true
  try {
    const { data } = await listUsers({ status: statusFilter.value, q: keyword.value })
    users.value = (data.data && data.data.users) || []
    if (data.message) ElMessage.closeAll()
  } catch (e) {
    ElMessage.error(e.message || '读取账号列表失败')
  } finally {
    loading.value = false
  }
}

async function loadCompanies() {
  try {
    const { data } = await listCompanies()
    companies.value = (data.data && data.data.companies) || []
  } catch { companies.value = [] }
}

function openCreate() {
  Object.assign(createForm, { username: '', display_name: '', password: '', company_id: null, role_admin: false })
  createVisible.value = true
}

async function doCreate() {
  saving.value = true
  try {
    const { data } = await createUser({
      username: createForm.username,
      display_name: createForm.display_name,
      password: createForm.password,
      company_id: createForm.company_id,
      role: createForm.role_admin ? 'admin' : 'user',
    })
    ElMessage.success(data.message || '已创建')
    createVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    saving.value = false
  }
}

async function doApprove(row) {
  try {
    const { data } = await approveUser(row.id)
    ElMessage.success(data.message || '已开通')
    await load()
  } catch (e) { ElMessage.error(e.message || '开通失败') }
}

async function doDisable(row) {
  try {
    await ElMessageBox.confirm(`确定停用「${row.username}」？停用后其登录与已签发 token 立即失效。`,
                               '停用确认', { type: 'warning' })
  } catch { return }
  try {
    const { data } = await disableUser(row.id)
    ElMessage.success(data.message || '已停用')
    await load()
  } catch (e) { ElMessage.error(e.message || '停用失败') }
}

function openReset(row) {
  resetTarget.value = row
  newPassword.value = ''
  resetVisible.value = true
}

async function doReset() {
  saving.value = true
  try {
    const { data } = await resetUserPassword(resetTarget.value.id, newPassword.value)
    ElMessage.success(data.message || '已重置')
    resetVisible.value = false
  } catch (e) {
    ElMessage.error(e.message || '重置失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => { await loadCompanies(); await load() })
</script>

<style scoped>
.au-page { padding: 20px; }
.au-head h2 { margin: 0 0 6px; }
.au-sub { color: #7a8699; font-size: 13px; margin: 0 0 16px; }
.au-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.au-spacer { flex: 1; }
</style>
