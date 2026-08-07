<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="上传知识库文档"
    width="600px"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="文档文件" prop="file" required>
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".docx,.doc,.pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.bmp,.webp,.xlsx,.xls,.csv"
          :on-change="onFileChange"
          :on-remove="onFileRemove"
          drag
        >
          <el-icon :size="40"><UploadFilled /></el-icon>
          <div class="el-upload__text">
            拖拽文件到此处 或 <em>点击选择</em>
          </div>
          <template #tip>
            <div class="el-upload__tip">
              支持 PDF / Word / 图片 / Excel / 文本，最大 200MB
            </div>
          </template>
        </el-upload>
      </el-form-item>

      <el-form-item label="文档标题">
        <el-input v-model="form.title" :placeholder="autoTitle" maxlength="255" />
        <div class="form-tip">留空使用文件名：{{ autoTitle }}</div>
      </el-form-item>

      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="文档类型" label-width="80px">
            <el-select v-model="form.document_type" style="width: 100%">
              <el-option label="🤖 自动识别" value="auto" />
              <el-option-group label="── 政策法规 ──">
                <el-option label="📜 法规" value="regulation" />
                <el-option label="📋 标准规范" value="standard" />
              </el-option-group>
              <el-option-group label="── 业务素材 ──">
                <el-option label="📝 稳评报告/案卷" value="example_report" />
                <el-option label="📊 调查数据" value="survey" />
                <el-option label="🧑‍⚖️ 专家评审" value="expert_review" />
                <el-option label="📸 现场照片" value="photo" />
              </el-option-group>
              <el-option-group label="── 参考资料 ──">
                <el-option label="📚 理论文献" value="theory" />
                <el-option label="📖 工作指南" value="work_guide" />
                <el-option label="🏢 公司资料" value="company_info" />
              </el-option-group>
              <el-option label="📦 其他" value="other" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="业务领域" label-width="80px">
            <el-select v-model="form.domain" style="width: 100%">
              <el-option label="🤖 自动识别" value="auto" />
              <el-option label="🏘️ 征地稳评" value="stability" />
              <el-option label="📑 招标投标" value="bidding" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <div v-if="form.file" class="file-info">
        <el-tag size="small" :type="fileSizeWarning ? 'warning' : ''">
          {{ (form.file.size / 1024 / 1024).toFixed(1) }}MB
        </el-tag>
        <span v-if="fileSizeWarning" style="color:#e6a23c;font-size:12px;margin-left:8px">
          ⚠️ 大文件索引可能需要较长时间
        </span>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="uploading" @click="onSubmit">
        <el-icon><Upload /></el-icon> 上传并自动索引
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useKnowledgeStore } from '@/stores/knowledge'

const props = defineProps({
  visible: { type: Boolean, default: false },
  defaultDocumentType: { type: String, default: 'auto' },
  defaultDomain: { type: String, default: 'auto' },
})

const emit = defineEmits(['update:visible', 'success'])

const store = useKnowledgeStore()
const formRef = ref()
const uploadRef = ref()
const uploading = ref(false)

const form = reactive({
  title: '',
  document_type: props.defaultDocumentType,
  domain: props.defaultDomain,
  file: null,
})

const autoTitle = computed(() => {
  if (form.file) return form.file.name.replace(/\.[^.]+$/, '')
  return '选择文件后自动填充'
})

const fileSizeWarning = computed(() => {
  return form.file && form.file.size > 50 * 1024 * 1024
})

const rules = {
  title: [],
  document_type: [{ required: true, message: '请选择文档类型', trigger: 'change' }],
}

function onFileChange(fileData) {
  form.file = fileData.raw
  if (!form.title && fileData.name) {
    form.title = fileData.name.replace(/\.[^.]+$/, '')
  }
}

function onFileRemove() {
  form.file = null
}

async function onSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!form.file) {
    ElMessage.warning('请选择文档文件')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('title', form.title || form.file.name.replace(/\.[^.]+$/, ''))
    formData.append('document_type', form.document_type)
    formData.append('domain', form.domain)
    formData.append('file', form.file)

    const result = await store.createDocument(formData)
    const docId = result?.id

    if (docId) {
      ElMessage.success('上传成功，后台自动索引中...')
    } else {
      ElMessage.success('上传成功')
    }

    form.title = ''
    form.document_type = props.defaultDocumentType
    form.domain = props.defaultDomain
    form.file = null
    if (uploadRef.value) uploadRef.value.clearFiles()

    emit('success')
  } catch (e) {
    // handled by interceptor
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.form-tip {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}
.file-info {
  margin-top: 8px;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 4px;
}
</style>
