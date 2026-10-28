<template>
  <div class="cp-page">
    <div class="cp-head">
      <h2>公司信息</h2>
      <p class="cp-sub">
        报告封面、编写单位、公司简介都取自这里。<b>没填的字段在报告里会显示「待填写」</b>
        —— 不会套用其他公司的资料。
      </p>
    </div>

    <el-alert
      v-if="loaded && !hasCompany"
      type="warning"
      :closable="false"
      title="还没有公司信息"
      description="填好公司名称后保存即可。简介、编写单位可以在下方一并填写或直接上传模板由系统提取。"
      style="margin-bottom:16px"
    />

    <el-card v-loading="loading" shadow="never">
      <el-form :model="form" label-width="110px" style="max-width:760px">
        <el-form-item label="公司名称" required>
          <el-input v-model="form.name" placeholder="如：XX项目咨询有限公司" />
        </el-form-item>
        <el-form-item label="简称">
          <el-input v-model="form.short_name" placeholder="用于列表/表头的简短称呼" />
        </el-form-item>
        <el-form-item label="编写单位">
          <el-input v-model="form.implement_unit"
                    placeholder="报告封面「稳评实施单位」与「编写单位」显示的名称；留空则显示「待填写」" />
        </el-form-item>
        <el-form-item label="公司简介">
          <el-input v-model="form.intro_text" type="textarea" :rows="8"
                    placeholder="报告前置「公司简介」的正文。空行分段，每段一段落。" />
        </el-form-item>
        <el-form-item label="统一社会信用代码">
          <el-input v-model="form.business_license_no" />
        </el-form-item>
        <el-form-item label="负责人">
          <el-input v-model="form.leader_name"
                    placeholder="评审表「稳评实施单位·负责人」显示的人名；留空则显示「待填写」" />
        </el-form-item>
        <el-form-item label="负责人职务">
          <el-input v-model="form.leader_title"
                    placeholder="如：法定代表人 / 总经理；每家公司的负责人与职务可以不同" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="form.address" />
        </el-form-item>
        <el-form-item label="联系方式">
          <el-input v-model="form.contact" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top:16px">
      <template #header>
        <div class="cp-card-head">
          <span>人员名册</span>
          <div style="display:flex;gap:8px;align-items:center">
            <el-upload :show-file-list="false" :before-upload="onImport" accept=".xlsx,.xls,.csv,.docx">
              <el-button size="small">导入名册（xlsx / csv / docx）</el-button>
            </el-upload>
            <el-button size="small" type="primary" @click="openPerson(null)">新增人员</el-button>
          </div>
        </div>
      </template>
      <p class="cp-tip">
        导入：第一行需为表头，认「姓名 / 性别 / 年龄 / 学历 / 专业 / 职称 / 拟任角色 / 执业资格证书」；
        同名同公司会覆盖。也可以逐条新增、修改、删除。
      </p>
      <el-table :data="personnel" size="small" max-height="360">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="gender" label="性别" width="60" />
        <el-table-column prop="age" label="年龄" width="60" />
        <el-table-column prop="title" label="职称/职务" width="140" />
        <el-table-column prop="default_role" label="拟任角色" width="120" />
        <el-table-column label="稳评培训证书" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.has_wenshen_cert" type="success" size="small">持证</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="证书图" width="80">
          <template #default="{ row }">{{ row.cert_image_count || 0 }}</template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openPerson(row)">修改</el-button>
            <el-upload :show-file-list="false" :before-upload="(f) => onCert(row, f)" accept=".png,.jpg,.jpeg,.webp,.bmp">
              <el-button size="small">传证书</el-button>
            </el-upload>
            <el-button size="small" type="danger" @click="removePerson(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!personnel.length" description="本公司还没有人员，导入名册或新增" :image-size="70" />
    </el-card>

    <!-- 新增 / 修改人员 -->
    <el-dialog v-model="personVisible" :title="personForm.id ? '修改人员' : '新增人员'" width="520px">
      <el-form :model="personForm" label-width="100px">
        <el-form-item label="姓名" required>
          <el-input v-model="personForm.name" />
        </el-form-item>
        <el-form-item label="性别"><el-input v-model="personForm.gender" style="width:120px" /></el-form-item>
        <el-form-item label="年龄"><el-input v-model="personForm.age" style="width:120px" /></el-form-item>
        <el-form-item label="学历"><el-input v-model="personForm.education" /></el-form-item>
        <el-form-item label="专业"><el-input v-model="personForm.major" /></el-form-item>
        <el-form-item label="职称/职务"><el-input v-model="personForm.title" /></el-form-item>
        <el-form-item label="拟任角色">
          <el-select v-model="personForm.role" style="width:100%">
            <el-option v-for="r in ROLE_OPTIONS" :key="r" :label="r" :value="r" />
          </el-select>
        </el-form-item>
        <el-form-item label="执业资格证书">
          <el-input v-model="personForm.certsText" type="textarea" :rows="2"
                    placeholder="多个用逗号分隔，如：社会稳定风险评估业务培训证书, 注册咨询工程师" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="personVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePerson">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCompanyProfile, updateCompanyProfile, listPersonnel, importPersonnel,
  createPersonnel, updatePersonnel, deletePersonnel, uploadPersonnelCert,
} from '@/api/company'

const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const hasCompany = ref(false)
const personnel = ref([])

// 🔴 角色选项与报告侧「稳评工作组人员及分工」的分组口径一致
//    （装配器按「拟任角色」分组渲染名单，认不出就归到「项目组成员」）
const ROLE_OPTIONS = ['项目负责人', '调研工作', '风险研判', '数据汇总', '资料档案', '项目组成员']

const form = reactive({
  name: '', short_name: '', implement_unit: '', intro_text: '',
  business_license_no: '', address: '', contact: '',
  // 🔴 评审表「稳评实施单位·负责人 / 职务」按公司取（每家公司不同）
  leader_name: '', leader_title: '',
})

const personVisible = ref(false)
const personForm = reactive({
  id: null, name: '', gender: '', age: '', education: '',
  major: '', title: '', role: '项目组成员', certsText: '',
})

function openPerson(row) {
  personForm.id = row ? row.id : null
  personForm.name = row?.name || ''
  personForm.gender = row?.gender || ''
  personForm.age = row?.age || ''
  personForm.education = row?.education || ''
  personForm.major = row?.major || ''
  personForm.title = row?.title || ''
  personForm.role = row?.default_role || '项目组成员'
  personForm.certsText = (row?.certs || []).join('，')
  personVisible.value = true
}

async function savePerson() {
  if (!personForm.name.trim()) { ElMessage.warning('请填写姓名'); return }
  saving.value = true
  try {
    const payload = {
      name: personForm.name, gender: personForm.gender, age: personForm.age,
      education: personForm.education, major: personForm.major,
      title: personForm.title, role: personForm.role,
      certs: personForm.certsText.split(/[，,、;；]/).map(s => s.trim()).filter(Boolean),
    }
    const { data } = personForm.id
      ? await updatePersonnel(personForm.id, payload)
      : await createPersonnel(payload)
    ElMessage.success(data.message || '已保存')
    personVisible.value = false
    await loadPersonnel()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally { saving.value = false }
}

async function removePerson(row) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？其证书图片记录会一并删除。`,
                               '删除确认', { type: 'warning' })
  } catch { return }
  try {
    const { data } = await deletePersonnel(row.id)
    ElMessage.success(data.message || '已删除')
    await loadPersonnel()
  } catch (e) { ElMessage.error(e.message || '删除失败') }
}

async function onCert(row, file) {
  try {
    const { data } = await uploadPersonnelCert(row.id, file, '培训证书')
    ElMessage.success(data.message || '已上传')
    await loadPersonnel()
  } catch (e) { ElMessage.error(e.message || '上传失败') }
  return false   // 阻止 el-upload 自己发请求
}

async function load() {
  loading.value = true
  try {
    const { data } = await getCompanyProfile()
    const c = (data.data && data.data.company) || {}
    hasCompany.value = !!(data.data && data.data.has_company)
    for (const k of Object.keys(form)) form[k] = c[k] || ''
    await loadPersonnel()
  } catch (e) {
    ElMessage.error('读取公司信息失败：' + (e.message || e))
  } finally {
    loading.value = false
    loaded.value = true
  }
}

async function loadPersonnel() {
  try {
    const { data } = await listPersonnel()
    personnel.value = (data.data && data.data.personnel) || []
  } catch { personnel.value = [] }
}

async function save() {
  if (!form.name.trim()) { ElMessage.warning('请填写公司名称'); return }
  saving.value = true
  try {
    const { data } = await updateCompanyProfile({ ...form })
    hasCompany.value = true
    ElMessage.success(data.message || '已保存')
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onImport(file) {
  try {
    const { data } = await importPersonnel(file, false)
    ElMessage.success(data.message || '导入完成')
    await loadPersonnel()
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  }
  return false   // 阻止 el-upload 自己发请求
}

onMounted(load)
</script>

<style scoped>
.cp-page { padding: 20px; }
.cp-head h2 { margin: 0 0 6px; }
.cp-sub { color: #7a8699; font-size: 13px; margin: 0 0 16px; }
.cp-card-head { display: flex; justify-content: space-between; align-items: center; }
.cp-tip { color: #7a8699; font-size: 12px; margin: 0 0 10px; }
</style>
