<template>
  <div class="history-reports">
    <div class="page-header">
      <h2 class="page-title">历史报告</h2>
    </div>

    <!-- Filter -->
    <el-card shadow="never" class="filter-card">
      <el-row :gutter="16">
        <el-col :span="8">
          <el-input
            v-model="searchText"
            placeholder="搜索报告标题..."
            clearable
            @clear="loadReports"
            @keyup.enter="loadReports"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filterStatus" placeholder="按状态筛选" clearable @change="loadReports" style="width: 100%">
            <el-option label="已完成" value="completed" />
            <el-option label="填写中" value="interviewing" />
            <el-option label="失败" value="failed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button @click="loadReports">搜索</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- Report Table -->
    <el-card shadow="never" style="margin-top: 16px">
      <ReportTable
        :reports="store.reports"
        :loading="store.loading"
        :total="store.total"
        @page-change="onPageChange"
        @view="onViewReport"
        @delete="onDeleteReport"
        @download="onDownloadReport"
      />
    </el-card>

    <!-- Detail Drawer -->
    <ReportDetailDrawer
      v-model:visible="showDetailDrawer"
      :report="store.currentReport"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useHistoryStore } from '@/stores/history'
import { downloadReport } from '@/api/history'
import ReportTable from '@/components/history/ReportTable.vue'
import ReportDetailDrawer from '@/components/history/ReportDetailDrawer.vue'

const store = useHistoryStore()
const searchText = ref('')
const filterStatus = ref('')
const showDetailDrawer = ref(false)
const currentPage = ref(1)

onMounted(() => loadReports())

async function loadReports() {
  await store.fetchReports({
    page: currentPage.value,
    page_size: 20,
    search: searchText.value || undefined,
    status: filterStatus.value || undefined,
  })
}

function onPageChange(page) {
  currentPage.value = page
  loadReports()
}

async function onViewReport(report) {
  await store.fetchReport(report.id)
  showDetailDrawer.value = true
}

async function onDeleteReport(report) {
  try {
    await ElMessageBox.confirm(
      `确定要删除报告「${report.title}」吗？此操作不可恢复。`,
      '确认删除',
      { type: 'warning' }
    )
    await store.removeReport(report.id)
    ElMessage.success('报告已删除')
  } catch (e) {
    // user cancelled
  }
}

function onDownloadReport(report) {
  window.open(downloadReport(report.id), '_blank')
}
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: #303133;
}
</style>
