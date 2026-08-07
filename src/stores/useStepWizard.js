/**
 * Step Wizard Store — 12-step report generation workflow state.
 *
 * Tracks step progress, structured data per step, and provides
 * step transition actions for the StepWizard view.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useStepWizardStore = defineStore('stepWizard', () => {
  // ---- Step Definitions (aligned with actual report template chapters) ----
  const STEP_DEFINITIONS = [
    { step: 1,  label: '决策名称与责任单位',      icon: 'EditPen',       agent: 'DataCollector' },
    { step: 2,  label: '拟征地位置图',            icon: 'MapLocation',   agent: 'DataCollector' },
    { step: 3,  label: '征收范围、面积及地上附着物', icon: 'Document',    agent: 'DataCollector' },
    { step: 4,  label: '资金筹措与实施周期',      icon: 'Clock',         agent: 'DataCollector' },
    { step: 5,  label: '公示与座谈照片',          icon: 'Picture',       agent: 'DataCollector' },
    { step: 6,  label: '公众问卷调查',            icon: 'DataAnalysis',  agent: 'SurveyAnalyzer' },
    { step: 7,  label: '单位与利益相关者意见',    icon: 'OfficeBuilding', agent: 'SurveyAnalyzer' },
    { step: 8,  label: '决策综合分析',            icon: 'Notebook',      agent: 'RationalityAgent' },
    { step: 9,  label: '风险因素识别与初始等级',  icon: 'Grid',          agent: 'RiskScorer' },
    { step: 10, label: '措施前风险等级量化评分',  icon: 'Odometer',      agent: 'RiskScorer' },
    { step: 11, label: '风险防范与化解措施',      icon: 'Shield',        agent: 'RiskScorer' },
    { step: 12, label: '结论建议与报告汇总',      icon: 'List',          agent: 'RiskScorer' },
  ]

  // ---- State ----
  const currentStep = ref(1)
  const stepStatuses = ref({})       // {1: 'completed', 2: 'in_progress', ...}
  const structuredData = ref({})     // Typed data per step
  const generatedSections = ref({})  // AI-generated content
  const needsReview = ref(false)     // Human review checkpoint

  // ---- Computed ----
  const steps = computed(() => STEP_DEFINITIONS)

  const currentStepDef = computed(() =>
    STEP_DEFINITIONS.find(s => s.step === currentStep.value) || STEP_DEFINITIONS[0]
  )

  const completedSteps = computed(() =>
    Object.entries(stepStatuses.value)
      .filter(([_, status]) => status === 'completed')
      .map(([step]) => parseInt(step))
  )

  const progress = computed(() => {
    const done = completedSteps.value.length
    return { done, total: 12, percent: Math.round((done / 12) * 100) }
  })

  const isStepComplete = (step) =>
    stepStatuses.value[step] === 'completed'

  const isStepActive = (step) =>
    currentStep.value === step

  const currentAgent = computed(() =>
    currentStepDef.value?.agent || ''
  )

  // Steps that require human review before proceeding
  const REVIEW_STEPS = [8, 10, 12]

  const needsReviewNow = computed(() =>
    REVIEW_STEPS.includes(currentStep.value) && needsReview.value
  )

  // ---- Actions ----

  function initSteps() {
    stepStatuses.value = {}
    structuredData.value = {}
    generatedSections.value = {}
    currentStep.value = 1
    needsReview.value = false
    // Mark step 1 as in_progress
    stepStatuses.value[1] = 'in_progress'
  }

  function setStepStatus(step, status) {
    stepStatuses.value = { ...stepStatuses.value, [step]: status }
  }

  function setNeedsReview(val) {
    needsReview.value = val
  }

  function advanceStep() {
    if (currentStep.value < 12) {
      // Mark current as completed
      setStepStatus(currentStep.value, 'completed')
      // Move to next
      currentStep.value++
      setStepStatus(currentStep.value, 'in_progress')
    } else {
      setStepStatus(12, 'completed')
    }

    // Don't auto-set needsReview here — wait for backend signal
    // via phase_change("reviewing") event
  }

  function goToStep(step) {
    if (step >= 1 && step <= 12) {
      currentStep.value = step
      if (!stepStatuses.value[step]) {
        setStepStatus(step, 'in_progress')
      }
      // Don't auto-set needsReview — wait for backend signal
    }
  }

  function setStructuredData(step, data) {
    structuredData.value = {
      ...structuredData.value,
      [`step_${step}`]: { ...structuredData.value[`step_${step}`], ...data },
    }
  }

  function setGeneratedSection(key, content) {
    generatedSections.value = {
      ...generatedSections.value,
      [key]: content,
    }
  }

  function resetSteps() {
    stepStatuses.value = {}
    structuredData.value = {}
    generatedSections.value = {}
    currentStep.value = 1
    needsReview.value = false
  }

  return {
    // State
    currentStep, stepStatuses, structuredData, generatedSections, needsReview,
    // Computed
    steps, currentStepDef, completedSteps, progress,
    isStepComplete, isStepActive, currentAgent, needsReviewNow, REVIEW_STEPS,
    // Actions
    initSteps, setStepStatus, advanceStep, goToStep,
    setStructuredData, setGeneratedSection, resetSteps, setNeedsReview,
  }
})
