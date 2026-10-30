<template>
  <div>
    <el-table :data="templates" v-loading="loading" stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="模板名称" min-width="160">
        <template #default="{ row }">
          <el-link type="primary" @click="$emit('view', row)">{{ row.name }}</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="domain" label="领域" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="domainType(row.domain)" effect="plain">{{ domainLabel(row.domain) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="region" label="地区" width="90">
        <template #default="{ row }">
          <span v-if="row.region">{{ row.region }}</span>
          <span v-else class="muted">通用</span>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="分类" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="analysis_status" label="分析状态" width="110">
        <template #default="{ row }">
          <el-tag :type="analysisStatusType(row.analysis_status)" size="small">
            {{ analysisStatusText(row.analysis_status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="上传时间" width="170">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$emit('view', row)">详情</el-button>
          <el-button
            size="small"
            type="warning"
            :loading="row.analysis_status === 'analyzing'"
            :disabled="row.analysis_status === 'analyzing'"
            @click="$emit('analyze', row.id)"
          >
            {{ row.analysis_status === 'completed' ? '重新分析' : 'AI分析' }}
          </el-button>
          <el-button size="small" type="danger" @click="$emit('delete', row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 20"
      style="margin-top: 16px; justify-content: flex-end"
      background
      layout="total, prev, pager, next"
      :total="total"
      :page-size="20"
      @current-change="$emit('pageChange', $event)"
    />
  </div>
</template>

<script setup>
import { formatDate } from '@/utils/format'

defineProps({
  templates: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
})

defineEmits(['pageChange', 'view', 'analyze', 'delete'])

function analysisStatusText(s) {
  const map = { pending: '待分析', analyzing: '分析中', completed: '已完成', failed: '失败' }
  return map[s] || s
}

function analysisStatusType(s) {
  const map = { pending: 'info', analyzing: 'warning', completed: 'success', failed: 'danger' }
  return map[s] || 'info'
}

const DOMAIN_LABELS = { stability: '稳评', reclamation: '复垦', bidding: '投标' }
const DOMAIN_TYPES = { stability: 'primary', reclamation: 'success', bidding: 'warning' }
function domainLabel(d) { return DOMAIN_LABELS[d] || d || '稳评' }
function domainType(d) { return DOMAIN_TYPES[d] || 'info' }
</script>

<style scoped>
.muted { color: #b0b7c3 }
</style>
