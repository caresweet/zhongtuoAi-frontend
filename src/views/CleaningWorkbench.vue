<template>
  <div class="clean-page">
    <h2><el-icon><Brush /></el-icon> 数据清洗</h2>

    <!-- Step 1: Select document -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <template #header>📄 选择文档</template>
      <el-select
        v-model="selectedId"
        placeholder="请选择要清洗的文档..."
        filterable
        style="width: 100%"
        @change="onSelectDoc"
        :loading="docsLoading"
      >
        <el-option
          v-for="d in docs"
          :key="d.id"
          :label="d.title"
          :value="d.id"
        >
          <span>{{ d.title }}</span>
          <el-tag size="small" style="float:right" :type="typeTagType(d.document_type)">
            {{ typeLabel(d) }}
          </el-tag>
        </el-option>
      </el-select>
    </el-card>

    <!-- Step 2: Rules -->
    <el-card shadow="never" style="margin-bottom: 12px">
      <template #header>⚙️ 清洗规则</template>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        <el-checkbox v-for="r in rules" v-model="r.on" :key="r.key">
          {{ r.label }}
        </el-checkbox>
      </div>
      <div style="margin-top:12px">
        <el-button type="primary" @click="doClean" :loading="cleaning" :disabled="!selectedId">
          {{ cleaning ? '清洗中...' : '🔍 开始清洗预览' }}
        </el-button>
        <el-button type="success" @click="doConfirm" :disabled="!cleanedText" style="margin-left:8px">
          ✅ 确认入库
        </el-button>
      </div>
    </el-card>

    <!-- Step 3: Results -->
    <el-card shadow="never" v-if="stats">
      <template #header>
        📊 清洗结果
        <span style="font-weight:normal;font-size:13px;color:#909399;margin-left:12px">
          原始 {{ stats.raw_chars }}字 → 清洗后 {{ stats.cleaned_chars }}字
          (移除 {{ stats.removed_chars }}字) | Token ≈ {{ stats.token_estimate }}
        </span>
      </template>

      <el-input
        v-model="displayText"
        type="textarea"
        :rows="25"
        readonly
        style="font-family:monospace;font-size:13px"
      />

      <div v-if="issues.length" style="margin-top:8px;max-height:120px;overflow-y:auto">
        <div v-for="(iss,i) in issues.slice(0,10)" :key="i"
          style="font-size:12px;color:#909399;padding:2px 0">
          <el-tag size="small" type="info" effect="plain">{{ iss.type }}</el-tag>
          第{{ iss.line }}行: {{ iss.description }}
        </div>
      </div>
    </el-card>

    <!-- Extracted Tables -->
    <el-card shadow="never" v-if="tables.length" style="margin-top:12px">
      <template #header>
        📊 提取的表格 ({{ tables.length }}个)
      </template>
      <el-collapse>
        <el-collapse-item v-for="(tbl, ti) in tables" :key="ti"
          :title="'表' + tbl.table_index + ': ' + (tbl.headers || []).join(' | ').substring(0, 80)"
        >
          <div style="overflow-x:auto">
            <table class="extracted-table">
              <thead>
                <tr>
                  <th v-for="(h, hi) in tbl.headers" :key="hi">{{ h }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in tbl.rows.slice(0, 30)" :key="ri">
                  <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style="font-size:12px;color:#909399;margin-top:8px">
            来源: {{ tbl.source }} | {{ tbl.row_count }}行 × {{ tbl.col_count }}列 | 置信度: {{ (tbl.confidence * 100).toFixed(0) }}%
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import client from '@/api/client'
import { ElMessage } from 'element-plus'

const docs = ref([])
const docsLoading = ref(false)
const selectedId = ref('')
const cleaning = ref(false)
const displayText = ref('')
const cleanedText = ref('')
const stats = ref(null)
const issues = ref([])
const tables = ref([])

const rules = ref([
  { key: 'remove_toc', label: '移除目录', on: true },
  { key: 'remove_headers_footers', label: '移除页眉页脚', on: true },
  { key: 'remove_page_numbers', label: '移除页码', on: true },
  { key: 'remove_watermarks', label: '移除水印', on: true },
  { key: 'normalize_dates', label: '日期归一化', on: true },
  { key: 'normalize_punctuation', label: '全角转半角', on: false },
  { key: 'compress_blank_lines', label: '空白压缩', on: true },
  { key: 'table_linearization', label: '表格转文字', on: false },
  { key: 'sensitive_masking', label: '敏感脱敏', on: false },
])

async function loadDocs() {
  docsLoading.value = true
  try {
    const res = await client.get('/knowledge/cleaning/documents')
    docs.value = res.data?.items || []
  } catch (e) {
    ElMessage.error('加载文档列表失败')
  } finally {
    docsLoading.value = false
  }
}

const TYPE_LABELS = { template: '模板', example_report: '报告示例', format: '格式规范', standard: '标准规范', regulation: '法规', other: '其他' }
function typeLabel(d) { return TYPE_LABELS[d.document_type] || d.document_type || '文档' }
function typeTagType(t) { return t === 'template' ? 'warning' : t === 'format' ? 'info' : t === 'example_report' ? 'success' : t === 'standard' ? '' : '' }

function onSelectDoc() {
  displayText.value = ''
  cleanedText.value = ''
  stats.value = null
  issues.value = []
  tables.value = []
}

async function doClean() {
  if (!selectedId.value) return
  cleaning.value = true
  displayText.value = '清洗中...'
  try {
    const config = {}
    rules.value.forEach(r => { config[r.key] = r.on })
    const res = await client.post('/knowledge/cleaning/preview', {
      composite_id: selectedId.value,
      config,
    }, { timeout: 300000 })
    const d = res.data
    cleanedText.value = d.cleaned_text || ''
    displayText.value = cleanedText.value
    stats.value = {
      raw_chars: d.raw_chars,
      cleaned_chars: d.cleaned_chars,
      removed_chars: d.removed_chars,
      token_estimate: d.token_estimate,
    }
    issues.value = d.issues_found || []
    tables.value = d.extracted_tables || []
    ElMessage.success(`完成！移除 ${d.removed_chars} 字，提取 ${tables.value.length} 个表格`)
  } catch (e) {
    displayText.value = ''
    ElMessage.error('清洗失败: ' + (e.response?.data?.detail || e.message))
  } finally {
    cleaning.value = false
  }
}

async function doConfirm() {
  if (!selectedId.value || !cleanedText.value) return
  try {
    // Only knowledge documents can be reindexed via this path
    if (selectedId.value.startsWith('doc_')) {
      const realId = parseInt(selectedId.value.slice(4))
      await client.post(`/knowledge/documents/${realId}/clean/apply`, {
        cleaned_text: cleanedText.value,
        config: rules.value.reduce((c, r) => { c[r.key] = r.on; return c }, {}),
      })
      await client.post(`/knowledge/documents/${realId}/reindex`)
      ElMessage.success('已入库！')
    } else {
      ElMessage.info('模板文档已清洗，可在报告生成时使用')
    }
  } catch (e) {
    ElMessage.error('入库失败: ' + (e.response?.data?.detail || e.message))
  }
}

onMounted(loadDocs)
</script>

<style scoped>
.clean-page { max-width: 900px; margin: 0 auto; padding: 16px; }
.clean-page h2 { display:flex; align-items:center; gap:8px; margin:0 0 12px 0; font-size:18px; }

.extracted-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.extracted-table th, .extracted-table td {
  border: 1px solid #dcdfe6;
  padding: 6px 10px;
  text-align: left;
  white-space: nowrap;
}
.extracted-table th {
  background: #f5f7fa;
  font-weight: 600;
}
.extracted-table tr:hover td {
  background: #ecf5ff;
}
</style>
