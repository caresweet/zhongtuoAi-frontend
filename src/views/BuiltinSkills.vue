<template>
  <div class="app-page">
    <div class="page-title">内置技能</div>

    <el-alert type="info" :closable="false" style="margin-bottom:12px"
      title="系统出厂技能：审核、检索、工具、计算、外部对接五类，默认全部启用。停用后不再注入生成提示、也不再参与审核；已生成的历史报告不受影响。" />

    <div class="toolbar">
      <el-radio-group v-model="domain" @change="load">
        <el-radio-button label="stability">稳评报告</el-radio-button>
        <el-radio-button label="reclamation">复垦方案</el-radio-button>
        <el-radio-button label="bidding">投标文件</el-radio-button>
      </el-radio-group>
      <span class="stat">
        共 {{ items.length }} 条，启用 {{ enabledCount }} 条
      </span>
    </div>

    <el-tabs v-model="module">
      <el-tab-pane label="全部" name="" />
      <el-tab-pane v-for="m in moduleList" :key="m.key" :label="m.title" :name="m.key" />
    </el-tabs>

    <el-table :data="visibleItems" v-loading="loading" size="default" style="width:100%">
      <el-table-column prop="desc" label="技能要求" min-width="260" show-overflow-tooltip />
      <el-table-column label="类型" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.skill_type === 'rule' ? 'warning' : 'info'" size="small">
            {{ row.skill_type === 'rule' ? '规则' : '文本' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="严重度" width="80" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.skill_type === 'rule'"
            :type="row.severity === 'critical' ? 'danger' : 'info'" size="small">
            {{ row.severity === 'critical' ? '严重' : '预警' }}
          </el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="correction" label="正确做法 / 纠正示例" min-width="360" show-overflow-tooltip />
      <el-table-column label="模块" width="100" align="center">
        <template #default="{ row }">{{ row.module_title }}</template>
      </el-table-column>
      <el-table-column label="启用" width="80" align="center">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" :loading="saving === row.id"
            @change="v => toggle(row, v)" />
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && !visibleItems.length" description="该报告类型下暂无内置技能" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import client from '@/api/client'

const domain = ref('stability')
const module = ref('')
const items = ref([])
const loading = ref(false)
const saving = ref('')

const MODULES = [
  { key: 'retrieval', title: '检索' },
  { key: 'tools', title: '工具' },
  { key: 'calc', title: '计算' },
  { key: 'integration', title: '外部对接' },
  { key: 'audit', title: '审核校验' },
]
const moduleList = MODULES

const visibleItems = computed(() =>
  module.value ? items.value.filter(i => i.module === module.value) : items.value
)
const enabledCount = computed(() => items.value.filter(i => i.enabled).length)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const { data } = await client.get('/reports/reviews/builtin-skills', {
      params: { domain: domain.value },
    })
    items.value = data.data?.items || []
  } finally {
    loading.value = false
  }
}

async function toggle(row, enabled) {
  saving.value = row.id
  try {
    await client.put(`/reports/reviews/builtin-skills/${row.id}`, { enabled })
    row.enabled = enabled
    ElMessage.success(`${enabled ? '已启用' : '已停用'}：${row.desc}`)
  } catch (e) {
    ElMessage.error(e?.response?.data?.detail || '保存失败')
  } finally {
    saving.value = ''
  }
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.stat {
  color: #6b7280;
  font-size: 13px;
}
.muted {
  color: #c0c4cc;
}
</style>
