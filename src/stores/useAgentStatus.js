/**
 * Agent Status Store — tracks multi-agent activity in the 12-step workflow.
 *
 * Manages agent lifecycle: idle → thinking → acting → completed.
 * Each agent runs independently and emits status via SSE events.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAgentStatusStore = defineStore('agentStatus', () => {
  // ---- Agent Registry ----
  const AGENT_DEFS = {
    MasterAgent:      { name: 'MasterAgent',      label: '主智能体',     icon: '🤖', steps: '全部' },
    DataCollector:    { name: 'DataCollector',    label: '数据收集器',   icon: '📥', steps: '1-5' },
    SurveyAnalyzer:   { name: 'SurveyAnalyzer',   label: '调查分析器',   icon: '📊', steps: '6-7' },
    RationalityAgent: { name: 'RationalityAgent', label: '合理性分析器', icon: '🧠', steps: '8' },
    RiskScorer:       { name: 'RiskScorer',       label: '风险评估器',   icon: '🎯', steps: '9-12' },
    Orchestrator:     { name: 'Orchestrator',     label: '协调调度器',   icon: '🔄', steps: '全部' },
  }

  // ---- State ----
  const agentStatuses = ref({})    // {agentName: 'idle'|'thinking'|'acting'|'completed'|'waiting_review'}
  const agentMessages = ref({})    // {agentName: 'last status message'}
  const agentLog = ref([])         // [{agent, timestamp, action, issues, elapsed_sec}]

  // ---- Computed ----
  const activeAgents = computed(() =>
    Object.entries(agentStatuses.value)
      .filter(([_, status]) => ['thinking', 'acting'].includes(status))
      .map(([name]) => name)
  )

  const hasActiveAgents = computed(() => activeAgents.value.length > 0)

  const agentList = computed(() =>
    Object.entries(AGENT_DEFS).map(([key, def]) => ({
      ...def,
      status: agentStatuses.value[key] || 'idle',
      message: agentMessages.value[key] || '',
    }))
  )

  // ---- Actions ----

  function setAgentStatus(agent, status, message = '') {
    agentStatuses.value = { ...agentStatuses.value, [agent]: status }
    if (message) {
      agentMessages.value = { ...agentMessages.value, [agent]: message }
    }
  }

  function addLogEntry(entry) {
    agentLog.value = [...agentLog.value.slice(-50), entry]  // Keep last 50
  }

  function handleAgentSSE(event, data) {
    switch (event) {
      case 'agent_status':
        if (data.agent && data.status) {
          setAgentStatus(data.agent, data.status, data.message || '')
          if (data.status === 'completed') {
            addLogEntry({
              agent: data.agent,
              timestamp: Date.now(),
              action: data.message || '',
              issues: data.issues || [],
            })
          }
        }
        break

      case 'step_transition':
        if (data.step && data.label) {
          addLogEntry({
            agent: 'Orchestrator',
            timestamp: Date.now(),
            action: `步骤${data.step}/12: ${data.label}`,
            issues: [],
          })
        }
        break

      case 'thinking':
        // Agent thinking content is displayed in the chat/thinking panel
        break
    }
  }

  function resetAgents() {
    agentStatuses.value = {}
    agentMessages.value = {}
    agentLog.value = []
  }

  return {
    AGENT_DEFS,
    agentStatuses, agentMessages, agentLog,
    activeAgents, hasActiveAgents, agentList,
    setAgentStatus, addLogEntry, handleAgentSSE, resetAgents,
  }
})
