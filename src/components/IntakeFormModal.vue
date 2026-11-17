<template>
  <div v-if="modelValue" class="intake-mask" @click.self="close">
    <div class="intake-card">
      <div class="intake-head">
        <div>
          <h3>📝 在线填写基础资料</h3>
          <p class="intake-sub">{{ domain === 'reclamation' ? '复垦基础资料' : '稳评数据资料表' }} · 不用再上传 Excel</p>
        </div>
        <button class="intake-x" @click="close">✕</button>
      </div>

      <div v-if="loading" class="intake-loading">正在读取字段…</div>
      <template v-else>
        <div class="intake-tabs">
          <button v-for="g in schema.groups" :key="g.title"
                  :class="['intake-tab', { active: g.title === activeGroup }]"
                  @click="activeGroup = g.title">
            {{ g.title }}
          </button>
        </div>

        <div class="intake-body">
          <p v-if="schema.note" class="intake-note">{{ schema.note }}</p>

          <div v-for="g in schema.groups" v-show="g.title === activeGroup" :key="g.title">
            <div class="intake-grid">
              <label v-for="f in g.fields" :key="f.key" class="intake-field">
                <span class="intake-label">
                  {{ f.label }}<b v-if="f.required" class="req">*</b>
                </span>
                <select v-if="f.options && f.options.length"
                        v-model="values[f.key]" class="intake-input">
                  <option value="">请选择</option>
                  <option v-for="o in f.options" :key="o" :value="o">{{ o }}</option>
                </select>
                <textarea v-else-if="isLong(f)" v-model="values[f.key]"
                          class="intake-input intake-area" rows="2" :placeholder="f.help || ''"></textarea>
                <input v-else v-model="values[f.key]" class="intake-input"
                       :type="inputType(f)" :placeholder="f.help || ''" />
                <small v-if="f.help && !isLong(f)" class="intake-help">{{ f.help }}</small>
              </label>
            </div>
          </div>

          <!-- 复垦：功能分区 / 土地分类面积 -->
          <div v-for="t in schema.tables" :key="t.key" class="intake-table-block">
            <div class="intake-table-head">
              <h4>{{ t.title }}</h4>
              <button class="intake-add" @click="addRow(t.key)">＋ 添加一行</button>
            </div>
            <div class="intake-table-scroll">
              <table class="intake-table">
                <thead>
                  <tr>
                    <th v-for="c in t.columns" :key="c.key">{{ c.label }}</th>
                    <th class="op">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, i) in rows[t.key]" :key="i">
                    <td v-for="c in t.columns" :key="c.key">
                      <select v-if="c.options" v-model="row[c.key]" class="cell-input">
                        <option value="">—</option>
                        <option v-for="o in c.options" :key="o" :value="o">{{ o }}</option>
                      </select>
                      <input v-else v-model="row[c.key]" class="cell-input"
                             :type="c.type === 'number' ? 'number' : 'text'" />
                    </td>
                    <td class="op"><button class="row-del" @click="delRow(t.key, i)">✕</button></td>
                  </tr>
                  <tr v-if="!rows[t.key].length">
                    <td :colspan="t.columns.length + 1" class="intake-empty">
                      暂无数据，点「添加一行」填写
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="missing.length" class="intake-warn">
          ⚠️ 还有 {{ missing.length }} 项未填：{{ missing.slice(0, 6).join('、') }}{{ missing.length > 6 ? '…' : '' }}
          <span>（可先保存，生成前再补）</span>
        </div>

        <div class="intake-foot">
          <button class="intake-btn ghost" @click="close">取消</button>
          <button class="intake-btn primary" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存基础资料' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getIntakeSchema, saveIntake } from '@/api/report'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  domain: { type: String, default: 'stability' },
  sessionId: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'saved'])

const loading = ref(false)
const saving = ref(false)
const schema = ref({ groups: [], tables: [], note: '' })
const activeGroup = ref('')
const values = reactive({})
const rows = reactive({ zones: [], land_rows: [] })
const missing = ref([])

function inputType(f) {
  if (f.type === 'number') return 'number'
  if (f.type === 'date') return 'date'
  if (f.type === 'month') return 'month'
  if (f.type === 'phone') return 'tel'
  return 'text'
}
function isLong(f) {
  return (f.help || '').length > 24 || ['boundary_desc', 'villager_demands',
    'dept_opinions', 'grassroots_opinion', 'online_opinion'].includes(f.key)
}
function addRow(key) {
  const t = (schema.value.tables || []).find(x => x.key === key)
  const row = {}
  ;(t?.columns || []).forEach(c => { row[c.key] = '' })
  rows[key].push(row)
}
function delRow(key, i) {
  rows[key].splice(i, 1)
}
function close() {
  emit('update:modelValue', false)
}

async function load() {
  if (!props.modelValue) return
  loading.value = true
  missing.value = []
  try {
    const res = await getIntakeSchema(props.domain)
    schema.value = res?.data || res || { groups: [], tables: [] }
    Object.keys(values).forEach(k => delete values[k])
    Object.keys(rows).forEach(k => { rows[k] = [] })
    let first = ''
    ;(schema.value.groups || []).forEach(g => {
      if (!first) first = g.title
      ;(g.fields || []).forEach(f => { values[f.key] = '' })
    })
    activeGroup.value = first
  } catch (e) {
    ElMessage.error('读取字段失败：' + (e?.message || e))
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!props.sessionId) {
    ElMessage.warning('会话还未创建，请先上传模板/资料')
    return
  }
  saving.value = true
  try {
    const payload = {
      domain: props.domain,
      values: { ...values },
      zones: rows.zones || [],
      land_rows: rows.land_rows || [],
    }
    const res = await saveIntake(props.sessionId, payload)
    const d = res?.data || res || {}
    missing.value = d.missing || []
    ElMessage.success(`已保存 ${d.changed_count ?? (d.changed || []).length} 项基础数据`)
    emit('saved', d)
    if (!missing.value.length) close()
  } catch (e) {
    ElMessage.error('保存失败：' + (e?.message || e))
  } finally {
    saving.value = false
  }
}

watch(() => props.modelValue, v => { if (v) load() })
</script>

<style scoped>
.intake-mask { position: fixed; inset: 0; background: rgba(15,23,42,.45); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 16px; }
.intake-card { width: min(980px, 100%); max-height: 92vh; background: #fff; border-radius: 14px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 70px rgba(0,0,0,.25); }
.intake-head { padding: 16px 20px; border-bottom: 1px solid #eef2f6; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.intake-head h3 { margin: 0; font-size: 17px; color: #111827; }
.intake-sub { margin: 4px 0 0; font-size: 12px; color: #6b7280; }
.intake-x { border: 0; background: #f3f4f6; border-radius: 8px; width: 30px; height: 30px; cursor: pointer; color: #6b7280; }
.intake-loading { padding: 40px; text-align: center; color: #6b7280; }
.intake-tabs { display: flex; gap: 6px; padding: 10px 16px 0; overflow-x: auto; border-bottom: 1px solid #eef2f6; }
.intake-tab { border: 0; background: transparent; padding: 8px 12px; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 13px; color: #4b5563; white-space: nowrap; }
.intake-tab.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
.intake-body { padding: 14px 20px; overflow-y: auto; flex: 1; }
.intake-note { margin: 0 0 12px; font-size: 12px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 10px; }
.intake-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 18px; }
.intake-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.intake-label { font-size: 12.5px; color: #374151; }
.req { color: #dc2626; margin-left: 2px; }
.intake-input { border: 1px solid #d1d5db; border-radius: 7px; padding: 7px 9px; font-size: 13px; width: 100%; box-sizing: border-box; background: #fff; }
.intake-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.12); }
.intake-area { resize: vertical; }
.intake-help { color: #9ca3af; font-size: 11px; }
.intake-table-block { margin-top: 18px; border-top: 1px dashed #e5e7eb; padding-top: 12px; }
.intake-table-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.intake-table-head h4 { margin: 0; font-size: 13.5px; color: #111827; }
.intake-add { border: 1px solid #bfdbfe; background: #eff6ff; color: #1d4ed8; border-radius: 7px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.intake-table-scroll { overflow-x: auto; margin-top: 8px; }
.intake-table { width: 100%; border-collapse: collapse; min-width: 720px; }
.intake-table th, .intake-table td { border: 1px solid #e5e7eb; padding: 4px; font-size: 12px; }
.intake-table th { background: #f8fafc; color: #374151; font-weight: 600; }
.cell-input { width: 100%; border: 0; background: transparent; padding: 4px; font-size: 12px; box-sizing: border-box; }
.cell-input:focus { outline: 1px solid #93c5fd; border-radius: 4px; }
.op { width: 42px; text-align: center; }
.row-del { border: 0; background: #fef2f2; color: #b91c1c; border-radius: 5px; width: 24px; height: 24px; cursor: pointer; }
.intake-empty { text-align: center; color: #9ca3af; padding: 14px; }
.intake-warn { margin: 0 20px 8px; font-size: 12px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 10px; }
.intake-warn span { color: #9ca3af; }
.intake-foot { padding: 12px 20px; border-top: 1px solid #eef2f6; display: flex; justify-content: flex-end; gap: 10px; }
.intake-btn { border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; border: 1px solid transparent; }
.intake-btn.ghost { background: #fff; border-color: #d1d5db; color: #374151; }
.intake-btn.primary { background: #2563eb; color: #fff; }
.intake-btn.primary:disabled { opacity: .6; cursor: wait; }
@media (max-width: 820px) {
  .intake-card { max-height: 96vh; }
  .intake-grid { grid-template-columns: 1fr; }
  .intake-body { padding: 12px; }
}
</style>
