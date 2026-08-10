/**
 * Chapter Generation Store — manages chapter-by-chapter generation state.
 *
 * Coordinates with report.js store for SSE event handling.
 * Tracks per-chapter progress, user confirmation, and revision management.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

export const useChapterStore = defineStore('chapter', () => {
  // ---- Generation Mode ----
  const generationMode = ref('chat') // 'chat' | 'chapter_by_chapter'

  // ---- Chapter Data ----
  // Array of 10 chapter objects: { number, title, status, markdown, tables, sources, confirmedAt }
  const chapters = ref(
    Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      title: getDefaultTitle(i + 1),
      shortTitle: getShortTitle(i + 1),
      status: 'pending', // pending | generating | review | approved | revised
      markdown: '',
      tables: [],
      sources: [],
      revisionHistory: [],
      confirmedAt: null,
      active: false,
      generationAttempts: 0,
    }))
  )

  // ---- Current State ----
  const currentChapter = ref(1)
  const phase = ref('idle') // idle | generating | chapter_review | review_table | complete
  const reviewPending = ref(false)
  const isStreaming = ref(false)

  // ---- Actions ----
  const approving = ref(false)
  const revising = ref(false)
  const skipping = ref(false)

  // ---- Audit ----
  const qualityAudit = ref(null)

  // ---- Computed ----
  const totalChapters = computed(() => 10)

  const confirmedCount = computed(() =>
    chapters.value.filter(c => c.status === 'approved').length
  )

  const currentChapterData = computed(() =>
    chapters.value.find(c => c.number === currentChapter.value)
  )

  const allConfirmed = computed(() =>
    chapters.value.every(c => c.status === 'approved')
  )

  const progressPercent = computed(() =>
    Math.round((confirmedCount.value / totalChapters.value) * 100)
  )

  // ---- Chapter Management ----

  function setChapterGenerating(chapterNum) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.status = 'generating'
      ch.active = true
    }
    currentChapter.value = chapterNum
    isStreaming.value = true
    reviewPending.value = false
  }

  function updateChapterContent(chapterNum, markdown, tables = [], sources = []) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.markdown = markdown
      ch.tables = tables || []
      ch.sources = sources || []
      ch.status = 'review'
      ch.active = true
    }
    isStreaming.value = false
    reviewPending.value = true
  }

  function appendChapterStream(chapterNum, delta) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.markdown += delta
    }
  }

  function confirmChapter(chapterNum) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.status = 'approved'
      ch.active = false
      ch.confirmedAt = new Date().toISOString()
    }
    approving.value = false
    reviewPending.value = false

    if (chapterNum < 10) {
      currentChapter.value = chapterNum + 1
    }

    ElMessage.success(`第${chapterNum}章已确认`)
  }

  function setChapterRevision(chapterNum) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.status = 'revised'
      ch.generationAttempts++
    }
    revising.value = false
    reviewPending.value = false
    ElMessage.info(`正在重新生成第${chapterNum}章...`)
  }

  function skipChapter(chapterNum) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.status = 'approved'
      ch.markdown += '\n\n【本章由用户跳过】'
      ch.active = false
      ch.confirmedAt = new Date().toISOString()
    }
    skipping.value = false
    reviewPending.value = false

    if (chapterNum < 10) {
      currentChapter.value = chapterNum + 1
    }

    ElMessage.info(`第${chapterNum}章已跳过`)
  }

  function addRevisionHistory(chapterNum, request) {
    const ch = chapters.value.find(c => c.number === chapterNum)
    if (ch) {
      ch.revisionHistory.push({
        timestamp: new Date().toISOString(),
        request,
        attempt: ch.revisionHistory.length + 1,
      })
    }
  }

  // ---- Quality Audit ----

  function setQualityAudit(auditData) {
    qualityAudit.value = auditData
  }

  // ---- Reset ----

  function resetAll() {
    chapters.value = Array.from({ length: 10 }, (_, i) => ({
      number: i + 1,
      title: getDefaultTitle(i + 1),
      shortTitle: getShortTitle(i + 1),
      status: 'pending',
      markdown: '',
      tables: [],
      sources: [],
      revisionHistory: [],
      confirmedAt: null,
      active: false,
      generationAttempts: 0,
    }))
    currentChapter.value = 1
    phase.value = 'idle'
    reviewPending.value = false
    isStreaming.value = false
    approving.value = false
    revising.value = false
    skipping.value = false
    qualityAudit.value = null
    generationMode.value = 'chat'
  }

  return {
    chapters,
    currentChapter,
    phase,
    reviewPending,
    isStreaming,
    generationMode,
    approving, revising, skipping,
    qualityAudit,
    // Computed
    totalChapters,
    confirmedCount,
    currentChapterData,
    allConfirmed,
    progressPercent,
    // Actions
    setChapterGenerating,
    updateChapterContent,
    appendChapterStream,
    confirmChapter,
    setChapterRevision,
    skipChapter,
    addRevisionHistory,
    setQualityAudit,
    resetAll,
  }
})

// ---- Helpers ----

function getDefaultTitle(num) {
  const titles = {
    1: '拟征收决策基本概况',
    2: '评估过程、方法和依据',
    3: '社会稳定风险因素调查',
    4: '决策综合分析',
    5: '风险因素识别与初始等级表',
    6: '措施前风险等级研判',
    7: '风险防范与化解措施',
    8: '措施后风险等级评估',
    9: '评估结论与建议',
    10: '应急预案',
  }
  return titles[num] || `第${num}章`
}

function getShortTitle(num) {
  const shorts = {
    1: '基本概况', 2: '评估方法', 3: '风险调查', 4: '综合分析',
    5: '风险识别', 6: '措施前', 7: '化解措施', 8: '措施后',
    9: '结论建议', 10: '应急预案',
  }
  return shorts[num] || `章${num}`
}
