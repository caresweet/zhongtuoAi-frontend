<template>
  <el-row :gutter="16">
    <el-col :span="6" v-for="card in cards" :key="card.label">
      <el-card shadow="never" class="stat-card">
        <el-skeleton :loading="loading" animated>
          <div class="stat-content">
            <div class="stat-value" :style="{ color: card.color }">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </el-skeleton>
      </el-card>
    </el-col>
  </el-row>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
})

const cards = computed(() => [
  { label: '报告总数', value: props.stats.total_reports ?? '-', color: '#409eff' },
  { label: '已完成', value: props.stats.completed_reports ?? '-', color: '#67c23a' },
  { label: '本月新增', value: props.stats.reports_this_month ?? '-', color: '#e6a23c' },
  { label: '模板数量', value: props.stats.total_templates ?? '-', color: '#909399' },
])
</script>

<style scoped>
.stat-card {
  text-align: center;
}

.stat-content {
  padding: 8px 0;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}
</style>
