<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="上传模板"
    width="560px"
    destroy-on-close
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="模板名称" prop="name">
        <el-input v-model="form.name" placeholder="例如：社会稳定性风险评估报告模板" maxlength="255" />
      </el-form-item>
      <el-form-item label="模板分类" prop="category">
        <el-select v-model="form.category" placeholder="选择分类" style="width: 100%">
          <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="模板用途和说明" />
      </el-form-item>
      <el-form-item label="模板文件" prop="templateFile" required>
        <el-upload
          ref="templateUploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".docx,.doc,.pdf"
          :on-change="(file) => form.templateFile = file.raw"
          :on-remove="() => form.templateFile = null"
        >
          <el-button type="primary">
            <el-icon><Upload /></el-icon> 选择模板文件（.docx/.pdf）
          </el-button>
          <template #tip>
            <div class="el-upload__tip">上传含占位符的模板文件（docx），或PDF参考模板</div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item label="示例文件">
        <el-upload
          ref="exampleUploadRef"
          :auto-upload="false"
          :limit="1"
          accept=".docx,.doc,.pdf"
          :on-change="(file) => form.exampleFile = file.raw"
          :on-remove="() => form.exampleFile = null"
        >
          <el-button>
            <el-icon><Upload /></el-icon> 选择完整示例（可选）
          </el-button>
          <template #tip>
            <div class="el-upload__tip">已填写完成的完整报告示例，帮助AI理解填写规则</div>
          </template>
        </el-upload>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="uploading" @click="onSubmit">
        <el-icon><Upload /></el-icon> 上传并分析
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useKnowledgeStore } from '@/stores/knowledge'
import { REPORT_CATEGORIES } from '@/utils/constants'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'success'])

const store = useKnowledgeStore()
const formRef = ref()
const uploading = ref(false)
const categories = REPORT_CATEGORIES

const form = reactive({
  name: '',
  category: '社会稳定性风险评估',
  description: '',
  templateFile: null,
  exampleFile: null,
})

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

async function onSubmit() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!form.templateFile) {
    ElMessage.warning('请选择模板文件')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('name', form.name)
    formData.append('category', form.category)
    formData.append('description', form.description || '')
    formData.append('template_file', form.templateFile)
    if (form.exampleFile) {
      formData.append('example_file', form.exampleFile)
    }

    await store.createTemplate(formData)
    ElMessage.success('模板上传成功')

    // Fire-and-forget AI analysis (runs in background)
    if (store.templates.length > 0) {
      const newTemplate = store.templates[0]
      store.triggerAnalysis(newTemplate.id).then(() => {
        ElMessage.success('模板分析完成')
      }).catch(() => {
        // Background analysis may take time, results update on refresh
      })
    }

    // Reset form immediately — don't wait for analysis
    form.name = ''
    form.description = ''
    form.templateFile = null
    form.exampleFile = null

    emit('success')
  } catch (e) {
    // handled by interceptor
  } finally {
    uploading.value = false
  }
}
</script>
