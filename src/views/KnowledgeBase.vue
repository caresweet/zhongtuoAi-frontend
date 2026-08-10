<template>
  <div class="knowledge-base">
    <div class="page-header">
      <h2 class="page-title">知识库管理</h2>
      <div class="header-actions">
        <el-button v-if="activeTab === 'templates'" type="primary" @click="showUploadDialog = true">
          <el-icon><Upload /></el-icon> 上传模板
        </el-button>
        <el-button v-if="activeTab === 'documents'" type="primary" @click="showDocUploadDialog = true">
          <el-icon><Upload /></el-icon> 上传文档
        </el-button>
        <el-button v-if="activeTab === 'documents' && pendingCount > 0" @click="onBatchReindex" :loading="batchIndexing">
          <el-icon><RefreshRight /></el-icon> 批量索引 ({{ pendingCount }})
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <!-- ===== 模板管理 ===== -->
      <el-tab-pane label="模板管理" name="templates">
        <el-card shadow="never" class="filter-card">
          <el-row :gutter="16">
            <el-col :span="8">
              <el-input v-model="searchText" placeholder="搜索模板..." clearable @clear="loadTemplates" @keyup.enter="loadTemplates">
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
            </el-col>
            <el-col :span="6">
              <el-select v-model="filterCategory" placeholder="分类筛选" clearable @change="loadTemplates" style="width: 100%">
                <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
              </el-select>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <TemplateTable
            :templates="store.templates"
            :loading="store.loading"
            :total="store.total"
            @page-change="onTemplatePageChange"
            @view="onViewTemplate"
            @analyze="onAnalyzeTemplate"
            @delete="onDeleteTemplate"
          />
        </el-card>
      </el-tab-pane>

      <!-- ===== 知识文档 ===== -->
      <el-tab-pane label="知识文档" name="documents">
        <el-card shadow="never" class="filter-card">
          <el-row :gutter="12" align="middle">
            <el-col :span="3">
              <el-select v-model="docTypeFilter" placeholder="类型" clearable @change="loadDocuments" style="width: 100%">
                <el-option label="全部" value="" />
                <el-option-group label="── 政策法规 ──">
                  <el-option label="📜 法规" value="regulation" />
                  <el-option label="📋 标准规范" value="standard" />
                </el-option-group>
                <el-option-group label="── 业务素材 ──">
                  <el-option label="📝 稳评案卷" value="example_report" />
                  <el-option label="📊 调查数据" value="survey" />
                  <el-option label="🧑‍⚖️ 专家评审" value="expert_review" />
                  <el-option label="🗺️ 项目材料" value="project_material" />
                  <el-option label="📸 现场照片" value="photo" />
                  <el-option label="✍️ 会议签到" value="meeting" />
                </el-option-group>
                <el-option-group label="── 参考资料 ──">
                  <el-option label="📚 理论文献" value="theory" />
                  <el-option label="📖 工作指南" value="work_guide" />
                  <el-option label="🏢 公司资料" value="company_info" />
                </el-option-group>
                <el-option label="📦 其他" value="other" />
              </el-select>
            </el-col>
            <el-col :span="2">
              <el-select v-model="docDomainFilter" placeholder="领域" clearable @change="loadDocuments" style="width: 100%">
                <el-option label="全部" value="" />
                <el-option label="稳评" value="stability" />
                <el-option label="招标" value="bidding" />
              </el-select>
            </el-col>
            <el-col :span="2">
              <el-select v-model="docStatusFilter" placeholder="状态" clearable @change="loadDocuments" style="width: 100%">
                <el-option label="全部" value="" />
                <el-option label="已索引" value="completed" />
                <el-option label="待索引" value="pending" />
                <el-option label="失败" value="failed" />
              </el-select>
            </el-col>
            <el-col :span="4">
              <el-input v-model="docSearchText" placeholder="搜索标题..." clearable @keyup.enter="loadDocuments" size="default">
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
            </el-col>
            <el-col :span="2">
              <el-button @click="loadDocuments">刷新</el-button>
            </el-col>
          </el-row>
        </el-card>

        <el-card shadow="never" style="margin-top: 16px">
          <el-table
            :data="filteredDocuments"
            v-loading="store.docLoading"
            stripe
            empty-text="暂无文档，上传 PDF/Word/图片 自动入库"
            style="width: 100%"
            size="default"
          >
            <el-table-column prop="id" label="#" width="50" />
            <el-table-column label="文档标题" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="doc-title-cell">
                  <span class="doc-title">{{ row.title }}</span>
                  <span class="doc-filetype">{{ (row.file_type || '').toUpperCase() }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="类型" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="docTypeTag(row.document_type)" effect="plain">
                  {{ docTypeLabel(row.document_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="领域" width="70">
              <template #default="{ row }">
                <el-tag v-if="row.domain === 'bidding'" size="small" type="warning" effect="plain">招标</el-tag>
                <el-tag v-else size="small" type="success" effect="plain">稳评</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="切片" width="60" align="center">
              <template #default="{ row }">
                <span v-if="row.chunk_count > 0" class="chunk-count">{{ row.chunk_count }}</span>
                <span v-else style="color:#c0c4cc">-</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tooltip :content="statusTooltip(row)" placement="top">
                  <el-tag v-if="row.indexed_status === 'completed'" size="small" type="success">✅ 已索引</el-tag>
                  <el-tag v-else-if="row.indexed_status === 'indexing'" size="small" type="warning">⏳ 索引中</el-tag>
                  <el-tag v-else-if="row.extraction_status === 'failed'" size="small" type="danger">❌ 失败</el-tag>
                  <el-tag v-else-if="row.extraction_status === 'pending_ocr'" size="small" type="warning">📸 待OCR</el-tag>
                  <el-tag v-else size="small" type="info">📦 待索引</el-tag>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="大小" width="80">
              <template #default="{ row }">
                {{ formatFileSize(row.file_size) }}
              </template>
            </el-table-column>
            <el-table-column label="上传时间" width="140">
              <template #default="{ row }">
                {{ row.created_at?.substring(0, 16) || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="onReindexDocument(row)" :disabled="row.indexed_status === 'indexing'">
                  索引
                </el-button>
                <el-button link type="danger" size="small" @click="onDeleteDocument(row)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="store.docTotal > 50"
            style="margin-top:16px;justify-content:flex-end"
            background
            layout="total, prev, pager, next"
            :total="store.docTotal"
            :page-size="50"
            @current-change="(p) => { docPage = p; loadDocuments() }"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- Upload Dialogs -->
    <TemplateUploadDialog v-model:visible="showUploadDialog" @success="onUploadSuccess" />
    <DocumentUploadDialog v-model:visible="showDocUploadDialog" @success="onDocUploadSuccess" />

    <!-- Template Detail -->
    <TemplateDetailDrawer
      v-model:visible="showDetailDrawer"
      :template="currentTemplate"
      :placeholders="store.placeholders"
      @analyze="onAnalyzeTemplate"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshRight } from '@element-plus/icons-vue'
import { useKnowledgeStore } from '@/stores/knowledge'
import { getCategories } from '@/api/knowledge'
import TemplateTable from '@/components/knowledge/TemplateTable.vue'
import TemplateUploadDialog from '@/components/knowledge/TemplateUploadDialog.vue'
import TemplateDetailDrawer from '@/components/knowledge/TemplateDetailDrawer.vue'
import DocumentUploadDialog from '@/components/knowledge/DocumentUploadDialog.vue'

const store = useKnowledgeStore()

const activeTab = ref('templates')

// Template state
const searchText = ref('')
const filterCategory = ref('')
const categories = ref([])
const showUploadDialog = ref(false)
const showDetailDrawer = ref(false)
const currentTemplate = ref(null)
const currentTemplatePage = ref(1)

// Document state
const showDocUploadDialog = ref(false)
const docTypeFilter = ref('')
const docDomainFilter = ref('')
const docStatusFilter = ref('')
const docSearchText = ref('')
const docPage = ref(1)
const batchIndexing = ref(false)

onMounted(async () => {
  await loadTemplates()
  loadCategories()
})

function onTabChange(tab) {
  if (tab === 'documents') loadDocuments()
  else loadTemplates()
}

// ---- Template ----
async function loadTemplates() {
  await store.fetchTemplates({ page: currentTemplatePage.value, page_size: 20, search: searchText.value || undefined, category: filterCategory.value || undefined })
}
async function loadCategories() {
  try { const res = await getCategories(); categories.value = res.data || [] } catch (e) {}
}
function onTemplatePageChange(page) { currentTemplatePage.value = page; loadTemplates() }
function onViewTemplate(t) { currentTemplate.value = t; store.fetchTemplate(t.id); showDetailDrawer.value = true }
async function onAnalyzeTemplate(id) { ElMessage.info('分析中...'); store.triggerAnalysis(id).then(() => { ElMessage.success('完成'); loadTemplates() }).catch(() => {}) }
async function onDeleteTemplate(t) {
  try { await ElMessageBox.confirm(`删除「${t.name}」？`, '确认', { type: 'warning' }); await store.removeTemplate(t.id); ElMessage.success('已删除') } catch (e) {}
}
function onUploadSuccess() { showUploadDialog.value = false; loadTemplates(); loadCategories() }

// ---- Document ----
async function loadDocuments() {
  await store.fetchDocuments({
    page: docPage.value, page_size: 50,
    document_type: docTypeFilter.value || undefined,
    domain: docDomainFilter.value || undefined,
    search: docSearchText.value || undefined,
  })
}

const filteredDocuments = computed(() => {
  let docs = store.documents || []
  if (docStatusFilter.value === 'completed') docs = docs.filter(d => d.indexed_status === 'completed')
  else if (docStatusFilter.value === 'pending') docs = docs.filter(d => d.indexed_status !== 'completed' && d.indexed_status !== 'indexing')
  else if (docStatusFilter.value === 'failed') docs = docs.filter(d => d.extraction_status === 'failed' || d.indexed_status === 'failed')
  if (docSearchText.value) {
    const q = docSearchText.value.toLowerCase()
    docs = docs.filter(d => (d.title || '').toLowerCase().includes(q))
  }
  return docs
})

const pendingCount = computed(() => {
  return (store.documents || []).filter(d => d.indexed_status !== 'completed' && d.indexed_status !== 'indexing').length
})

function onDocUploadSuccess() { showDocUploadDialog.value = false; loadDocuments() }

async function onReindexDocument(doc) {
  try {
    ElMessage.info(`索引「${doc.title?.substring(0,30)}」...`)
    await store.reindexDocument(doc.id)
    ElMessage.success('索引完成')
    await loadDocuments()
  } catch (e) {}
}

async function onBatchReindex() {
  try {
    await ElMessageBox.confirm(`确定批量索引全部 ${pendingCount.value} 个待处理文档？`, '批量索引', { type: 'info' })
    batchIndexing.value = true
    const pending = (store.documents || []).filter(d => d.indexed_status !== 'completed' && d.indexed_status !== 'indexing')
    let done = 0
    for (const doc of pending) {
      try {
        await store.reindexDocument(doc.id)
        done++
        ElMessage.info(`索引进度: ${done}/${pending.length}`)
      } catch (e) {}
    }
    ElMessage.success(`批量索引完成: ${done}/${pending.length}`)
    await loadDocuments()
  } catch (e) {} finally { batchIndexing.value = false }
}

async function onDeleteDocument(doc) {
  try {
    await ElMessageBox.confirm(`删除「${doc.title}」？同时清除向量索引。`, '确认', { type: 'warning' })
    await store.removeDocument(doc.id)
    ElMessage.success('已删除')
    await loadDocuments()
  } catch (e) {}
}

// ---- Helpers ----
const docTypeLabels = {
  regulation: '法规', standard: '标准规范',
  example_report: '稳评案卷', survey: '调查数据', expert_review: '专家评审',
  project_material: '项目材料', photo: '现场照片', meeting: '会议签到',
  theory: '理论文献', work_guide: '工作指南', company_info: '公司资料',
  local_regulation: '地方规范', bidding: '招标投标', other: '其他',
}
function docTypeLabel(type) { return docTypeLabels[type] || type }

const docTypeTags = {
  regulation: 'danger', standard: 'warning',
  example_report: 'success', survey: 'primary', expert_review: '',
  project_material: '', photo: 'info', meeting: 'info',
  theory: '', work_guide: '', company_info: '',
  local_regulation: 'danger', other: 'info',
}
function docTypeTag(type) { return docTypeTags[type] || 'info' }

function statusTooltip(row) {
  if (row.index_error) return `错误: ${row.index_error}`
  if (row.extraction_status === 'pending_ocr') return '图片已渲染，待LLM多模态OCR'
  if (row.clean_status === 'auto_cleaned') return '已自动清洗并索引'
  if (row.clean_status === 'confirmed') return '已人工确认清洗'
  return ''
}

function formatFileSize(bytes) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(1) + 'MB'
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
.header-actions {
  display: flex;
  gap: 8px;
}
.filter-card { margin-bottom: 0; }
.doc-title-cell { display: flex; align-items: center; gap: 8px; }
.doc-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.doc-filetype {
  flex-shrink: 0;
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  color: #909399;
  font-weight: 500;
}
.chunk-count {
  font-weight: 600;
  color: #409eff;
  background: #ecf5ff;
  padding: 1px 6px;
  border-radius: 8px;
  font-size: 12px;
}
</style>
