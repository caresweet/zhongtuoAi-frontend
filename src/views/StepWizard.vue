<template>
  <div class="step-wizard">
    <!-- Phase: Error state -->
    <div v-if="reportStore.status === 'error'" class="error-state">
      <el-icon :size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
      <p>会话启动失败：{{ reportStore.error || '未知错误' }}</p>
      <el-button type="primary" @click="startNewReport">重新开始</el-button>
    </div>

    <!-- Phase: Template auto-selecting or fallback -->
    <template v-else-if="reportStore.status === 'idle'">
      <div class="auto-start-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p v-if="autoStarting">正在准备报告生成环境...</p>
        <p v-else>正在加载...</p>
      </div>
    </template>

    <!-- Phase: Active Generation -->
    <template v-else>
      <div class="wizard-layout">
        <!-- Left Sidebar: Data Progress + Chapter Progress + Agent Status -->
        <div class="wizard-sidebar">
          <!-- Chapter Progress (auto-shown when backend enters generation mode) -->
          <ChapterProgressBar
            v-if="reportStore.generationMode === 'chapter_by_chapter'"
            :chapters="chapterProgressData"
            :total-chapters="10"
            @chapter-click="onChapterClick"
          />
        </div>

        <!-- Center: Download bar + Chat -->
        <div class="wizard-main">
          <!-- Download bar (shown when report is ready) -->
          <div v-if="reportStore.downloadUrl" class="download-bar">
            <el-icon :size="18" color="#67c23a"><CircleCheckFilled /></el-icon>
            <span>报告已完成</span>
            <el-button
              type="success"
              size="small"
              @click="downloadReport"
            >
              <el-icon><Download /></el-icon> 下载
            </el-button>
            <el-button size="small" @click="startNewReport">
              新建报告
            </el-button>
          </div>

          <!-- Chat Messages -->
          <ChatContainer
            :messages="reportStore.messages"
            :is-streaming="reportStore.isStreaming"
            @chapter-click="onChapterClick"
          />

          <!-- Chat Input (always text+image mode) -->
          <ChatInput
            :disabled="!reportStore.canInput"
            :loading="reportStore.isStreaming"
            placeholderType="text_image"
            :collectingPrompt="reportStore.collectingPromptText"
            :chapterReviewMode="isChapterReviewMode"
            :reviewChapterNum="reviewChapterNum"
            :reviewChapterTitle="reviewChapterTitle"
            @send="onSendMessage"
            @approveChapter="onApproveChapter"
            @skipChapter="onSkipChapter"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, CircleCheckFilled, Download, CircleCloseFilled } from '@element-plus/icons-vue'
import { useReportStore } from '@/stores/report'
import { useAgentStatusStore } from '@/stores/useAgentStatus'
import { useChapterStore } from '@/stores/chapter'
import ChatContainer from '@/components/report/ChatContainer.vue'
import ChatInput from '@/components/report/ChatInput.vue'
import ChapterProgressBar from '@/components/report/ChapterProgressBar.vue'

const reportStore = useReportStore()
const agentStore = useAgentStatusStore()
const chapterStore = useChapterStore()

const autoStarting = ref(false)

// ---- Chapter Review Mode ----

const isChapterReviewMode = computed(() =>
  reportStore.phase === 'chapter_review' && reportStore.chapterReviewPending
)

const reviewChapterNum = computed(() =>
  reportStore.currentReviewChapter || chapterStore.currentChapter
)

const reviewChapterTitle = computed(() => {
  const ch = chapterStore.chapters.find(c => c.number === reviewChapterNum.value)
  return ch?.title || ''
})

const chapterProgressData = computed(() =>
  chapterStore.chapters.map(ch => ({
    number: ch.number,
    title: ch.title,
    shortTitle: ch.shortTitle,
    status: ch.status,
    active: ch.active,
  }))
)

// ---- Lifecycle ----

onMounted(async () => {
  if (reportStore.status === 'error') {
    reportStore.resetState()
  }
  if (reportStore.status !== 'idle') return
  try {
    autoStarting.value = true
    agentStore.resetAgents()
    reportStore.useMasterAgent = true
    await reportStore.startGeneration('你好', 0, '')
  } catch (e) {
    autoStarting.value = false
  }
})

// ---- Actions ----

function onChapterClick(chapterNum) {
  // Scroll to the chapter in the chat or show its review card
  ElMessage.info(`第${chapterNum}章`)
}

function onApproveChapter() {
  if (reviewChapterNum.value > 0) {
    reportStore.confirmChapter(reviewChapterNum.value)
  }
}

function onSkipChapter() {
  if (reviewChapterNum.value > 0) {
    reportStore.skipChapterAction(reviewChapterNum.value)
  }
}

async function onSendMessage(text, images, date, folderStructure) {
  // 🔴 Chapter review mode: if user sends text without files, treat as revision
  if (isChapterReviewMode.value && text.trim() && (!images || !images.length)) {
    reportStore.reviseChapter(reviewChapterNum.value, text.trim())
    return
  }

  const attachmentPaths = []
  const imageMetas = []

  if (images?.length) {
    for (const file of images) {
      const name = (file.name || '').toLowerCase()
      let fileType = 'image'
      let label = '图片'
      if (name.endsWith('.pdf')) { fileType = 'pdf'; label = 'PDF文档' }
      else if (name.endsWith('.docx') || name.endsWith('.doc')) { fileType = 'docx'; label = 'Word文档' }
      else if (name.endsWith('.xlsx') || name.endsWith('.xls')) { fileType = 'xlsx'; label = 'Excel表格' }
      else if (name.endsWith('.txt') || name.endsWith('.md')) { fileType = 'text'; label = '文本文件' }
      else if (name.endsWith('.zip') || name.endsWith('.rar')) { fileType = 'archive'; label = '压缩包' }
      else if (file.type === 'pdf') { fileType = 'pdf'; label = 'PDF文档' }
      else if (file.type === 'docx') { fileType = 'docx'; label = 'Word文档' }
      else if (file.type === 'xlsx') { fileType = 'xlsx'; label = 'Excel表格' }

      imageMetas.push({
        path: '',
        url: file.url || '',
        name: file.name || label,
        uploading: true,
        file_type: fileType,
      })
    }

    const uploadResults = await Promise.allSettled(
      images.map((file, i) => reportStore.uploadFile(file.file).then(r => ({ result: r, index: i })))
    )

    const uploadErrors = []
    uploadResults.forEach(p => {
      if (p.status === 'fulfilled') {
        const { result, index: i } = p.value
        const file = images[i]
        if (result?.file_path) {
          attachmentPaths.push(result.file_path)
          imageMetas[i] = {
            path: result.file_path,
            url: result.url || imageMetas[i].url,
            name: result.original_name || file.name || '文件',
            uploading: false,
            file_type: result.file_type || imageMetas[i].file_type,
          }
        }
      } else {
        const i = p.reason?.index ?? 0
        const file = images[i] || {}
        const name = (file.name || '').toLowerCase()
        let label = '文件'
        if (name.endsWith('.pdf')) label = 'PDF'
        else if (name.endsWith('.docx') || name.endsWith('.doc')) label = 'Word'
        else if (name.endsWith('.xlsx') || name.endsWith('.xls')) label = 'Excel'
        else if (/\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(name)) label = '图片'
        uploadErrors.push(`${file.name || '未知文件'}: ${p.reason?.message || '上传失败'}`)
        if (imageMetas[i]) imageMetas[i].error = p.reason?.message || '上传失败'
      }
    })

    if (uploadErrors.length > 0 && attachmentPaths.length === 0) {
      ElMessage.error(`文件上传失败: ${uploadErrors.join(', ')}`)
    } else if (uploadErrors.length > 0) {
      ElMessage.warning(`部分文件上传失败: ${uploadErrors.join(', ')}`)
    }
  }

  let messageText = text || ''
  if (date && !messageText.includes(date)) {
    messageText = messageText ? `${messageText}（${date}）` : date
  }

  if (!messageText.trim() && attachmentPaths.length > 0) {
    if (folderStructure) {
      messageText = `[上传了文件夹「${folderStructure.name}」，包含 ${attachmentPaths.length} 个文件]`
    } else {
      messageText = `[上传了 ${attachmentPaths.length} 个文件]`
    }
  }

  if (!messageText.trim() && !attachmentPaths.length && imageMetas.every(m => m.error)) return

  await reportStore.sendMessage(
    messageText,
    attachmentPaths.length > 0 ? attachmentPaths : null,
    null,
    imageMetas.length > 0 ? imageMetas : null,
    folderStructure || null,
  )
}

function downloadReport() {
  if (reportStore.downloadUrl) {
    window.open(reportStore.downloadUrl, '_blank')
  }
}

function startNewReport() {
  reportStore.resetState()
  chapterStore.resetAll()
  autoStarting.value = false
}
</script>

<style scoped>
.step-wizard { height: 100%; }

.wizard-layout {
  display: flex;
  gap: 12px;
  height: calc(100vh - 100px);
  padding: 0 8px;
}

/* ─── Left Sidebar ─── */
.wizard-sidebar {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
}
@media (max-width: 900px) {
  .wizard-sidebar { display: none; }
}

/* ─── Main Area ─── */
.wizard-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

/* ─── Download Bar ─── */
.download-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #f0f9eb;
  border-bottom: 1px solid #e1f3d8;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  flex-shrink: 0;
}

.download-bar .el-button {
  margin-left: auto;
}
.download-bar .el-button + .el-button {
  margin-left: 8px;
}

/* ─── Chat Container (fills available space) ─── */
.wizard-main :deep(.chat-container) {
  flex: 1;
  border: none;
  border-radius: 0;
}

/* ─── Chat Input ─── */
.wizard-main :deep(.chat-input-area) {
  border: none;
  border-top: 1px solid #e4e7ed;
  border-radius: 0;
  flex-shrink: 0;
}

/* ─── Auto Start Loading ─── */
.auto-start-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #909399;
}
.auto-start-loading p {
  margin-top: 16px;
  font-size: 14px;
}

/* ─── Error State ─── */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #909399;
  gap: 16px;
}
.error-state p {
  font-size: 14px;
  color: #f56c6c;
}
</style>
