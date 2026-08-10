<template>
  <div class="chapter-progress-bar">
    <div class="progress-header">
      <span class="progress-title">章节生成进度</span>
      <span class="progress-count">{{ confirmedCount }} / {{ totalChapters }} 确认</span>
    </div>
    <div class="progress-track">
      <div
        v-for="ch in chapters"
        :key="ch.number"
        class="progress-dot"
        :class="dotClass(ch)"
        :title="dotTitle(ch)"
        @click="$emit('chapterClick', ch.number)"
      >
        <span class="dot-number">{{ ch.number }}</span>
        <span class="dot-label">{{ ch.shortTitle }}</span>
        <el-icon v-if="ch.status === 'approved'" class="dot-check"><Check /></el-icon>
        <el-icon v-if="ch.status === 'generating'" class="dot-spin"><Loading /></el-icon>
      </div>
    </div>
    <!-- Connecting line -->
    <div class="progress-line" :style="lineStyle" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Check, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  chapters: { type: Array, default: () => [] },
  totalChapters: { type: Number, default: 10 },
})

defineEmits(['chapterClick'])

const confirmedCount = computed(() => {
  return props.chapters.filter(c => c.status === 'approved').length
})

const lineStyle = computed(() => {
  const pct = (confirmedCount.value / props.totalChapters) * 100
  return {
    width: `${pct}%`,
    background: pct >= 100
      ? 'linear-gradient(90deg, #67c23a, #409eff)'
      : 'linear-gradient(90deg, #409eff, #67c23a)',
  }
})

function dotClass(ch) {
  return {
    'dot-approved': ch.status === 'approved',
    'dot-review': ch.status === 'review',
    'dot-generating': ch.status === 'generating',
    'dot-pending': ch.status === 'pending',
    'dot-active': ch.active,
  }
}

function dotTitle(ch) {
  const statusMap = {
    approved: '已确认',
    review: '待审核',
    generating: '生成中',
    pending: '等待中',
    revised: '已修改',
  }
  return `第${ch.number}章 ${ch.title} — ${statusMap[ch.status] || ch.status}`
}

// Short titles for the progress bar
const SHORT_TITLES = {
  1: '基本概况', 2: '评估方法', 3: '风险调查', 4: '综合分析',
  5: '风险识别', 6: '措施前', 7: '化解措施', 8: '措施后',
  9: '结论建议', 10: '应急预案',
}
</script>

<style scoped>
.chapter-progress-bar {
  position: relative;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 12px 16px;
  margin: 12px 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.progress-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.progress-count {
  font-size: 12px;
  color: #909399;
}

.progress-line {
  position: absolute;
  top: 50%;
  left: 24px;
  height: 3px;
  border-radius: 2px;
  transition: width 0.5s ease;
  z-index: 0;
}

.progress-track {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

.progress-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  position: relative;
  width: 56px;
  transition: transform 0.2s;
}
.progress-dot:hover {
  transform: scale(1.1);
}

.dot-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: #c0c4cc;
  transition: all 0.3s;
  position: relative;
}

.dot-label {
  font-size: 10px;
  color: #909399;
  margin-top: 4px;
  text-align: center;
  white-space: nowrap;
}

.dot-check, .dot-spin {
  position: absolute;
  font-size: 14px;
  color: #fff;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.dot-spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.dot-approved .dot-number { background: #67c23a; }
.dot-review .dot-number { background: #e6a23c; }
.dot-generating .dot-number { background: #409eff; }
.dot-pending .dot-number { background: #c0c4cc; }
.dot-active .dot-number {
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.3);
}
</style>
