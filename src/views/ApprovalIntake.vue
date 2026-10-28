<template>
  <div class="app-page">
    <div class="page-title">审批意见回灌</div>
    <el-tabs v-model="tab">
      <!-- 录入 -->
      <el-tab-pane label="录入送审反馈" name="form">
        <el-card class="app-card" style="max-width:860px">
          <el-form label-width="96px">
            <el-row :gutter="16">
              <el-col :span="12"><el-form-item label="送审单位"><el-input v-model="form.submit_unit" placeholder="如：XX区自然资源和规划局" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="审批人"><el-input v-model="form.reviewer" placeholder="经办/审批人姓名（偏好画像按人归集）" /></el-form-item></el-col>
              <el-col :span="16"><el-form-item label="报告名称"><el-input v-model="form.report_title" placeholder="如：XX拟征告〔2026〕X号 稳评报告" /></el-form-item></el-col>
              <el-col :span="8">
                <el-form-item label="是否通过">
                  <el-radio-group v-model="form.passed"><el-radio :value="true">通过</el-radio><el-radio :value="false">退回</el-radio></el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>

            <div class="issues-title">审批意见（逐条录入，后续自动提炼审批关注点）</div>
            <div v-for="(it, i) in form.issues" :key="i" class="issue-row">
              <el-select v-model="it.chapter_num" style="width:150px" placeholder="章节">
                <el-option v-for="n in 12" :key="n" :label="`第${n}章`" :value="n" />
                <el-option label="全文/格式" :value="0" />
              </el-select>
              <el-select v-model="it.severity" style="width:100px">
                <el-option label="重要" value="warning" />
                <el-option label="必须改" value="critical" />
              </el-select>
              <el-input v-model="it.issue_desc" placeholder="问题描述" />
              <el-button text @click="form.issues.splice(i,1)">✕</el-button>
              <el-input v-model="it.suggestion" placeholder="修改建议（选填）" style="margin-top:6px" />
            </div>
            <el-button size="small" style="margin:8px 0" @click="addIssue">+ 添加一条意见</el-button>
            <div>
              <el-button type="primary" :loading="saving" @click="submit">提交回灌</el-button>
              <el-button @click="loadReviewers">刷新画像</el-button>
            </div>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 画像 -->
      <el-tab-pane label="审批人画像" name="profile">
        <el-table :data="reviewers" style="max-width:860px">
          <el-table-column prop="reviewer" label="审批人/经办" />
          <el-table-column prop="submit_unit" label="送审单位" />
          <el-table-column prop="total" label="意见条数" width="110" />
          <el-table-column prop="passed" label="通过" width="90" />
          <el-table-column label="通过率" width="120">
            <template #default="{ row }"><el-tag type="success" v-if="row.pass_rate>80">{{ row.pass_rate }}%</el-tag><el-tag v-else type="warning">{{ row.pass_rate }}%</el-tag></template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import client from '@/api/client'

const tab = ref('form')
const saving = ref(false)
const reviewers = ref([])
const form = ref({
  submit_unit: '', reviewer: '', report_title: '', passed: true,
  issues: [{ chapter_num: 3, issue_desc: '', suggestion: '', severity: 'warning' }],
})

onMounted(loadReviewers)

function addIssue() {
  form.value.issues.push({ chapter_num: 3, issue_desc: '', suggestion: '', severity: 'warning' })
}

async function submit() {
  const issues = form.value.issues.filter(x => x.issue_desc && x.issue_desc.trim())
  if (!issues.length) return ElMessage.warning('请至少填一条意见描述')
  saving.value = true
  try {
    await client.post('/approval/reviews', { ...form.value, issues })
    ElMessage.success('已回灌')
    form.value.issues = [{ chapter_num: 3, issue_desc: '', suggestion: '', severity: 'warning' }]
    form.value.report_title = ''; form.value.reviewer = ''; form.value.submit_unit = ''
    loadReviewers()
  } catch (e) { ElMessage.error(e.response?.data?.detail || '提交失败') }
  finally { saving.value = false }
}

async function loadReviewers() {
  const { data } = await client.get('/approval/reviewers')
  reviewers.value = (data.data || []).filter(r => r.reviewer !== '（未填）' || r.submit_unit !== '（未填）')
}
</script>

<style scoped>
.issues-title { font-weight: 600; color: #18213a; margin: 6px 0 8px }
.issue-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: #f7f9fd; padding: 8px; border-radius: 8px; margin-bottom: 8px }
.issue-row .el-select { flex: none }
.issue-row .el-input { flex: 1; min-width: 200px }
</style>
