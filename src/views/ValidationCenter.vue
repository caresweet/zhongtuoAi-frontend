<template>
  <div class="app-page">
    <div class="page-title">校验规则与报告体检</div>

    <el-tabs v-model="tab">
      <!-- ═══ 规则管理 ═══ -->
      <el-tab-pane label="规则管理" name="rules">
        <el-alert type="info" :closable="false" style="margin-bottom:12px"
          title="规则随生成后自动比对；阈值与依据可在此动态调整（对齐公司模板口径），修改即时生效。" />
        <el-table :data="rules" v-loading="loading" size="default" style="width:100%">
          <el-table-column prop="metric" label="指标" width="150" />
          <el-table-column label="判定" width="110">
            <template #default="{ row }">
              <el-select v-model="row.rule" size="small">
                <el-option label="≥" value="ge" />
                <el-option label="≤" value="le" />
                <el-option label="=" value="eq" />
                <el-option label="区间" value="between" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="阈值" width="170">
            <template #default="{ row }">
              <el-input v-model="row._valueText" size="small" :placeholder="row.rule==='between'?'60~99.5':'95'" />
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" />
          <el-table-column label="严重度" width="90">
            <template #default="{ row }">
              <el-select v-model="row.severity" size="small">
                <el-option label="预警" value="warn" />
                <el-option label="严重" value="critical" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="basis" label="依据/说明" min-width="240" show-overflow-tooltip />
          <el-table-column label="启用" width="70" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button size="small" type="primary" plain @click="saveRule(row)">保存</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-button size="small" style="margin-top:12px" @click="resetRules">恢复默认规则</el-button>
      </el-tab-pane>

      <!-- ═══ 报告体检 ═══ -->
      <el-tab-pane label="报告体检" name="check">
        <div style="margin-bottom:14px">
          <el-input v-model="sessionId" placeholder="输入报告会话ID（可从生成/历史报告处获取）" style="width:340px" />
          <el-button type="primary" style="margin-left:8px" :loading="checking" @click="runCheck">体检</el-button>
        </div>

        <template v-if="checkResult">
          <el-alert v-if="checkResult.rule_issues.length === 0 && !checkResult.missing.length" type="success" title="未发现问题 ✓" :closable="false" style="margin-bottom:12px" />
          <template v-for="(it, i) in checkResult.rule_issues" :key="'r'+i">
            <el-alert :type="it.severity==='critical'?'error':'warning'" :closable="false" style="margin-bottom:8px"
              :title="it.message" :description="'依据：'+it.basis" />
          </template>
          <el-card v-if="checkResult.missing.length" style="margin-top:12px">
            <template #header><span>必填数据核对单（基础数据缺口）</span></template>
            <el-tag v-for="m in checkResult.missing" :key="m.field" type="danger" style="margin:0 6px 6px 0">{{ m.chapter }} {{ m.label }}</el-tag>
          </el-card>
          <el-card v-if="checkResult.metrics && Object.keys(checkResult.metrics).length" style="margin-top:12px">
            <template #header><span>可量化指标（已提取）</span></template>
            <el-tag v-for="(v,k) in checkResult.metrics" :key="k" type="info" style="margin:0 6px 6px 0">{{ k }} = {{ v }}</el-tag>
          </el-card>
        </template>
        <el-empty v-else-if="!checking" description="输入报告会话ID后点击「体检」" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import client from '@/api/client'

const tab = ref('rules')
const rules = ref([])
const loading = ref(false)
const sessionId = ref('')
const checkResult = ref(null)
const checking = ref(false)

onMounted(load)

async function load() {
  loading.value = true
  try {
    const { data } = await client.get('/check-rules')
    rules.value = (data.data || []).map(r => ({ ...r, _valueText: fmtValue(r) }))
  } finally { loading.value = false }
}

function fmtValue(r) {
  if (r.rule === 'between' && Array.isArray(r.value)) return `${r.value[0]}~${r.value[1]}`
  return String(r.value ?? '')
}

function parseValue(row) {
  const s = (row._valueText || '').trim()
  if (row.rule === 'between') {
    const m = s.split(/[~～,，\-]/).map(x => parseFloat(x))
    return [m[0], m[1]]
  }
  return parseFloat(s)
}

async function saveRule(row) {
  try {
    await client.put(`/check-rules/${row.id}`, {
      rule: row.rule, value: parseValue(row), severity: row.severity, enabled: row.enabled,
    })
    ElMessage.success('已保存')
  } catch (e) { ElMessage.error(e.message || '保存失败') }
}

async function resetRules() {
  await client.post('/check-rules/reset')
  ElMessage.success('已恢复默认')
  load()
}

async function runCheck() {
  if (!sessionId.value.trim()) return ElMessage.warning('请输入会话ID')
  checking.value = true; checkResult.value = null
  try {
    const { data } = await client.get(`/check-rules/report/${sessionId.value.trim()}`)
    checkResult.value = data.data || {}
  } catch (e) { ElMessage.error(e.response?.data?.detail || '体检失败') }
  finally { checking.value = false }
}
</script>
