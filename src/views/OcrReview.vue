<template>
  <div class="app-page">
    <div class="page-title">问卷 OCR 校对工作台</div>

    <el-row :gutter="12" style="margin-bottom:14px">
      <el-col :span="14">
        <el-select v-model="docId" placeholder="选择项目" style="width:340px" @change="loadRecords">
          <el-option v-for="p in projects" :key="p.doc_id" :label="`${p.doc}（${p.pages}页 / 已校${p.done}）`" :value="p.doc_id" />
        </el-select>
      </el-col>
      <el-col :span="10" style="text-align:right">
        <el-button @click="loadRecords" :disabled="!docId">刷新</el-button>
        <el-button type="success" plain :disabled="!savedCount" @click="exportData">导出已校对</el-button>
      </el-col>
    </el-row>

    <el-row v-if="records.length">
      <el-col :span="24">
        <div class="stats-bar">共 <b>{{ records.length }}</b> 条 · 已校对 <b class="ok">{{ doneCount }}</b> 条 · 待校 <b class="warn">{{ records.length - doneCount }}</b> 条</div>
      </el-col>
    </el-row>

    <el-row :gutter="14" v-loading="loading">
      <el-col v-for="(r, i) in records" :key="i" :xs="24" :md="12" :lg="8">
        <div class="rev-card" :class="{ done: r.status === 'done' }">
          <div class="rev-head">
            <span class="rev-no">第 {{ r.page }} 页</span>
            <el-tag v-if="r.status === 'done'" type="success" size="small">已校对</el-tag>
            <el-tag v-else size="small" type="info">待校</el-tag>
          </div>
          <div class="rev-img">
            <img :src="imgUrl(r)" alt="问卷页" />
          </div>
          <div class="rev-text">
            <div class="rev-orig">原识别（{{ r.text.length }}字）</div>
            <el-input
              v-model="r.corrected"
              :placeholder="'无校对则以原识别为准'"
              type="textarea"
              :rows="7"
              resize="none"
            />
          </div>
          <div class="rev-foot">
            <el-button size="small" type="primary" :disabled="!r.corrected" @click="save(r)">保存校对</el-button>
            <el-button size="small" @click="markTodo(r)" v-if="r.status==='done'">标为待校</el-button>
          </div>
        </div>
      </el-col>
    </el-row>
    <el-empty v-if="!loading && !records.length" description="请选择上方项目加载问卷页" />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import client from '@/api/client'

const projects = ref([])
const docId = ref(null)
const records = ref([])
const loading = ref(false)

const doneCount = computed(() => records.value.filter(r => r.status === 'done').length)
const savedCount = computed(() => records.value.filter(r => r.status === 'done').length)

onMounted(async () => {
  const { data } = await client.get('/ocr-review/projects')
  projects.value = (data && data.data) || []
  if (projects.value.length) { docId.value = projects.value[0].doc_id; loadRecords() }
})

async function loadRecords() {
  if (!docId.value) return
  loading.value = true
  try {
    const { data } = await client.get('/ocr-review/records', { params: { doc_id: docId.value } })
    records.value = (data && data.data) || []
    // 默认以原识别为基准
    records.value.forEach(r => { if (r.corrected == null) r.corrected = r.text })
  } finally { loading.value = false }
}

function imgUrl(r) { return `/api/v1/ocr-review/image/${r.doc_id}/${r.page}` }

async function save(r) {
  await client.put('/ocr-review/records', { doc_id: r.doc_id, page: r.page, text: r.corrected, status: 'done' })
  r.status = 'done'
  ElMessage.success(`第${r.page}页已保存`)
}

async function markTodo(r) {
  await client.put('/ocr-review/records', { doc_id: r.doc_id, page: r.page, text: r.corrected, status: 'todo' })
  r.status = 'todo'
}

async function exportData() {
  const resp = await client.get('/ocr-review/export', { responseType: 'blob' })
  const url = URL.createObjectURL(resp.data)
  const a = document.createElement('a')
  a.href = url; a.download = 'ocr_review_training.jsonl'; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('已导出，可作 OCR 训练/复核数据')
}
</script>

<style scoped>
.stats-bar { margin: 4px 0 14px; color: #6b7692; font-size: 13px }
.stats-bar b { color: #2e5bff } .stats-bar b.ok { color: #18b879 } .stats-bar b.warn { color: #f5a524 }
.rev-card {
  background: #fff; border-radius: 12px; padding: 12px;
  border: 1px solid #eef1f7; box-shadow: 0 4px 14px rgba(20,40,100,.05);
  margin-bottom: 14px;
}
.rev-card.done { border-color: #bcefdc }
.rev-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px }
.rev-no { font-weight: 600; color: #18213a }
.rev-img { border-radius: 8px; overflow: hidden; border: 1px solid #eef1f7; background: #f4f6fb }
.rev-img img { width: 100%; display: block }
.rev-text { margin-top: 8px }
.rev-orig { font-size: 11px; color: #9aa3b8; margin-bottom: 4px }
.rev-foot { margin-top: 8px; display: flex; gap: 8px }
</style>
