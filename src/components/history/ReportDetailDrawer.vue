<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="报告详情"
    size="550px"
  >
    <template v-if="report">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="报告标题">{{ report.title }}</el-descriptions-item>
        <el-descriptions-item label="模板">{{ report.template_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusType(report.status)">{{ statusText(report.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(report.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="完成时间">{{ formatDate(report.completed_at) }}</el-descriptions-item>
        <el-descriptions-item v-if="report.generation_duration_sec" label="耗时">
          {{ report.generation_duration_sec }} 秒
        </el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <!-- Filled Data -->
      <h4>填充数据</h4>
      <div v-if="filledData && Object.keys(filledData).length > 0">
        <el-table :data="filledDataEntries" size="small" max-height="400">
          <el-table-column prop="key" label="字段" width="200" />
          <el-table-column prop="value" label="值" />
        </el-table>
      </div>
      <el-empty v-else description="暂无数据" :image-size="60" />

      <el-divider />

      <!-- Actions -->
      <el-button
        type="primary"
        :disabled="report.status !== 'completed'"
        @click="onDownload"
        style="width: 100%"
      >
        <el-icon><Download /></el-icon> 下载报告文件
      </el-button>
    </template>
    <el-empty v-else description="请选择报告" :image-size="80" />
  </el-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { formatDate, statusText, statusType } from '@/utils/format'
import { getReportData, downloadReport } from '@/api/history'

const props = defineProps({
  visible: { type: Boolean, default: false },
  report: { type: Object, default: null },
})

defineEmits(['update:visible'])

const filledData = ref({})

watch(() => props.report, async (r) => {
  if (r) {
    try {
      const res = await getReportData(r.id)
      filledData.value = res.data?.filled_data || {}
    } catch {
      filledData.value = {}
    }
  }
})

const filledDataEntries = computed(() => {
  return Object.entries(filledData.value).map(([key, value]) => ({ key, value }))
})

function onDownload() {
  if (props.report) {
    window.open(downloadReport(props.report.id), '_blank')
  }
}
</script>
