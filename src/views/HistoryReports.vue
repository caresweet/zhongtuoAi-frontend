<template>
  <div class="history-reports">
    <div class="page-header">
      <h2 class="page-title">历史报告</h2>
      <el-button type="primary" @click="openExpertReview">🔍 专家评估</el-button>
    </div>

    <!-- 专家评估对话框 -->
    <el-dialog v-model="expertReviewDialog" title="专家评估报告" width="700px">
      <el-form label-width="90px">
        <el-form-item label="报告标题">
          <el-select v-model="selectedReport" placeholder="选择要评估的报告" filterable style="width:100%" @change="onReportSelected">
            <el-option v-for="r in store.reports" :key="r.id" :label="(r.title || '报告#' + r.id) + (r.report_file_path ? '（' + r.report_file_path + '）' : '')" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="报告文件">
          <el-input v-model="expertForm.report_file_path" placeholder="选择报告后自动带出" disabled />
        </el-form-item>
        <el-divider>评估意见（可添加多条）</el-divider>
        <div v-for="(fb, i) in expertForm.feedback" :key="i" class="fb-item">
          <el-row :gutter="8">
            <el-col :span="7">
              <el-select v-model="fb.chapter_num" placeholder="问题所在章节" style="width:100%">
                <el-option label="全文通用" :value="0" />
                <el-option v-for="n in 10" :key="n" :label="'第' + n + '章'" :value="n" />
              </el-select>
            </el-col>
            <el-col :span="5">
              <el-select v-model="fb.severity" style="width:100%">
                <el-option label="一般" value="warning" />
                <el-option label="严重" value="error" />
                <el-option label="致命" value="critical" />
              </el-select>
            </el-col>
            <el-col :span="12">
              <el-select v-model="fb.issue_type" style="width:100%" placeholder="问题类型">
                <el-option label="表格格式" value="table_format" />
                <el-option label="AI味/口语化" value="ai_tone" />
                <el-option label="数据错误" value="data_error" />
                <el-option label="逻辑问题" value="logic" />
                <el-option label="内容缺失" value="missing" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-col>
          </el-row>
          <el-input v-model="fb.issue_desc" placeholder="问题描述（哪里不好）" style="margin-top:6px" />
          <el-input v-model="fb.suggestion" placeholder="优化建议（应该怎么写）" style="margin-top:6px" />
          <el-button text type="danger" @click="expertForm.feedback.splice(i, 1)">删除此条</el-button>
        </div>
        <el-button @click="expertForm.feedback.push({ chapter_num: 0, issue_type: '', issue_desc: '', suggestion: '', severity: 'warning' })">+ 添加一条意见</el-button>
      </el-form>
      <template #footer>
        <el-button @click="expertReviewDialog = false">取消</el-button>
        <el-button type="primary" :loading="expertSubmitting" @click="submitExpertReview">提交评估</el-button>
      </template>
    </el-dialog>

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
import { ref, reactive, onMounted } from 'vue'
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

// ── 专家评估 ──
const expertReviewDialog = ref(false)
const expertSubmitting = ref(false)
const selectedReport = ref(null)
const expertForm = reactive({
  report_title: '',
  session_id: '',
  report_file_path: '',
  feedback: [{ chapter_num: 0, issue_type: '', issue_desc: '', suggestion: '', severity: 'warning' }],
})

function openExpertReview() {
  selectedReport.value = null
  expertForm.report_title = ''
  expertForm.session_id = ''
  expertForm.report_file_path = ''
  expertForm.feedback = [{ chapter_num: 0, issue_type: '', issue_desc: '', suggestion: '', severity: 'warning' }]
  expertReviewDialog.value = true
}

function onReportSelected(report) {
  if (!report) return
  expertForm.report_title = report.title || ''
  expertForm.session_id = report.session_id || ''
  expertForm.report_file_path = report.report_file_path || ''
}

async function submitExpertReview() {
  const validFeedback = expertForm.feedback.filter(f => f.issue_desc && f.issue_desc.trim())
  if (!validFeedback.length) {
    ElMessage.warning('请至少填写一条问题描述')
    return
  }
  expertSubmitting.value = true
  try {
    const res = await fetch('/api/v1/reports/reviews/expert-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report_title: expertForm.report_title,
        session_id: expertForm.session_id,
        report_file_path: expertForm.report_file_path,
        domain: 'stability',
        feedback: validFeedback,
      }),
    })
    const data = await res.json()
    if (data && data.data && data.data.recorded > 0) {
      ElMessage.success(`已记录 ${data.data.recorded} 条专家评估意见`)
      expertReviewDialog.value = false
    } else {
      ElMessage.warning('提交失败或未记录到有效意见')
    }
  } catch (e) {
    ElMessage.error('提交失败：' + e.message)
  } finally {
    expertSubmitting.value = false
  }
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
  const url = downloadReport(report.id)
  const a = document.createElement('a')
  a.href = url
  a.download = ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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
