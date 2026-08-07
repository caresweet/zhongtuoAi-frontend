<template>
  <el-skeleton :loading="loading" animated :rows="5">
    <el-timeline v-if="reports.length > 0">
      <el-timeline-item
        v-for="r in reports"
        :key="r.id"
        :timestamp="formatDate(r.created_at)"
        placement="top"
        :color="statusColor(r.status)"
      >
        <p class="activity-title">{{ r.title }}</p>
        <el-tag :type="statusType(r.status)" size="small">{{ statusText(r.status) }}</el-tag>
      </el-timeline-item>
    </el-timeline>
    <el-empty v-else description="暂无报告记录" :image-size="80" />
  </el-skeleton>
</template>

<script setup>
import { formatDate, statusText, statusType } from '@/utils/format'

defineProps({
  reports: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

function statusColor(status) {
  const map = { completed: '#67c23a', failed: '#f56c6c' }
  return map[status] || '#409eff'
}
</script>

<style scoped>
.activity-title {
  margin: 0 0 4px;
  font-size: 13px;
  color: #303133;
}
</style>
