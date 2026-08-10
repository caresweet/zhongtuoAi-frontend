<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="模板详情"
    size="500px"
  >
    <template v-if="template">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="模板名称">{{ template.name }}</el-descriptions-item>
        <el-descriptions-item label="分类">
          <el-tag size="small">{{ template.category }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述">{{ template.description || '无' }}</el-descriptions-item>
        <el-descriptions-item label="分析状态">
          <el-tag :type="statusType(template.analysis_status)" size="small">
            {{ statusText(template.analysis_status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="上传时间">{{ formatDate(template.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="文件大小">{{ formatFileSize(template.file_size) }}</el-descriptions-item>
      </el-descriptions>

      <el-divider />

      <!-- Placeholders -->
      <h4>占位符列表 ({{ placeholders.length }})</h4>
      <el-table :data="placeholders" size="small" max-height="400" v-if="placeholders.length > 0">
        <el-table-column prop="display_name" label="字段名" width="160" />
        <el-table-column prop="section_title" label="所属章节" width="200" show-overflow-tooltip />
        <el-table-column prop="expected_type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ typeLabel(row.expected_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_required" label="必填" width="60">
          <template #default="{ row }">{{ row.is_required ? '是' : '否' }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无占位符数据，请先进行AI分析" :image-size="80" />

      <el-divider v-if="template.analysis_status !== 'completed'" />
      <el-button
        v-if="template.analysis_status !== 'completed'"
        type="primary"
        :loading="analyzing"
        @click="onAnalyze"
        style="width: 100%"
      >
        <el-icon><MagicStick /></el-icon> AI分析模板
      </el-button>
      <el-button
        v-else
        @click="onAnalyze"
        :loading="analyzing"
        style="width: 100%"
      >
        <el-icon><Refresh /></el-icon> 重新分析
      </el-button>
    </template>
    <el-empty v-else description="请选择模板" :image-size="80" />
  </el-drawer>
</template>

<script setup>
import { ref } from 'vue'
import { formatDate, formatFileSize } from '@/utils/format'
import { PLACEHOLDER_TYPES } from '@/utils/constants'

const props = defineProps({
  visible: { type: Boolean, default: false },
  template: { type: Object, default: null },
  placeholders: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'analyze'])
const analyzing = ref(false)

function typeLabel(type) {
  return PLACEHOLDER_TYPES[type] || type
}

function statusText(s) {
  const map = { pending: '待分析', analyzing: '分析中', completed: '已完成', failed: '分析失败' }
  return map[s] || s
}

function statusType(s) {
  const map = { pending: 'info', analyzing: 'warning', completed: 'success', failed: 'danger' }
  return map[s] || 'info'
}

async function onAnalyze() {
  if (!props.template) return
  analyzing.value = true
  emit('analyze', props.template.id)
  setTimeout(() => { analyzing.value = false }, 3000)
}
</script>
