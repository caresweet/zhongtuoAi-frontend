<template>
  <div>
    <el-table :data="reports" v-loading="loading" stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="报告标题" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <el-link type="primary" @click="$emit('view', row)">{{ row.title }}</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="template_name" label="模板" width="180" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="170">
        <template #default="{ row }">{{ formatDate(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="$emit('view', row)">详情</el-button>
          <el-button
            size="small"
            type="primary"
            :disabled="row.status !== 'completed'"
            @click="$emit('download', row)"
          >
            <el-icon><Download /></el-icon> 下载
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
import { formatDate, statusText, statusType } from '@/utils/format'

defineProps({
  reports: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
})

defineEmits(['pageChange', 'view', 'download', 'delete'])
</script>
