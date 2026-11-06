<template>
  <div class="gen-layout">
    <!-- History Sidebar -->
    <aside class="sidebar" v-if="history.length">
      <h3>📋 最近报告</h3>
      <div class="hist-list">
        <div v-for="h in visibleHistory" :key="h.id" class="hist-item">
          <div class="hist-title">{{ h.title || '未命名' }}</div>
          <div class="hist-meta">{{ h.time }} · {{ fmtSize(h.size) }}</div>
          <a v-if="h.download_url" href="#" class="hist-dl" @click.prevent="dlHistory(h)">📥 下载</a>
          <span v-else class="hist-dl disabled">⏳</span>
        </div>
      </div>
      <button class="hist-all" @click="goHistory">查看全部历史报告 →</button>
      <button class="hist-refresh" @click="loadHistory">🔄 刷新</button>
    </aside>

    <!-- Main -->
    <div class="gen">
      <header class="gh">
        <h1>众拓AI智能报告生成</h1>
        <p>上传项目资料，AI 自动编制专业报告</p>
      </header>

      <!-- ⓪ 上传报告模板（替代原「输入需求」） -->
      <section class="gs">
        <h2>⓪ 上传报告模板</h2>
        <div class="intent-row">
          <input ref="tplInput" type="file" accept=".docx,.pdf,.doc" style="display:none"
                 @change="onTemplateUpload" :disabled="isRunning" />
          <button class="gbtn" @click="tplInput && tplInput.click()"
                  :disabled="isRunning || templateUploading">
            {{ templateUploading ? '⏳ 正在识别模板…' : '📄 上传报告模板' }}
          </button>
          <span v-if="templateName" class="intent-desc">{{ templateName }}</span>
        </div>
        <p class="intent-desc">上传你想要生成的报告模板（.docx / .pdf），系统自动识别报告类型、章节结构和地区模板。</p>
        <!-- 投标模式：先选投标主体，再选招标文件；报价在解析后弹窗询问 -->
        <div v-if="bidMode" class="intent-row" style="margin-top:8px">
          <span class="intent-desc" style="margin:0 8px 0 0">投标主体：</span>
          <select v-model.number="bidCompanyId" class="bid-company-select">
            <option v-for="c in bidCompanies" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <button class="gbtn" @click="tplInput && tplInput.click()">选择招标文件并生成</button>
          <button class="gbtn" @click="bidMode = false">取消</button>
        </div>
        <div v-if="intentResult" class="intent-guide">
          <h3>📋 识别为：{{ intentResult.domain_label || (intentResult.guide && intentResult.guide.title) }}（{{ domainLabel(intentResult.domain) }}）</h3>
          <p v-if="intentResult.template_title" class="intent-desc">模板标题：{{ intentResult.template_title }}</p>
          <p v-if="intentResult.detected_region" class="intent-desc">
            识别地区：{{ intentResult.detected_region }}
            <span v-if="intentResult.registered_template">（已登记为该地区模板）</span>
            <span v-else-if="intentResult.register_reason">（{{ intentResult.register_reason }}）</span>
          </p>
          <p v-if="intentResult.matched_template" class="intent-desc">
            参考模板库：{{ intentResult.matched_template.name }}
            <span v-if="intentResult.matched_template.region">（{{ intentResult.matched_template.region }}）</span>
          </p>
          <!-- 模板分析结果：要换哪些数据、哪些小节要按本项目资料重写 -->
          <p v-if="intentResult.structure_check && (intentResult.structure_check.missing || []).length" class="intent-desc">
            模板未覆盖第 {{ intentResult.structure_check.missing.join('、') }} 章{{ intentResult.structure_check.standard ? '（按' + intentResult.structure_check.standard + '兜底）' : '' }}，生成时补齐；模板已有章节仍以模板为准。
          </p>
          <p v-if="intentResult.structure_check && (intentResult.structure_check.missing_parts || []).length" class="intent-desc">
            模板未含第 {{ intentResult.structure_check.missing_parts.join('、') }} 部分（报告表 / 请示 / 图件 / 附件），生成时由系统自动补。
          </p>
          <template v-if="(intentResult.required_data || []).length">
            <p class="guide-label">模板需要替换的数据（括号内为模板原值，成稿一律换成本项目资料）：</p>
            <ul class="guide-list">
              <li v-for="d in intentResult.required_data" :key="d.key">
                <strong>{{ d.label }}</strong>
                <span v-if="(d.examples || []).length">（模板原值：{{ d.examples.join(' / ') }}）</span>
                <span v-if="(d.sections || []).length"> — {{ d.sections.slice(0, 2).join('、') }}</span>
              </li>
            </ul>
          </template>
          <p v-if="(intentResult.rewrite_sections || []).length" class="intent-desc">
            需要按本项目资料重写的小节：{{ intentResult.rewrite_sections.length }} 处
            （{{ intentResult.rewrite_sections.slice(0, 4).map(s => (s.no || '') + ' ' + s.title).join('、') }} 等）
          </p>
          <!-- 逐节批注式分析（不变/换数/重写 + 来源/公式），供编制人员确认 -->
          <template v-if="intentResult.case_analysis && (intentResult.case_analysis.sections || []).length">
            <p class="intent-desc">
              逐节批注分析：{{ intentResult.case_analysis.section_count }} 节
              （不变 {{ intentResult.case_analysis.counts.fixed || 0 }}、换数 {{ intentResult.case_analysis.counts.slot || 0 }}、重写 {{ intentResult.case_analysis.counts.create || 0 }}）
              <a href="#" @click.prevent="showCase = !showCase">{{ showCase ? '收起' : '展开查看' }}</a>
            </p>
            <div v-if="showCase" class="case-list">
              <div v-for="s in intentResult.case_analysis.sections" :key="(s.no || '') + s.title" class="case-item">
                <div class="case-head">
                  <strong>{{ s.no }} {{ s.title }}</strong>
                  <span class="case-kind">{{ s.kind }}</span>
                </div>
                <div v-if="s.replace" class="intent-desc">换：{{ s.replace }}</div>
                <div v-if="s.source" class="intent-desc">取：{{ s.source }}</div>
                <div v-if="s.formula" class="intent-desc">口径：{{ s.formula }}</div>
                <div v-if="(s.keys || []).length" class="intent-desc">数据位：{{ s.keys.join('、') }}</div>
              </div>
            </div>
          </template>
          <p v-if="styleText(intentResult.style_profile)" class="intent-desc">
            版式识别：{{ styleText(intentResult.style_profile) }}
          </p>
          <template v-if="intentResult.guide && intentResult.guide.description">
            <p class="intent-desc">{{ intentResult.guide.description }}</p>
            <p class="guide-label">必传资料：</p>
            <ul class="guide-list">
              <li v-for="m in (intentResult.guide.required || [])" :key="m.name">
                <strong>{{ m.name }}</strong>（{{ m.format }}）— {{ m.note }}
              </li>
            </ul>
            <template v-if="(intentResult.guide.optional || []).length">
              <p class="guide-label">可选资料：</p>
              <ul class="guide-list">
                <li v-for="m in intentResult.guide.optional" :key="m.name">
                  <strong>{{ m.name }}</strong>（{{ m.format }}）— {{ m.note }}
                </li>
              </ul>
            </template>
          </template>
        </div>
      </section>

      <!-- ① Domain -->
      <section class="gs">
        <h2>① 选择报告类型</h2>
        <div class="dc">
          <div :class="['dc-card', { sel: domain === 'stability' }]" @click="domain = 'stability'">
            <span class="dc-icon">📊</span>
            <span class="dc-title">社会稳定风险评估报告</span>
          </div>
          <!-- 🔴 复垦方案（后端 domain=reclamation 早已支持：10 章 + 报告表 + 22 项附件），
               此前界面只挂了稳评/投标两张卡，业主找不到入口（2026-10-28 反馈）。 -->
          <div :class="['dc-card', { sel: domain === 'reclamation' }]" @click="domain = 'reclamation'">
            <span class="dc-icon">🌱</span>
            <span class="dc-title">土地复垦方案</span>
          </div>
          <div :class="['dc-card', { sel: domain === 'bidding' }]" @click="onBiddingClick">
            <span class="dc-icon">📋</span>
            <span class="dc-title">投标文件编写</span>
          </div>
        </div>
        <!-- 🔴 选了非稳评类型后，把「不适用于该类型」的环节显性说明一句，
             避免用户以为功能缺失（业主 2026-10-28：「选完类型后有些内容就可以屏蔽掉」）。 -->
        <p v-if="domain === 'reclamation'" class="ghint dc-note">
          复垦方案可选「报告人员」（写入报告表的主要编制人员）；「选择证书」仅稳评使用，已隐藏
          ——复垦的编制单位资质放在<b>附件3</b>。
        </p>
      </section>

      <!-- ② Upload -->
      <section class="gs">
        <h2>② 上传资料文档 <span v-if="uploading" class="up-stat">上传中 {{ uploadDone }}/{{ uploadTotal }}...</span></h2>

        <!-- 需求分析后：按资料分类分步上传 -->
        <template v-if="intentResult && intentResult.guide">
          <div v-for="m in intentResult.guide.required" :key="m.name" class="mat-card">
            <div class="mat-head">
              <span class="mat-name">📄 {{ m.name }}</span>
              <span class="mat-format">（{{ m.format }}）</span>
              <span class="mat-note">{{ m.note }}</span>
              <button class="ubtn mat-upload" @click.stop="clickFileForMaterial(m.name)" :disabled="isRunning">📎 上传</button>
            </div>
            <div class="mat-files" v-if="materialFiles(m.name).length">
              <span v-for="(f, i) in materialFiles(m.name)" :key="i" class="mat-file">
                {{ f.name }} <button class="fl-del" @click="removeFile(f)">✕</button>
              </span>
            </div>
            <div v-else class="mat-empty">未上传</div>
          </div>
          <details v-if="intentResult.guide.optional && intentResult.guide.optional.length" class="mat-optional">
            <summary>可选资料（{{ intentResult.guide.optional.length }} 项）</summary>
            <div v-for="m in intentResult.guide.optional" :key="m.name" class="mat-card">
              <div class="mat-head">
                <span class="mat-name">📄 {{ m.name }}</span>
                <span class="mat-format">（{{ m.format }}）</span>
                <button class="ubtn mat-upload" @click.stop="clickFileForMaterial(m.name)" :disabled="isRunning">📎 上传</button>
              </div>
            </div>
          </details>
        </template>

        <!-- 需求分析前：通用上传框 + 提示 -->
        <template v-else>
          <div class="up-zone" @click="clickFile" @dragover.prevent @drop.prevent="onDrop">
            <div class="up-inner">
              <span class="up-icon">📁</span>
              <p v-if="!uploading">拖拽文件到此处，或点击选择</p>
              <p v-else>正在上传...</p>
              <small>支持 PDF、DOCX、DOC、TXT、图片、文件夹</small>
            </div>
          </div>
          <p class="ghint">💡 建议先在上方「⓪ 输入您的需求」，系统会告诉你该传什么资料</p>
        </template>

        <!-- 全部已上传文件汇总 -->
        <div v-if="files.length" class="fl">
          <div v-for="(f, i) in files" :key="i" class="fl-item">
            <span :class="['fl-badge', badge(f)]">{{ ext(f) }}</span>
            <span class="fl-name">{{ f.name }}</span>
            <span v-if="f.material_type" class="fl-mat">{{ f.material_type }}</span>
            <span class="fl-size">{{ fmtSize(f.size) }}</span>
            <button class="fl-del" @click="removeFile(f)">✕</button>
          </div>
        </div>
        <div class="up-btns">
          <button class="ubtn" @click.stop="clickFolder" :disabled="isRunning">📁 选择文件夹（整批上传）</button>
          <button v-if="files.length && !isRunning" class="ubtn ubtn-clear" @click="files=[]">清空全部</button>
        </div>
      </section>

      <!-- ③ 选择报告人员：稳评 → 前置「培训证书」页与「稳评工作组人员及分工情况」；
               复垦 → 第11部分报告表「方案编制单位·主要编制人员」 -->
      <section class="gs" v-if="domain === 'stability' || domain === 'reclamation'">
        <h2>③ 选择报告人员 <span class="up-stat">已选 {{ selectedPersonnel.length }} / {{ maxPersonnel }} 人</span></h2>
        <p class="ghint pp-hint" v-if="domain === 'stability'">
          勾选的人员将写入报告前置的<b>稳评工作组人员及分工情况</b>。
          <b>默认只列持「稳评培训证书」者</b>（库内 17 人，证书扫描件为证）；
          名册上没证书的几位可取消勾选「只看持证人员」查看。
          <b>最多 {{ maxPersonnel }} 人</b> —— 参照人工成品案卷为 6 人、洪泽/金湖模板为 6～7 人。
        </p>
        <p class="ghint pp-hint" v-else>
          勾选的人员将写入<b>《土地复垦方案报告表》「方案编制单位 · 主要编制人员」</b>一栏
          （姓名｜职称/职务｜专业｜单位）。
          <b>只列职称/职务和专业都齐全的人员</b>（范文里核对到的就是 3 人），
          <b>最多 {{ maxPersonnel }} 人</b>。
        </p>
        <div class="pp-tools">
          <label class="pp-tool"><input type="checkbox" :checked="allSelected" @change="toggleAllPersonnel"> 全选</label>
          <template v-if="domain === 'stability'">
            <label class="pp-tool"><input type="checkbox" v-model="onlyCertPersonnel"> 只看持证人员</label>
            <label class="pp-tool"><input type="checkbox" :checked="!onlyCertPersonnel"
                                          @change="toggleNonCert"> 含未持证人员</label>
          </template>
          <button class="ubtn" @click="loadPersonnel" :disabled="personnelLoading">🔄 刷新名单</button>
          <button class="ubtn" @click="buildCertIndex" :disabled="certBuilding">
            {{ certBuilding ? '⏳ 识别中…' : '🔍 识别证书素材' }}
          </button>
          <button class="ubtn" @click="syncPersonnelStore" :disabled="certBuilding">📥 同步人员库</button>
          <span class="pp-count">可见 {{ visiblePersonnel.length }} / 库内 {{ personnel.length }} 人</span>
        </div>
        <div class="pp-list" v-if="visiblePersonnel.length">
          <label v-for="p in visiblePersonnel" :key="p.name"
                 :class="['pp-item', { sel: selectedPersonnel.includes(p.name) }]">
            <input type="checkbox" :checked="selectedPersonnel.includes(p.name)"
                   @change="togglePersonnel(p.name)">
            <span class="pp-name">{{ p.name }}</span>
            <span class="pp-meta">{{ [p.gender, p.age ? p.age + '岁' : '', p.education, p.title].filter(Boolean).join(' · ') }}</span>
            <span class="pp-role">{{ p.default_role }}</span>
            <span v-if="p.has_wenshen_cert" class="pp-badge">稳评培训证书</span>
            <span v-if="certCount(p)" class="pp-img" :title="certTitles(p)">🖼 {{ certCount(p) }}</span>
          </label>
        </div>
        <p v-else class="ghint">
          {{ personnelLoading ? '正在读取在职人员…'
            : (domain === 'reclamation'
                ? '人员库里还没有「职称/职务 + 专业」齐全的人员，请先导入人员统计表或补全人员库'
                : '未读取到在职人员信息（请先在知识库维护「公司专业技术人员配备」）') }}
        </p>
      </section>

      <!-- ④ 选择证书（稳评）：决定前置「公司资质证书」区贴哪几张人员证书图 -->
      <section class="gs" v-if="domain === 'stability'">
        <h2>④ 选择证书 <span class="up-stat">已选 {{ selectedCertPersonnel.length }} / {{ MAX_CERT_PERSONNEL }} 人</span></h2>
        <p class="ghint pp-hint">
          从<b>有证书扫描件的人</b>里挑，最多 <b>{{ MAX_CERT_PERSONNEL }} 人</b>；
          这几张证书图贴在报告前置的 <b>公司营业执照之后</b>（「公司资质证书」区）。
          与上面的工作组人员是两回事，互不影响。
        </p>
        <div class="pp-list" v-if="certCandidates.length">
          <label v-for="p in certCandidates" :key="p.name"
                 :class="['pp-item', { sel: selectedCertPersonnel.includes(p.name) }]">
            <input type="checkbox" :checked="selectedCertPersonnel.includes(p.name)"
                   @change="toggleCertPersonnel(p.name)">
            <span class="pp-name">{{ p.name }}</span>
            <span class="pp-meta">{{ [p.gender, p.title].filter(Boolean).join(' · ') }}</span>
            <span class="pp-img" :title="certTitles(p)">🖼 {{ certCount(p) }}</span>
          </label>
        </div>
        <p v-else class="ghint">还没有任何人员证书素材 —— 点上面的「🔍 识别证书素材」导入。</p>
      </section>

      <!-- ⑤ Generate + Cancel -->
      <section class="gs">
        <h2>{{ domain === 'stability' ? '⑤' : '③' }} 开始生成</h2>
        <div class="gen-row">
          <button class="gbtn" :disabled="!canGenerate || isRunning" @click="startGenerate">
            {{ isRunning ? '⏳ 生成中...' : '🚀 开始生成报告' }}
          </button>
          <button v-if="isRunning" class="gbtn gbtn-cancel" @click="cancelGenerate">
            ⏹ 取消
          </button>
        </div>
        <p v-if="!files.length && !isRunning" class="ghint">请先上传资料文档</p>
      </section>

      <!-- Progress -->
      <section v-if="showProgress" class="gs progress-section">
        <h2>
          {{ phase === 'complete' ? '✅ 报告生成完成' : '生成进度' }}
          <span v-if="chInfo && phase !== 'complete'" class="ch-info">{{ chInfo }}</span>
        </h2>
        <div class="pbar-wrap">
          <div class="pbar"><div class="pbar-fill" :style="{ width: displayPct + '%' }"></div></div>
          <span class="pbar-pct">{{ displayPct }}%</span>
        </div>
        <p class="pmsg">{{ statusMessage }}</p>
        <div v-if="steps.length" class="steps">
          <div v-for="s in steps" :key="s.key" :class="['step', { done: s.done, active: s.active }]">
            <span class="step-dot"></span><span class="step-label">{{ s.label }}</span>
          </div>
        </div>
        <div v-if="phase === 'error'" class="dl-wrap">
          <p style="color:#dc2626;margin:0 0 8px">{{ statusMessage }}</p>
          <button class="dlbtn dlbtn-new" @click="resetAll">🔄 重新生成</button>
        </div>
        <div v-if="phase === 'complete' && downloadUrl" class="dl-wrap">
          <a href="#" class="dlbtn" @click.prevent="doDownload">📥 下载报告 (.docx)</a>
          <button class="dlbtn dlbtn-new" @click="resetAll">🔄 生成新报告</button>
        </div>
        <!-- 交付体检 + 缺口清单：只在这里提示，不写进交付稿
             🔴 业主口径（2026-10-30）：报告生成后要达到 80% 可用率、用户只看一遍就过。
                所以这里先报「可用率」，再列「需要扫一眼的地方」，不用翻全文找问题。 -->
        <details v-if="phase === 'complete' && (audit || (gaps && gaps.total))" class="gap-panel">
          <summary>
            <template v-if="audit && audit.total">
              📋 交付体检：可用率 <b :class="{ 'audit-bad': audit.below_target }">{{ auditPct }}%</b>
              <span v-if="audit.flagged"> · 需扫一眼 <b>{{ audit.flagged }}</b> 段</span>
            </template>
            <template v-else-if="gaps && gaps.total">
              ⚠️ 本次生成有 <b>{{ gaps.total }}</b> 处「待补充 / 待核对」
            </template>
            <span v-if="gaps && gaps.total"> · 缺口 <b>{{ gaps.total }}</b> 处（{{ gaps.warnings || 0 }} 处重点看）</span>
            —— 点开看明细
          </summary>

          <!-- 体检清单：套话腔 / 空泛表述 / 待补充 -->
          <ul v-if="audit && audit.items && audit.items.length" class="gap-list">
            <li v-for="(a, i) in audit.items" :key="'a' + i" class="gap-item">
              <span class="gap-ch">第 {{ a.chapter }} 章</span>
              <span class="gap-kind">{{ a.label }}</span>
              <span class="gap-detail">{{ a.detail }}</span>
              <span v-if="a.text" class="gap-sentence">原文：{{ a.text }}…</span>
            </li>
          </ul>

          <!-- 缺口清单（缺数据/缺依据） -->
          <ul v-if="gaps && gaps.items && gaps.items.length" class="gap-list">
            <li v-for="(g, i) in gaps.items" :key="'g' + i" :class="['gap-item', g.severity]">
              <span class="gap-ch">第 {{ g.chapter }} 章</span>
              <span class="gap-detail">{{ g.detail }}</span>
              <span v-if="g.sentence" class="gap-sentence">原句：{{ g.sentence }}</span>
            </li>
          </ul>

          <p class="gap-hint">
            体检口径：逐段判「能不能直接用」，可用率 = 不用改的段落 ÷ 全部段落（目标 ≥ 80%）。
            清单里是套话腔、空泛表述、待补充/待核对的地方——扫一眼改掉即可，报告文件里不含这些提示。
          </p>
        </details>
        <!-- 🔴 缺失信息弹窗 —— **一次只问一项**
             （业主：不要把整个章节的字段一次性铺出来；输入框要大，一眼看全；
               字数限制要常驻备注，不能只在超限时才报错） -->
        <div v-if="reportStore.workflowPaused && missingFields.length" class="missing-modal">
          <div class="missing-card missing-card-wide">
            <h3>⏸️ 需要补充信息</h3>
            <div class="missing-progress">
              <span class="mp-count">第 <b>{{ curIdx + 1 }}</b> / {{ missingFields.length }} 项</span>
              <span class="mp-where">{{ groupTitle(curField?.chapter) }}</span>
              <div class="mp-bar">
                <div class="mp-bar-fill"
                     :style="{ width: Math.round((curIdx + 1) / missingFields.length * 100) + '%' }"></div>
              </div>
            </div>
            <p class="missing-hint">
              带 <span class="req">*</span> 的为必填；数字项只能填数字、手机号需 11 位。
              填完点「下一项」，全部看完后点「提交并继续生成」（没填的按默认值处理）。
            </p>
            <div v-if="curField" class="missing-field missing-field-focus">
              <label>
                {{ curField.label }}<span class="req">*</span>
                <span v-if="curField.maxlength" class="char-note">（不超过 {{ curField.maxlength }} 字）</span>
              </label>
              <!-- 🔴 长文本用大文本框：单行 input 看不全整段字，用户没法确认内容对不对 -->
              <textarea
                v-if="isLongTextField(curField)"
                v-model="missingForm[curField.key]"
                rows="6"
                :maxlength="curField.maxlength || 500"
                :placeholder="'例如：' + (curField.example || '')"
                :class="{ 'input-error': missingErrors[curField.key] }"
                @input="validateMissingField(curField)"
              ></textarea>
              <input
                v-else
                v-model="missingForm[curField.key]"
                :type="curField.type === 'number' ? 'number' : (curField.type === 'phone' ? 'tel' : (curField.type === 'date' ? 'date' : 'text'))"
                :inputmode="curField.type === 'number' ? 'decimal' : (curField.type === 'phone' ? 'numeric' : 'text')"
                :maxlength="curField.type === 'date' ? undefined : (curField.maxlength || 100)"
                :min="curField.type === 'date' ? dateMin(curField.key) : undefined"
                :max="curField.type === 'date' ? dateMax(curField.key) : undefined"
                :placeholder="curField.type === 'date' ? '' : ('例如：' + (curField.example || ''))"
                :class="{ 'input-error': missingErrors[curField.key] }"
                @input="validateMissingField(curField)"
              />
              <div v-if="missingErrors[curField.key]" class="field-error">{{ missingErrors[curField.key] }}</div>
              <template v-else>
                <!-- 🔴 「数据核对」弹窗专用：标出这个值是**谁给的**，
                     用户才知道要看什么 —— 材料识别 / AI 提取 的值最需要人工确认 -->
                <div v-if="curField.source" class="field-usage">来源：{{ curField.source }}</div>
                <div v-if="curField.used_in" class="field-usage">用于 {{ curField.used_in }}</div>
              </template>
            </div>
            <div class="missing-actions">
              <button class="dlbtn dlbtn-new" :disabled="curIdx === 0" @click="curIdx--">← 上一项</button>
              <button v-if="curIdx < missingFields.length - 1" class="dlbtn dlbtn-new" @click="nextMissing">下一项 →</button>
              <button class="dlbtn" @click="submitMissing">✅ 提交并继续生成</button>
              <button class="dlbtn dlbtn-new" @click="skipMissing">跳过（使用默认值）</button>
            </div>
          </div>
        </div>
        <!-- 🔴 人工复核面板 —— **一次只问一章**
             （业主：不要把章节中的所有都放出来；输入框要大，一眼能看到整段字） -->
        <div v-if="pendingHumanChapters && humanQueue.length" class="missing-modal">
          <div class="missing-card missing-card-wide">
            <h3>👤 需要人工复核（{{ humanQueue.length }} 章）</h3>
            <div class="missing-progress">
              <span class="mp-count">第 <b>{{ humanIdx + 1 }}</b> / {{ humanQueue.length }} 章</span>
              <span class="mp-where" v-if="curHuman">第{{ curHuman.chapter }}章 {{ curHuman.title }}</span>
              <div class="mp-bar">
                <div class="mp-bar-fill"
                     :style="{ width: Math.round((humanIdx + 1) / humanQueue.length * 100) + '%' }"></div>
              </div>
            </div>
            <p class="missing-hint">
              AI 多次重写仍未能通过审核，或存在需人工确认的问题。
              本章二选一：<b>给修改思路</b>（交给 AI 携意见重写）或 <b>直接审批放行</b>。
              逐章处理完，再点最下方「继续生成」。
            </p>
            <template v-if="curHuman">
              <div class="hr-head">
                <strong>第{{ curHuman.chapter }}章 {{ curHuman.title }}</strong>
                <span class="hr-status" :class="curHuman.status">{{ statusCn(curHuman.status) }}</span>
                <span class="hr-retry" v-if="curHuman.retry_count">重试 {{ curHuman.retry_count }}/{{ curHuman.max_retry }}</span>
                <span class="hr-retry" v-if="humanDone[curHuman.chapter]">已处理</span>
              </div>
              <ul v-if="curHuman.violations && curHuman.violations.length" class="hr-violations">
                <li v-for="(v, i) in curHuman.violations" :key="i">
                  <span class="sev" :class="v.severity">{{ sevCn(v.severity) }}</span>
                  <span class="disp" :class="v.disposition">{{ dispCn(v.disposition) }}</span>
                  {{ v.message }}
                </li>
              </ul>
              <div class="hr-actions">
                <!-- 🔴 大字输入框：修改思路往往是一整段话，2 行根本看不全 -->
                <textarea v-model="humanOpinionForm[curHuman.chapter]" class="hr-opinion"
                  placeholder="输入您的修改思路，AI 将携带该意见重写本章（例如：支持率应为100%，删除反对表述）"
                  :disabled="humanDone[curHuman.chapter]" rows="8"></textarea>
                <div class="hr-btns">
                  <button class="dlbtn" :disabled="humanDone[curHuman.chapter] || humanBusy[curHuman.chapter]"
                    @click="submitHumanOpinion(curHuman.chapter)">✍️ 提交意见并AI重写</button>
                  <button class="dlbtn dlbtn-new" :disabled="humanDone[curHuman.chapter] || humanBusy[curHuman.chapter]"
                    @click="approveHumanChapter(curHuman.chapter)">✅ 审批通过（跳过AI重写）</button>
                </div>
              </div>
            </template>
            <div class="missing-actions">
              <button class="dlbtn dlbtn-new" :disabled="humanIdx === 0" @click="humanIdx--">← 上一章</button>
              <button class="dlbtn dlbtn-new" :disabled="humanIdx >= humanQueue.length - 1"
                @click="humanIdx++">下一章 →</button>
            </div>
            <div class="hr-global">
              <button class="dlbtn" :disabled="humanProcessing" @click="triggerHumanRewrite">
                {{ humanProcessing ? '⏳ 正在继续生成...' : '🚀 继续生成（处理已提交的意见/审批）' }}
              </button>
              <button class="dlbtn dlbtn-new" @click="resetAll">取消</button>
            </div>
          </div>
        </div>
        <!-- 实时日志 -->
        <!-- 🔴 运行日志**只给内部人员看**（业主：「上线不给用户看运行日志」）。
             后端也会对非内部人员返回空的 `logs`（见 report.py 的 workflow/status）——
             这里只是别让面板空占位置。出问题的排查看 logs/backend.log。 -->
        <div v-if="showProgress && workflowLogs.length && authStore.isStaff" class="log-panel">
          <div class="log-header">📋 运行日志（仅内部可见）</div>
          <div class="log-body" ref="logBody">
            <div v-for="(log, i) in workflowLogs" :key="i" class="log-line" :class="{ 'log-done': log.includes('✅'), 'log-running': log.includes('...') || log.includes('正在') }">{{ log }}</div>
          </div>
        </div>
      </section>
    </div>

    <!-- 下载进度蒙层：报告有几 MB，下载要几秒；不给反馈用户会以为没点上、反复重试 -->
    <div v-if="downloading" class="dl-mask">
      <div class="dl-card">
        <div class="dl-spin"></div>
        <p class="dl-title">{{ downloadLabel }}</p>
        <div class="dl-bar">
          <div class="dl-bar-fill" :class="{ 'dl-bar-indet': downloadPct < 0 }"
               :style="{ width: downloadPct < 0 ? '100%' : Math.round(downloadPct * 100) + '%' }"></div>
        </div>
        <p class="dl-sub">
          <template v-if="downloadPct >= 0">{{ Math.round(downloadPct * 100) }}% · {{ fmtSize(downloadReceived) }}</template>
          <template v-else>已接收 {{ fmtSize(downloadReceived) }}</template>
        </p>
        <p class="dl-note">请稍候，下载好会自动保存到浏览器的下载目录</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '@/stores/report'
import { useAuthStore } from '@/stores/auth'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { authFetch, getSessionGaps } from '@/api/report'
import { downloadFile } from '@/utils/download'

const reportStore = useReportStore()
const authStore = useAuthStore()

const domain = ref('stability')
// 域 → 中文简称（识别结果横幅用；以前只有「稳评/投标」两分支，复垦会被错标成投标）
const DOMAIN_NAMES = { stability: '稳评', reclamation: '复垦', bidding: '投标' }
function domainLabel(d) { return DOMAIN_NAMES[d] || '稳评' }
// 模板版面识别结果 → 一行可读文字（字体 + 字号）
function _slotText(label, s) {
  if (!s || !s.font) return ''
  return `${label} ${s.font}${s.size ? s.size + 'pt' : ''}`
}
function styleText(p) {
  if (!p) return ''
  const t = p.table || {}
  let table = _slotText('表格', t)
  const b = p.table_border
  if (b && table) {
    const border = b.none ? '无框线'
      : `${b.size_pt || ''}${b.size_pt ? 'pt' : ''}${b.inside ? ' 全框线' : ' 仅外框线'}`
    table += `（${border.trim()}）`
  }
  return [
    _slotText('一级标题', p.h1), _slotText('二级标题', p.h2),
    _slotText('正文', p.body), table,
    _slotText('表题', p.caption),
  ].filter(Boolean).join(' / ')
}
const files = ref([])
const tplInput = ref(null)
const templateUploading = ref(false)
const templateName = ref('')
const templatePath = ref('')
const intentResult = ref(null)
const showCase = ref(false)

// 🔴 人工复核状态（Skill 审核发现问题、AI 重试耗尽后由前端介入）
const pendingHumanChapters = ref(false)   // 是否处于人工复核暂停
const humanQueue = ref([])                // 待复核章节 [{chapter,title,status,violations,...}]
// 🔴 人工复核**一次只问一章**（业主：不要把章节中的所有都放出来）
const humanIdx = ref(0)
const curHuman = computed(() => humanQueue.value[humanIdx.value] || null)
const humanOpinionForm = reactive({})     // chapter -> 人工意见文本
const humanDone = reactive({})            // chapter -> 已处理标记
const humanBusy = reactive({})            // chapter -> 提交中
const humanProcessing = ref(false)        // 触发重写/继续生成中

async function onTemplateUpload(e) {
  const f = e && e.target && e.target.files ? e.target.files[0] : null
  if (!f) return
  // 投标模式或文件名带「招标」→ 走招标文件解析 + 报价 + 生成投标文件
  if (bidMode.value || /招标/.test(f.name)) {
    if (e && e.target) e.target.value = ''
    await onBidTenderUpload(f)
    return
  }
  const fd = new FormData()
  fd.append('file', f)
  templateUploading.value = true
  try {
    const res = await authFetch('/api/v1/reports/analyze-template', {
      method: 'POST',
      body: fd,
    })
    let data = null
    try { data = await res.json() } catch (_) { data = null }
    if (!res.ok) {
      let detail = data && (data.detail || data.message)
      if (Array.isArray(detail)) detail = detail.map(x => x.msg || x).join('；')
      throw new Error(detail || `HTTP ${res.status}`)
    }
    if (data && data.data) {
      intentResult.value = data.data
      showCase.value = false
      domain.value = data.data.domain
      templatePath.value = data.data.template_path || ''
      templateName.value = f.name
      ElMessage.success(`模板识别完成：${data.data.domain_label || domainLabel(data.data.domain)}${data.data.detected_region ? '，地区 ' + data.data.detected_region : ''}`)
    } else {
      ElMessage.error((data && data.message) || '模板识别失败')
    }
  } catch (e2) {
    ElMessage.error('模板识别失败：' + e2.message)
  } finally {
    templateUploading.value = false
    if (e && e.target) e.target.value = ''
  }
}
const showProgress = ref(false)

// 投标文件：点卡片 → 选招标文件 → 解析 → 弹窗问报价 → 生成
const bidMode = ref(false)
const bidTender = ref(null)
const bidCompanies = ref([])
const bidCompanyId = ref(4)

async function onBiddingClick() {
  bidMode.value = true
  try {
    const res = await authFetch('/api/v1/company/issuer-candidates')
    const data = await res.json()
    const list = (data && data.data && data.data.companies) || []
    bidCompanies.value = list.length ? list : [{ id: 4, name: '江苏众拓测绘有限公司' }]
    const cehui = bidCompanies.value.find(c => (c.name || '').includes('测绘'))
    bidCompanyId.value = cehui ? cehui.id : bidCompanies.value[0].id
  } catch (_) {
    bidCompanies.value = [{ id: 4, name: '江苏众拓测绘有限公司' }]
    bidCompanyId.value = 4
  }
}

async function onBidTenderUpload(f) {
  try {
    const fd = new FormData()
    fd.append('file', f)
    fd.append('company_id', String(bidCompanyId.value))
    const res = await authFetch('/api/v1/bidding/bid/analyze-tender', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) throw new Error((data && (data.detail || data.message)) || `HTTP ${res.status}`)
    bidTender.value = data.data
    const req = data.data.requirements || {}
    ElMessage.success(`已识别：${req.project_name || f.name}`)
    const p = await ElMessageBox.prompt(
      `本项目预算/最高限价：${data.data.max_price_wan || '未识别'} 万元\n请填写本次投标报价（万元）`,
      '填写投标报价',
      { inputValue: data.data.max_price_wan || '', inputPattern: /^\d+(\.\d+)?$/,
        inputErrorMessage: '请输入数字（万元）', confirmButtonText: '生成投标文件' },
    )
    const price = Number(p.value)
    if (!price || price <= 0) throw new Error('报价无效')
    ElMessage.info('正在按招标文件格式生成投标文件，服务方案由 AI 编写，请稍候…')
    const gen = await authFetch('/api/v1/bidding/bid/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tender_path: data.data.tender_path, company_id: bidCompanyId.value, price_wan: price }),
    })
    const gd = await gen.json()
    if (!gen.ok) throw new Error((gd && (gd.detail || gd.message)) || `HTTP ${gen.status}`)
    await ElMessageBox.alert(`投标文件已生成：${gd.data.file_name}`, '生成完成', {
      confirmButtonText: '下载', type: 'success',
    }).catch(() => {})
    window.open(gd.data.download_url, '_blank')
  } catch (e2) {
    if (e2 !== 'cancel' && e2 !== 'close') ElMessage.error('投标文件生成失败：' + (e2.message || e2))
  } finally {
    bidMode.value = false
  }
}
const uploading = ref(false)
const uploadTotal = ref(0)
const uploadDone = ref(0)
const history = reactive([])
// 🔴 左侧只展示最近 5 条，避免整列滚动条
const visibleHistory = computed(() => history.slice(0, 5))
const router = useRouter()
function goHistory() { router.push('/app/history') }
const workflowLogs = ref([])
// 缺口清单（生成完成后提示「这章缺什么」）—— 不写进交付稿
const gaps = ref(null)
// 交付体检（80% 可用率目标）：{ rate, total, flagged, below_target, items[] }
const audit = ref(null)
const auditPct = computed(() => Math.round(((audit.value?.rate) || 0) * 1000) / 10)
const logBody = ref(null)
const missingFields = ref([])
const missingForm = reactive({})
const missingErrors = reactive({})

// 🔴 **一次只问一项**（业主：不要把整个章节的字段一次性铺出来）。
//    `curIdx` 是当前项的游标；每来一批新的 `missing_fields` 就归零。
const curIdx = ref(0)
const curField = computed(() => missingFields.value[curIdx.value] || null)

// 🔴 长文本用大文本框（单行 input 看不全整段字，用户没法确认内容对不对）。
//    判据：文本类 + （字数上限较大 或 已有较长的 AI 草稿）。
function isLongTextField(f) {
  if (!f) return false
  if (f.type && f.type !== 'text') return false
  // 缺口核对：`current` 是 AI 拟的一整句，天然要大框
  if (String(f.key || '').startsWith('_gap_')) return true
  // 🔴 以前拿 `maxlength > 30` 当“长文本”判据 —— 文号（maxlength 40）、
  //    项目名称（60）、单位地址（80）全被塞进 textarea，业主反馈「输入框全变大了」。
  //    字数上限只是校验约束，不代表内容长。现在只有**明确的长文本**：
  //    上限 ≥100 字（公告原文/情况说明这类），或预填值本身就超过一行。
  if ((f.maxlength || 0) >= 100) return true
  return String(f.current || '').length > 30
}

// 「下一项」：先校验当前项，不过就停在原地（避免用户带着错值一路点到底）
function nextMissing() {
  const f = curField.value
  if (f) {
    validateMissingField(f)
    if (missingErrors[f.key]) { ElMessage.warning('请先修正该项'); return }
  }
  if (curIdx.value < missingFields.value.length - 1) curIdx.value++
}

function groupTitle(ch) {
  const n = Number(ch)
  return (ch !== '' && Number.isFinite(n) && n > 0) ? `第${cnNum(n)}章` : String(ch)
}
function cnNum(n) {
  const cn = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  return cn[n] || n
}
// 🔴 逐项校验：数字项限数字、手机号走正则、文字项限长度/禁纯数字
function validateMissingField(f) {
  const v = String(missingForm[f.key] ?? '').trim()
  missingErrors[f.key] = ''
  if (!v) return
  if (f.type === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { missingErrors[f.key] = '请选择日期'; return }
    // 🔴 结束时间不能早于开始时间（浏览器 min/max 拦得住选择器，拦不住手输）
    const _ord = checkDateOrder(f.key, v)
    if (_ord) missingErrors[f.key] = _ord
    return
  }
  if (f.maxlength && v.length > f.maxlength) { missingErrors[f.key] = `不超过 ${f.maxlength} 字`; return }
  if (f.type === 'number') {
    const ok = f.pattern ? new RegExp(f.pattern).test(v) : !isNaN(Number(v))
    if (!ok) missingErrors[f.key] = '只能填写数字'
  } else if (f.type === 'phone') {
    if (f.pattern ? !new RegExp(f.pattern).test(v) : !/^1[3-9]\d{9}$/.test(v)) missingErrors[f.key] = '电话格式不正确（手机 11 位 1 开头，或座机如 0517-12345678）'
  } else {
    if (/^\d+$/.test(v)) missingErrors[f.key] = '该项应填写文字，不是数字'
  }
}
async function submitMissing() {
  let bad = false
  for (const f of missingFields.value) { validateMissingField(f); if (missingErrors[f.key]) bad = true }
  if (bad) { ElMessage.warning('请修正标红的字段'); return }
  const data = {}
  for (const f of missingFields.value) {
    const v = String(missingForm[f.key] ?? '').trim()
    if (v) data[f.key] = v
  }
  if (!Object.keys(data).length) { ElMessage.warning('请至少填写一项'); return }
  missingFields.value = []
  Object.keys(missingErrors).forEach(k => delete missingErrors[k])
  await reportStore.resumeWorkflow(data)
  // 🔴 Restart log polling — resumeWorkflow restarts workflow polling, but not log collection
  _collectLogs()
}
function skipMissing() {
  missingFields.value = []
  Object.keys(missingErrors).forEach(k => delete missingErrors[k])
  // 🔴 **不能送空对象 `{}`** —— LangGraph 把 `Command(resume={})` 当成「没有恢复值」，
  //    于是 resume 时 `interrupt()` **再次抛出**，节点永远走不到中断之后的代码，
  //    **同一个弹窗无限重弹**（离线最小复现：resume={} ❌ 死循环；resume={'x':1} ✅）。
  //    送一个哨兵，后端会忽略它（`_` 开头的键不进事实卡），但 LangGraph 能正确恢复。
  //    ⚠️ 值必须是**字符串**：接口 schema 是 `Dict[str, Any]`，但历史上写成
  //    `Dict[str, str]` 时布尔 `true` 会被 pydantic 在进函数体前直接 422
  //    ——「一按跳过就报错」就是这么来的。用 `'1'` 两边都不会踩。
  reportStore.resumeWorkflow({ __skip__: '1' })
  _collectLogs()
}

// ═══════════════════════════════════════════════════════════════
// ③ 选择报告人员 —— 决定前置「培训证书」页与「稳评工作组人员及分工情况」
//    数据源：GET /api/v1/company/personnel（**本公司**的人员库）
// ═══════════════════════════════════════════════════════════════
const personnel = ref([])
const personnelLoading = ref(false)
const selectedPersonnel = ref([])
const onlyCertPersonnel = ref(true)
// 🔴 默认**只看持证人员** —— 库里有 17 人持稳评培训证书（证书扫描件为证），
//    这才是可选人员的正常范围；名册（投标文件旧快照，仅 8 人）不该当过滤条件，
//    否则会把 14 个持证的人藏起来（业主：「持证人员可选择的太少」）。
//    想看名册上没证书的那几位，取消勾选「只看持证人员」即可。
function toggleNonCert(e) { onlyCertPersonnel.value = !e.target.checked }

const visiblePersonnel = computed(() => {
  // 🔴 复垦报告表「主要编制人员」只收**职称/职务 + 专业都齐全**的人 ——
  //    范文里能核对到的就是这 3 人（陈春/林叶青/刘利伟）；
  //    人员库里只有姓名、没有职称专业的（历史证书扫描件入库的那些）不列，
  //    否则会被选进报告表、印出一排「待补充」。
  if (domain.value === 'reclamation') {
    return personnel.value.filter(
      p => String(p.title || '').trim() && String(p.major || '').trim())
  }
  return !onlyCertPersonnel.value
    ? personnel.value
    : personnel.value.filter(p => p.has_wenshen_cert)
})
// 复垦：范文报告表就是 3 行 → 最多选 3 人；稳评仍按参照件 7 人。
const RECLAMATION_MAX_PERSONNEL = 3
const maxPersonnel = computed(() =>
  domain.value === 'reclamation' ? RECLAMATION_MAX_PERSONNEL : MAX_PERSONNEL)

function defaultPersonnelSelection() {
  if (domain.value === 'reclamation') {
    // 范文报告表就是这三位（陈春/林叶青/刘利伟）—— 有就默认勾上，不够再按名单补
    const preferred = ['陈春', '林叶青', '刘利伟']
    const picked = preferred
      .map(n => visiblePersonnel.value.find(p => p.name === n))
      .filter(Boolean)
    for (const p of visiblePersonnel.value) {
      if (picked.length >= RECLAMATION_MAX_PERSONNEL) break
      if (!picked.includes(p)) picked.push(p)
    }
    return picked.slice(0, RECLAMATION_MAX_PERSONNEL).map(p => p.name)
  }
  const certs = personnel.value.filter(p => p.has_wenshen_cert).map(p => p.name)
  return (certs.length ? certs : personnel.value.map(p => p.name)).slice(0, MAX_PERSONNEL)
}
const allSelected = computed(() =>
  visiblePersonnel.value.length > 0 && visiblePersonnel.value.every(p => selectedPersonnel.value.includes(p.name)))

async function loadPersonnel() {
  personnelLoading.value = true
  try {
    const res = await authFetch('/api/v1/company/personnel')
    const data = await res.json()
    const list = (data && data.data && data.data.personnel) || []
    if (!list.length) ElMessage.warning('人员库为空，请点「同步人员库」从名册与素材图导入')
    personnel.value = list
    // 🔴 默认勾选：稳评 = 持证者（不超过 7 人）；复垦 = 职称/专业齐全者（不超过 3 人）
    selectedPersonnel.value = defaultPersonnelSelection()
    // 🔴 证书候选 = 有证书扫描件的人；优先默认勾「工作组里也有证书的」，最多 MAX_CERT_PERSONNEL
    const withCert = list.filter(p => (p.cert_image_count || 0) > 0).map(p => p.name)
    const prefer = selectedPersonnel.value.filter(n => withCert.includes(n))
    selectedCertPersonnel.value = (prefer.length ? prefer : withCert).slice(0, MAX_CERT_PERSONNEL)
  } catch (e) {
    ElMessage.error('读取在职人员失败：' + e.message)
  } finally {
    personnelLoading.value = false
  }
}
// 某人可用的证书图片（来自人员库 company_personnel_images）
function certCount(p) { return p.cert_image_count || 0 }
function certTitles(p) { return (p.cert_images || []).join('\n') }

// 证书扫描件的姓名是手写体，文件名看不出是谁 —— 由后端一次性视觉识别并落盘
const certBuilding = ref(false)

// 从名册 + 素材图重建人员库（company_personnel / company_personnel_images 两张表）
async function syncPersonnelStore() {
  try {
    const fd = new FormData()
    const res = await authFetch('/api/v1/company/personnel/sync', { method: 'POST', body: fd })
    const data = await res.json()
    if (!res.ok) { ElMessage.error(data.detail || '同步失败'); return }
    ElMessage.success(data.message || '人员库已同步')
  } catch (e) {
    ElMessage.error('同步人员库失败：' + e.message)
  }
}
async function buildCertIndex() {
  // 🔴 证书扫描件的视觉识别扫的是**我们的素材目录**，属内部工具，
  //    后端已把 `/api/v1/knowledge/personnel/certs*` 设为管理员专属。
  //    普通用户用自己的「上传证书」（/api/v1/company/personnel/{id}/certs）。
  if (!authStore.isStaff) {
    ElMessage.warning('证书识别仅内部人员可用；请用「上传证书」')
    return
  }
  certBuilding.value = true
  try {
    const fd = new FormData()
    const res = await authFetch('/api/v1/knowledge/personnel/certs/build', { method: 'POST', body: fd })
    const data = await res.json()
    ElMessage.success(data.message || '已开始识别')
    // 轮询直到完成，再重建人员库并刷新名单上的证书数
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const st = await (await authFetch('/api/v1/knowledge/personnel/certs')).json()
      const job = (st.data && st.data.job) || {}
      if (job.status === 'done') { ElMessage.success(`✅ 证书识别完成（${job.done} 张）`); break }
      if (job.status === 'error') { ElMessage.error('证书识别失败：' + (job.error || '')); break }
    }
    await syncPersonnelStore()
    await loadPersonnel()
  } catch (e) {
    ElMessage.error('证书识别失败：' + e.message)
  } finally {
    certBuilding.value = false
  }
}

// 🔴 稳评工作组人数上限 —— 按参照件实测定的：
//   人工成品案卷（洪泽）6 人、洪泽稳评模板 7 人、金湖稳评模板 6 人、白马湖2号 6 人。
//   角色结构固定：1 负责人 + 2～4 调研 + 2 风险研判 + 1～2 数据汇总 + 1 资料档案。
const MAX_PERSONNEL = 7

function togglePersonnel(name) {
  const i = selectedPersonnel.value.indexOf(name)
  if (i >= 0) { selectedPersonnel.value.splice(i, 1); return }
  if (selectedPersonnel.value.length >= maxPersonnel.value) {
    ElMessage.warning(domain.value === 'reclamation'
      ? `主要编制人员最多 ${maxPersonnel.value} 人（范文报告表为 3 行），请先取消一位`
      : `稳评工作组一般不超过 ${maxPersonnel.value} 人（参照件为 6～7 人），请先取消一位`)
    return
  }
  selectedPersonnel.value.push(name)
}

function toggleAllPersonnel(e) {
  if (!e.target.checked) { selectedPersonnel.value = []; return }
  const all = visiblePersonnel.value.map(p => p.name)
  selectedPersonnel.value = all.slice(0, maxPersonnel.value)
  if (all.length > maxPersonnel.value) {
    ElMessage.info(`已选前 ${maxPersonnel.value} 人（上限），其余请逐位替换`)
  }
}

// 🔴 「选择证书」——与工作组**分开**的另一个多选框（业主口径：最多 3 人）。
//    只列**有证书扫描件的人**；这几张证书图贴在报告前置「公司营业执照之后」。
const MAX_CERT_PERSONNEL = 3
const selectedCertPersonnel = ref([])
// 🔴 切到非稳评类型时清空「报告人员 / 选择证书」——这两步只对稳评有意义，
//    留着旧选择会随工作流一起提交（后端会拿去贴稳评工作组名单/证书图）。
// 🔴 「选择证书」只对稳评有意义（贴前置的个人培训证书图）—— 切到别的类型就清空；
//    但「报告人员」复垦也要用（报告表的主要编制人员），只有投标不用，才算清空。
watch(domain, (d) => {
  if (d !== 'stability') {
    selectedCertPersonnel.value = []
  }
  if (d === 'bidding') {
    selectedPersonnel.value = []
  } else if (d === 'reclamation') {
    // 复垦只列职称/专业齐全的人，默认选前 3 位
    selectedPersonnel.value = defaultPersonnelSelection()
  } else if (d === 'stability') {
    selectedPersonnel.value = defaultPersonnelSelection()
  }
})
const certCandidates = computed(() =>
  personnel.value.filter(p => (p.cert_image_count || 0) > 0))

function toggleCertPersonnel(name) {
  const i = selectedCertPersonnel.value.indexOf(name)
  if (i >= 0) { selectedCertPersonnel.value.splice(i, 1); return }
  if (selectedCertPersonnel.value.length >= MAX_CERT_PERSONNEL) {
    ElMessage.warning(`证书最多选 ${MAX_CERT_PERSONNEL} 人（对应营业执照后贴几张证书图），请先取消一位`)
    return
  }
  selectedCertPersonnel.value.push(name)
}

const isRunning = computed(() => reportStore.isStreaming || reportStore.phase === 'generating' || reportStore.workflowPaused)
const phase = computed(() => reportStore.phase)
// 🔴 日期区间约束：**只约束有关联的日期对**，互不相关的日期互不限制。
//    （业主 2026-09-28：「有几个日期是互不相关的就不要相互限制，只针对有关联的日期限制。」）
//    原来把 11 个日期串成一条大链（委托→方案→勘察→座谈→编制→评审→审核）强制全局排序，
//    连字段样例自己都违反（方案审核样例 06-03 早于评审结束样例 06-15，链却要求审核更晚），
//    用户照真实项目填合法日期会被误拦。现在只留两类：
//      ① 同一活动的 开始/结束 对（结束不得早于开始）；
//      ② 有明确因果关系的相邻对。
const DATE_RANGES = [
  // ① 同一活动起止
  ['notice_date', 'notice_end_date'],                    // 现场公示
  ['risk_predict_date', 'risk_predict_end_date'],        // 风险预测
  ['report_draft_date', 'report_draft_end_date'],        // 报告编制
  ['review_date', 'review_end_date'],                    // 专家评审
  ['publicity_start_date', 'publicity_end_date'],        // 稳评公示
  // ② 有因果关系的相邻对
  ['commission_date', 'plan_date'],                      // 先委托，后制定方案
  ['plan_date', 'plan_approve_date'],                    // 先制定方案，后方案审核
  ['notice_publish_date', 'notice_date'],                // 公告发布在前，现场公示在后
]
// 弹窗里展示中文字段名（业主：不要给用户看英文字段）
const fieldLabel = (key) =>
  missingFields.value.find(f => f.key === key)?.label || key
const dateMin = (key) => {
  const p = DATE_RANGES.find(([, e]) => e === key)
  return p ? (missingForm[p[0]] || undefined) : undefined
}
const dateMax = (key) => {
  const p = DATE_RANGES.find(([s]) => s === key)
  return p ? (missingForm[p[1]] || undefined) : undefined
}
/** 提交前的跨字段校验：返回错误信息，或空串。 */
function checkDateOrder(key, val) {
  if (!val) return ''
  const lo = DATE_RANGES.find(([, e]) => e === key)
  if (lo && missingForm[lo[0]] && String(val) < String(missingForm[lo[0]])) {
    return `不能早于「${fieldLabel(lo[0])}」填的 ${missingForm[lo[0]]}`
  }
  const hi = DATE_RANGES.find(([s]) => s === key)
  if (hi && missingForm[hi[1]] && String(val) > String(missingForm[hi[1]])) {
    return `不能晚于「${fieldLabel(hi[1])}」填的 ${missingForm[hi[1]]}`
  }
  return ''
}


//    直接印出来业主看不懂（业主：「弹窗的消息可以用中国标题么不要用英文字段」）。
//    取值见 `app/validation/audit_dispatcher.py:classify_issue` 与
//    `audit_result` 的 severity 字段。
const SEVERITY_CN = { critical: '严重', error: '错误', warning: '警告', warn: '警告', info: '提示' }
const DISPOSITION_CN = {
  ai_rewrite: 'AI 重写', human: '需人工处理', auto_fix: '自动修复',
  warning: '提示', regenerate: '重新生成', manual_fix: '人工修改',
}
const STATUS_CN = { queued: '待处理', approved: '已通过', rewritten: '已重写', pending: '待处理' }
const sevCn = (v) => SEVERITY_CN[v] || '提示'
const dispCn = (v) => DISPOSITION_CN[v] || '待处理'
const statusCn = (v) => STATUS_CN[v] || '待处理'

const downloadUrl = computed(() => reportStore.downloadUrl)
const statusMessage = computed(() => reportStore.statusMessage || '准备中...')

let _maxPct = 0
const pct = computed(() => {
  const steps = reportStore.progressSteps || []
  if (!steps.length) return 0
  // Weighted progress: prep steps 10%, generation 75%, post steps 15%
  const genStep = steps.find(s => s.key === 'generation')
  const qualityStep = steps.find(s => s.key === 'quality')
  const assemblyStep = steps.find(s => s.key === 'assembly')

  // Pre-generation: up to 10%
  const preDone = steps.filter(s => ['analysis','outline','fixed_data','knowledge'].includes(s.key) && s.done).length
  let base = Math.round(preDone / 4 * 10)

  // Generation phase: 10%-85% (75% of total)
  if (genStep) {
    if (genStep.active || genStep.done) {
      const ch = reportStore.currentChapter || 1
      const total = reportStore.totalChapters || 10
      base = Math.max(base, 10 + Math.round((ch / total) * 75))
    }
  }

  // 组装阶段走到 99% 为止 —— **100% 只留给「报告真的能下载」那一刻**。
  if (assemblyStep && assemblyStep.done) base = Math.max(base, 99)

  const v = Math.min(base, 99)
  if (v > _maxPct) _maxPct = v
  const _paused = reportStore.workflowPaused
  // 🔴 **唯一的 100%**：后端已经给出可下载的产物地址（且文件确实存在）。
  //    以前这里用 `assembly.done` / `phase === 'complete'` 直接给 100%，
  //    而后端可能因为**上一轮遗留的 output_path** 把 assembly 误报成 done ——
  //    于是「待补充信息」弹窗还没填完，进度条就满了（业主反馈的现象）。
  //    只认「下载链接已就绪」这一个事实，前端就不再被后端的状态派生错误带偏。
  if (reportStore.downloadUrl && !_paused) _maxPct = 100
  if (_paused && _maxPct > 99) _maxPct = 99
  return _maxPct
})

// 🔴 进度条按 1% 平滑递增：实际进度 pct 作为目标，displayPct 每 tick +1% 追进，
//    避免按章节一次跳 7.5% 的"跳变感"
const displayPct = ref(0)
let _pctTimer = null
function _startPctClimb() {
  if (_pctTimer) return
  _pctTimer = setInterval(() => {
    const target = pct.value
    if (displayPct.value >= target) {
      clearInterval(_pctTimer); _pctTimer = null
      return
    }
    displayPct.value += 1   // 每次精确 +1%
  }, 300)                    // 每 300ms 加 1%，总生成期约平滑爬升
}
watch(pct, _startPctClimb)
watch(() => reportStore.phase, (p) => {
  if (p === 'complete') { _startPctClimb() }
})
const chInfo = computed(() => {
  const ch = reportStore.currentChapter
  const total = reportStore.totalChapters
  return ch && total ? `第 ${ch}/${total} 章` : ''
})
const steps = computed(() => reportStore.progressSteps || [])
const canGenerate = computed(() => files.value.length > 0)

// ── History ──
let _downloadTimer = null
onMounted(() => {
  loadHistory()
  loadPersonnel()               // ③ 在职人员名单（默认勾选持稳评培训证书者）
  _restoreSession()
})

// 🔴 刷新后接着看：把上次的会话接回来（24 小时内），重新开始轮询状态。
//    暂停态会把「待补充信息」弹窗重新顶出来，用户填完即可继续。
function _restoreSession() {
  try {
    const raw = localStorage.getItem(REPORT_SESSION_KEY)
    if (!raw) return
    const { id, ts, domain: savedDomain } = JSON.parse(raw) || {}
    if (!id || !ts || Date.now() - ts > 24 * 3600 * 1000) { _forgetSession(); return }
    if (reportStore.sessionId) return          // 当前页已有会话，不覆盖
    reportStore.sessionId = id
    // 🔴 连报告类型一起接回来：否则界面停在默认「稳评」，而会话其实是复垦，
    //    用户一生成就被当成换了类型 → 白重置一次；反过来更糟（复用稳评会话出复垦）。
    if (savedDomain) {
      domain.value = savedDomain
      reportStore.setSelectedDomain(savedDomain)
    }
    showProgress.value = true
    workflowLogs.value = ['🔄 已接回上次的生成会话，正在同步状态...']
    _collectLogs()
  } catch { _forgetSession() }
}
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  // 🔴 Clean up all timers to prevent memory leaks
  if (_logTimer) { clearInterval(_logTimer); _logTimer = null }
  if (_downloadTimer) { clearTimeout(_downloadTimer); _downloadTimer = null }
  // Abort SSE if still streaming
  reportStore.cancelGeneration()
})
// 🔴 刷新/关页**不再取消生成**（业主 2026-10-29：「前台卡住了」）。
//    以前只要页面卸载就 POST /cancel —— 用户误刷新一次，后台工作流就被杀掉，
//    会话停在「生成中/暂停」状态，回来一看就是卡死，还得从头再来。
//    现在：后台继续跑，会话 id 存在 localStorage，回来能接着看进度/填弹窗。
const REPORT_SESSION_KEY = 'zhongtuo_report_session'

function _rememberSession(id) {
  try {
    if (id) localStorage.setItem(REPORT_SESSION_KEY,
      JSON.stringify({ id, ts: Date.now(), domain: domain.value || reportStore.selectedDomain || '' }))
  } catch { /* 隐私模式忽略 */ }
}

function _forgetSession() {
  try { localStorage.removeItem(REPORT_SESSION_KEY) } catch {}
}
async function loadHistory() {
  try {
    const r = await authFetch('/api/v1/history/reports?page=1&page_size=20')
    const d = await r.json()
    const items = d.data?.items || d.data || []
    history.splice(0, history.length, ...items.map(i => ({
      id: i.id,
      title: i.title || '未命名',
      time: i.created_at ? new Date(i.created_at).toLocaleDateString() : '',
      size: i.file_size || 0,
      download_url: i.report_file_path ? `/api/v1/files/${i.report_file_path}` : (i.download_url || ''),
    })))
  } catch { /* silent */ }
}

// ── Watch: complete → auto download ──
// 🔴 不能用 <a href> 直链：浏览器直链不带 Authorization 头，/api/v1/files/* 会 401。
//    必须走 downloadFile()（authFetch 拿 blob 再落盘），见 utils/download.js。
watch(() => reportStore.phase, async (p) => {
  // 生成结束（成功/失败）就不再接回这个会话，避免下次进页面对着一份旧进度
  if (p === 'complete' || p === 'error') _forgetSession()
  if (p === 'complete') {
    const url = reportStore.downloadUrl
    if (url) {
      _downloadTimer = setTimeout(async () => {
        // 失败提示由 _downloadWithFeedback 统一弹，这里不再重复
        await _downloadWithFeedback(url, '报告')
        _downloadTimer = null
      }, 300)
    }
    files.value = []
    _maxPct = 0
    loadHistory()
    ElMessage.success('报告生成完成！')
    // 🔴 缺口清单在这里提示，**不写进交付稿**（业主口径）。
    //    以前是写成 Word 批注挂在章节上，交付稿里带一批批注气球。
    try {
      const res = await getSessionGaps(reportStore.sessionId)
      gaps.value = res?.data || null
      audit.value = res?.data?.audit || null
      // 交付体检优先播报：先告诉用户「能不能直接用、要扫哪几处」
      if (audit.value?.total) {
        const pct = auditPct.value
        const below = audit.value.below_target
        ElNotification({
          title: below ? `报告已生成，可用率 ${pct}%（低于 80% 目标）` : `报告已生成，可用率 ${pct}%`,
          message: below
            ? `有 ${audit.value.flagged} 段建议扫一眼（套话腔/空泛表述/待补充），展开下方「交付体检」可逐条看`
            : `需扫一眼 ${audit.value.flagged} 段，基本可以读一遍就用 —— 展开下方「交付体检」看清单`,
          type: below ? 'warning' : 'success',
          duration: 9000,
        })
      } else if (gaps.value?.total) {
        ElNotification({
          title: '报告已生成，有几处建议人工核对',
          message: `共 ${gaps.value.total} 处「待补充 / 待核对」，其中 ${gaps.value.warnings || 0} 处需重点看 —— 展开下方清单可查看逐条明细`,
          type: 'warning',
          duration: 9000,
        })
      }
    } catch (e) { console.warn('[GAPS] 缺口清单获取失败:', e) }
  }
})

// ── Upload ──
const currentMaterial = ref('')

function clickFile() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.multiple = true
  inp.accept = UPLOAD_ACCEPT
  inp.onchange = (e) => { onFiles(e); inp.remove() }
  inp.click()
}
function clickFileForMaterial(name) {
  currentMaterial.value = name
  clickFile()
}
function materialFiles(name) {
  return files.value.filter(f => f.material_type === name)
}
function removeFile(f) {
  const i = files.value.indexOf(f)
  if (i >= 0) files.value.splice(i, 1)
}
function clickFolder() {
  const inp = document.createElement('input')
  inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true
  inp.onchange = (e) => { onFolder(e); inp.remove() }
  inp.click()
}
async function onFiles(e) { await addFiles(e.target.files); e.target.value = '' }
async function onFolder(e) {
  const fs = e.target.files
  if (fs?.length) await addFiles(fs)
  e.target.value = ''
}
async function onDrop(e) { await addFiles(e.dataTransfer.files) }
// 🔴 与后端 ALLOWED_ATTACHMENT_EXTENSIONS 对齐：不支持的扩展名**不发请求**，
//    直接告诉用户「这几个没传、为什么」——以前是整文件夹上传，shapefile 组件
//    一个个 400，用户只看到「传了一半」，不知道是哪几个（业主 2026-10-30）。
const UPLOAD_EXTS = [
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'heic', 'heif',
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'ppt', 'pptx',
  'txt', 'md', 'zip', 'rar', 'dwg', 'dxf',
  // GIS 矢量数据（Shapefile 一整套，缺一个都打不开）
  'shp', 'shx', 'dbf', 'prj', 'cpg', 'sbn', 'sbx', 'qpj', 'xml',
]
const UPLOAD_ACCEPT = UPLOAD_EXTS.map(e => '.' + e).join(',')
// 系统/软件副产物：永远不用传，也不提示
const JUNK_NAMES = ['thumbs.db', '.ds_store', 'desktop.ini', '.gitignore']
// 软件自动生成的备份/临时文件（如 AutoCAD 的 .bak）—— 不用传，也不必报错
const JUNK_EXTS = ['bak', 'tmp', 'temp', 'swp', 'db', 'ini', 'log']

function _extOf(name) {
  const n = (name || '').toLowerCase()
  const i = n.lastIndexOf('.')
  return i >= 0 ? n.slice(i + 1) : ''
}
function _isJunk(name) {
  const n = (name || '').toLowerCase().split('/').pop()
  if (JUNK_NAMES.includes(n) || n.startsWith('._')) return true
  const ext = _extOf(n)
  return JUNK_EXTS.includes(ext)
}

async function addFiles(fileList) {
  const all = Array.from(fileList || [])
  const todo = [], unsupported = []
  for (const f of all) {
    if (_isJunk(f.name)) continue
    const ext = _extOf(f.name)
    if (!ext || !UPLOAD_EXTS.includes(ext)) unsupported.push(f.name)
    else todo.push(f)
  }

  console.log(`[UPLOAD] 待传 ${todo.length} 个，不支持 ${unsupported.length} 个`)
  const failed = []
  uploading.value = true
  uploadTotal.value = todo.length
  uploadDone.value = 0
  for (const f of todo) {
    try {
      if (!reportStore.sessionId) {
        reportStore.setSelectedDomain(domain.value)
        // startGeneration(initialMessage, tplId, tplName, intent, domain)
        await reportStore.startGeneration('生成报告', 0, '默认模板', domain.value, domain.value, templatePath.value)
        console.log('[UPLOAD] 创建会话:', reportStore.sessionId, '域:', domain.value)
      }
      const r = await reportStore.uploadFile(f)
      if (r?.file_path) {
        files.value.push({ path: r.file_path, url: r.url || '', name: r.original_name || f.name, size: f.size || 0, ft: r.file_type || 'file', material_type: currentMaterial.value })
        uploadDone.value++
      } else {
        failed.push({ name: f.name, reason: '服务端未返回文件地址' })
      }
    } catch (e) {
      console.error(`[UPLOAD] ${f.name} 失败:`, e)
      failed.push({ name: f.name, reason: e?.message || '上传失败' })
    }
  }
  uploading.value = false
  console.log(`[UPLOAD] 完成 ${uploadDone.value}/${uploadTotal.value}，失败 ${failed.length}，不支持 ${unsupported.length}`)
  _reportUploadResult(uploadDone.value, failed, unsupported)
  checkRecognition()
}

/** 上传结束给一份「谁进来了、谁没进来、为什么」的清单（而不是静默失败） */
function _reportUploadResult(okCount, failed, unsupported) {
  const lines = []
  if (okCount) lines.push(`<div style="color:#15803d"><b>✅ 成功上传 ${okCount} 个文件</b></div>`)
  if (failed.length) {
    const list = failed.slice(0, 8).map(x => `${x.name}（${x.reason}）`).join('<br>')
    lines.push(`<div style="margin-top:6px;color:#b42318"><b>❌ 失败 ${failed.length} 个</b>：<br>${list}`
      + (failed.length > 8 ? `<br>…另有 ${failed.length - 8} 个` : '') + '</div>')
  }
  if (unsupported.length) {
    const list = unsupported.slice(0, 8).join('、')
    lines.push(`<div style="margin-top:6px;color:#b45309"><b>⚠️ 不支持 ${unsupported.length} 个，未上传</b>：${list}`
      + (unsupported.length > 8 ? ` 等 ${unsupported.length} 个` : '')
      + '<br><span style="color:#666">只支持图片/PDF/Word/Excel/CAD(DWG、DXF)/Shapefile(.shp .shx .dbf .prj 等)/压缩包；'
      + '其他类型请打包成 zip 再传</span></div>')
  }
  if (!lines.length) return
  ElNotification({
    title: failed.length || unsupported.length ? '上传结果：有文件没传上去' : '上传完成',
    dangerouslyUseHTMLString: true,
    duration: failed.length || unsupported.length ? 0 : 4000,
    message: lines.join(''),
  })
}

// 🔴 上传后立即核验「材料里到底认到了什么、还缺什么」。
//    日志面板只对内部人员可见（v-if 里带 isStaff），外部用户此前**看不到任何识别结果**，
//    少传/传错只能等生成到一半被弹窗追问。这里给所有人都回一份明确清单。
async function checkRecognition() {
  if (!reportStore.sessionId) return
  try {
    // 材料解析在后台跑（indexing），稍等再查，避免查到空
    await new Promise(r => setTimeout(r, 2500))
    const resp = await authFetch(`/api/v1/reports/generate/${reportStore.sessionId}/recognition`)
    const d = (await resp.json())?.data
    if (!d || !d.total) return
    const ok = d.recognized || []
    const miss = d.missing || []
    const okLine = ok.length
      ? `<div style="margin-top:4px"><b>✅ 已识别 ${ok.length}/${d.total}</b>：`
        + ok.map(i => `${i.label}（${i.value}）`).join('、') + '</div>'
      : ''
    const missLine = miss.length
      ? `<div style="margin-top:6px;color:#b45309"><b>⚠️ 材料中未识别 ${miss.length} 项</b>：`
        + miss.map(i => i.label).join('、')
        + (domain.value === 'stability'
            ? '<br><span style="color:#666">生成过程中会逐项询问，也可现在补传材料</span></div>'
            : '<br><span style="color:#666">缺失项会在正文用规范话术处理并列入交付清单；'
              + '关键材料建议现在补传</span></div>')
      : '<div style="margin-top:6px;color:#15803d"><b>✅ 关键信息已全部识别</b></div>'
    ElNotification({
      title: '材料识别结果',
      dangerouslyUseHTMLString: true,
      duration: miss.length ? 0 : 6000,
      message: okLine + missLine,
    })
  } catch (e) {
    console.warn('[RECOGNITION] 核验失败（不影响上传）:', e?.message || e)
  }
}

// ── Generate / Cancel ──
async function startGenerate() {
  showProgress.value = true
  _maxPct = 0
  workflowLogs.value = ['🚀 正在启动工作流...']
  try {
    // 🔴 报告类型必须与会话一致：上次是稳评、这次选复垦时，不能复用那个会话，
    //    否则整条工作流按稳评域跑、连模板都取稳评的（业主 2026-10-31 实测）。
    if (reportStore.sessionId && reportStore.selectedDomain && reportStore.selectedDomain !== domain.value) {
      resetAll()
    }
    if (!reportStore.sessionId) {
      reportStore.setSelectedDomain(domain.value)
      // startGeneration(initialMessage, tplId, tplName, intent, domain) —— 后两个才是「域」
      await reportStore.startGeneration('生成报告', 0, '默认模板', domain.value, domain.value, templatePath.value)
    }
    // 🔴 Use LangGraph workflow for generation (with progress bar)
    console.log('[GENERATE] 启动工作流, session:', reportStore.sessionId, '域:', domain.value)
    // 🔴 报告人员：稳评（工作组名单）与复垦（报告表主要编制人员）都用；
    //    证书图只有稳评前置页需要。
    await reportStore.generateWithWorkflow('',
      (domain.value === 'stability' || domain.value === 'reclamation') ? selectedPersonnel.value : [],
      domain.value === 'stability' ? selectedCertPersonnel.value : [], domain.value)
    _rememberSession(reportStore.sessionId)
    console.log('[GENERATE] 工作流已启动, 开始轮询日志')
    // Start collecting logs via polling
    _collectLogs()
  } catch (e) {
    console.error('[GENERATE] 启动失败:', e)
    if (e.name !== 'AbortError') {
      ElMessage.error('生成失败: ' + (e.message || '未知错误'))
    }
    showProgress.value = false
  }
}
async function cancelGenerate() {
  try {
    await reportStore.cancelGeneration()
    showProgress.value = false
    ElMessage.info('生成已取消')
  } catch {}
}
let _logTimer = null
function _collectLogs() {
  console.log('[POLL] 开始轮询工作流状态...')
  if (_logTimer) clearInterval(_logTimer)
  _logTimer = setInterval(async () => {
    if (!showProgress.value || !reportStore.sessionId) { console.log('[POLL] 停止(页面关闭)'); clearInterval(_logTimer); return }
    try {
      const { getWorkflowStatus } = await import('@/api/report')
      const res = await getWorkflowStatus(reportStore.sessionId)
      const data = res.data || res
      // 🔴 Update chapter progress so progress bar advances
      if (typeof data.total_chapters === 'number' && data.total_chapters > 0) {
        reportStore._totalChaptersOverride = data.total_chapters
      }
      if (typeof data.current_chapter === 'number') {
        reportStore.currentChapter = data.current_chapter
      }
      // 🔴 Sync step statuses to drive the 3-step bar
      if (data.step_statuses) {
        const ss = data.step_statuses
        for (const s of (reportStore.progressSteps || [])) {
          const st = ss[s.key]
          // 🔴 **两种状态都要显式写**：原来只置 `done = true`、从不置回 false，
          //    于是上一轮跑完后每一步都永久停在「已完成」——
          //    同一会话再生成一次时，步骤条一上来就是全绿（进度条跟着虚高）。
          s.done = (st === 'done')
          s.active = (st === 'running')
        }
      }
      if (data.logs && data.logs.length > workflowLogs.value.length) {
        console.log(`[POLL] 日志更新: ${workflowLogs.value.length}→${data.logs.length} 条`)
        workflowLogs.value = [...data.logs]
        setTimeout(() => { if (logBody.value) logBody.value.scrollTop = logBody.value.scrollHeight }, 50)
      }
      if (data.phase === 'complete') { console.log('[POLL] 完成!'); clearInterval(_logTimer) }
      if (data.phase === 'error') { console.log('[POLL] 错误!'); clearInterval(_logTimer) }
      if (data.phase === 'idle') { console.log('[POLL] 会话过期'); clearInterval(_logTimer) }
      if (data.phase === 'human_review' || (data.phase === 'paused' && data.human_queue?.length)) {
        // 🔴 人工复核暂停：拉取待复核章节明细（含违规），停止轮询等用户处理
        console.log('[POLL] 人工复核:', data.human_queue?.length, '章待处理')
        reportStore.phase = 'human_review'
        reportStore.workflowPaused = true
        pendingHumanChapters.value = true
        humanProcessing.value = false
        clearInterval(_logTimer)
        try {
          const { getHumanQueue } = await import('@/api/report')
          const hq = await getHumanQueue(reportStore.sessionId)
          humanQueue.value = (hq.data?.chapters) || []
          humanIdx.value = 0   // 新队列 → 从第一章开始逐章问
          // 回填已提交过的意见/审批状态
          for (const c of humanQueue.value) {
            if (c.human_opinion) humanOpinionForm[c.chapter] = c.human_opinion
            if (c.human_approved || c.human_override || c.human_opinion) humanDone[c.chapter] = true
          }
        } catch (e) { console.error('[POLL] 拉取人工复核队列失败:', e.message || e) }
      }
      if (data.phase === 'paused') {
        console.log('[POLL] 暂停:', data.missing_fields?.length, '个缺失字段')
        missingFields.value = data.missing_fields || []
        // 🔴 新一批 → 逐条游标归零（否则会停在上批的索引上，指向不存在的项）
        curIdx.value = 0
        // 🔴 Also update store so template fallback works
        reportStore.workflowMissingFields = data.missing_fields || []
        reportStore.workflowPaused = true
        if (data.missing_fields?.length) {
          // 🔴 预填**解析出来的当前值**：这批字段是「数据核对」弹窗送来的
          //    （后端 `node_data_inquiry` 会带 `current` + `source`），
          //    目的是让用户核对「材料里认出来的/系统校验的」对不对 ——
          //    输入框空着的话用户根本看不到要核对什么。
          //    缺字段弹窗（`missing_data`）不带 `current`，行为与以前一致（空框）。
          //    ⚠️ 只在**还没填过**时预填，别把用户已经输入的内容冲掉。
          for (const f of data.missing_fields) {
            if (missingForm[f.key] === undefined) missingForm[f.key] = f.current ?? ''
          }
        }
        clearInterval(_logTimer)
      }
    } catch(e) { console.error('[POLL] 错误:', e.message || e) }
  }, 5000)  // 🔴 Reduced from 2s → 5s (was doubling with store poller)
}

function onDownload() { setTimeout(() => { showProgress.value = false }, 1000) }

// ── 下载反馈 ──
// 🔴 业主反馈「下载文件没有提示，用户都不知道自己有没有正在下载」：
//    报告 docx 有几 MB，点下去到落盘之间界面毫无动静，用户会重复点。
//    → 下载期间盖一层蒙层显示百分比，下完再弹「已下载：文件名（大小）」
const downloading = ref(false)
const downloadLabel = ref('正在下载报告…')
const downloadPct = ref(-1)        // 0~1；-1 = 服务器没给总长度，只能显示已接收字节
const downloadReceived = ref(0)

// 🔴 带鉴权下载（直链 <a href> 不带 Authorization，/api/v1/files/* 会 401）
async function _downloadWithFeedback(url, label = '报告') {
  if (!url) return
  if (downloading.value) { ElMessage.info('正在下载上一个文件，请稍候…'); return }
  downloading.value = true
  downloadLabel.value = `正在下载${label}…`
  downloadPct.value = -1
  downloadReceived.value = 0
  const t0 = Date.now()
  try {
    const { filename, size } = await downloadFile(url, '', (pct, received) => {
      downloadPct.value = pct == null ? -1 : pct
      downloadReceived.value = received
    })
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    ElMessage.success({
      message: `已下载：${filename}（${fmtSize(size)}，用时 ${secs} 秒）`,
      duration: 6000,
      showClose: true,
    })
  } catch (e) {
    ElMessage.error(e?.message || '下载失败，请重试')
  } finally {
    downloading.value = false
  }
}
function doDownload() { return _downloadWithFeedback(reportStore.downloadUrl, '报告') }
function dlHistory(h) {
  return _downloadWithFeedback(h.download_url, `《${h.title || '报告'}》`)
}

// 🔴 人工复核：提交修改思路 → 交给 AI 携意见重写本章
async function submitHumanOpinion(ch) {
  const opinion = (humanOpinionForm[ch] || '').trim()
  if (!opinion) { ElMessage.warning('请先填写修改思路'); return }
  humanBusy[ch] = true
  try {
    const { submitHumanOpinion } = await import('@/api/report')
    await submitHumanOpinion(reportStore.sessionId, ch, 'opinion', { opinion })
    humanDone[ch] = true
    ElMessage.success(`第${ch}章意见已提交，AI 将携意见重写`)
  } catch (e) { ElMessage.error('提交失败: ' + (e.message || e)) }
  finally { humanBusy[ch] = false }
}
// 🔴 人工复核：直接审批放行 → 跳过该章后续 AI 审核重写
async function approveHumanChapter(ch) {
  humanBusy[ch] = true
  try {
    const { submitHumanOpinion } = await import('@/api/report')
    await submitHumanOpinion(reportStore.sessionId, ch, 'approve')
    humanDone[ch] = true
    ElMessage.success(`第${ch}章已审批放行`)
  } catch (e) { ElMessage.error('审批失败: ' + (e.message || e)) }
  finally { humanBusy[ch] = false }
}
// 🔴 人工复核：触发继续生成（处理已提交的意见/审批后 resume 工作流）
async function triggerHumanRewrite() {
  humanProcessing.value = true
  try {
    const { triggerHumanRewrite } = await import('@/api/report')
    const res = await triggerHumanRewrite(reportStore.sessionId)
    ElMessage.success(res?.data?.message || '已继续生成')
    pendingHumanChapters.value = false
    humanQueue.value = []
    reportStore.workflowPaused = false
    // 重新开始轮询工作流状态
    _collectLogs()
  } catch (e) {
    ElMessage.error('继续生成失败: ' + (e.message || e))
    humanProcessing.value = false
  }
}
function resetAll() {
  showProgress.value = false
  workflowLogs.value = []
  missingFields.value = []
  gaps.value = null
  audit.value = null
  if (_logTimer) clearInterval(_logTimer)
  files.value = []
  _maxPct = 0
  // 🔴 清理人工复核状态
  pendingHumanChapters.value = false
  humanQueue.value = []
  humanProcessing.value = false
  Object.keys(humanOpinionForm).forEach(k => delete humanOpinionForm[k])
  Object.keys(humanDone).forEach(k => delete humanDone[k])
  Object.keys(humanBusy).forEach(k => delete humanBusy[k])
  // 🔴 Cancel any running workflow and reset store
  reportStore.cancelWorkflow()
  reportStore.downloadUrl = ''
  reportStore.phase = 'idle'
  reportStore.statusMessage = ''
  reportStore.progressSteps = []
  reportStore._totalChaptersOverride = 0
  reportStore.currentChapter = 1
  reportStore.sessionId = null  // Force new session on next generate
}

// Helpers
function ext(f) { const n = (f.name || '').toLowerCase(); if (n.endsWith('.pdf')) return 'PDF'; if (/\.(doc|docx)$/.test(n)) return 'DOC'; if (/\.(xls|xlsx|csv)$/.test(n)) return 'XLS'; if (/\.(png|jpg|jpeg|gif|webp)$/.test(n)) return 'IMG'; return 'FILE' }
function badge(f) { return 'b' + ext(f).toLowerCase() }
function fmtSize(b) { if (!b) return ''; return b < 1024 ? b + 'B' : b < 1048576 ? (b / 1024).toFixed(1) + 'KB' : (b / 1048576).toFixed(1) + 'MB' }
</script>

<style scoped>
.mat-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-bottom: 10px; background: #fafbfc; }
.mat-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mat-name { font-weight: 600; color: #1f2937; font-size: 14px; }
.mat-format { color: #6b7280; font-size: 12px; }
.mat-note { color: #9ca3af; font-size: 12px; flex: 1; }
.mat-upload { padding: 6px 14px; font-size: 13px; }
.mat-files { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.mat-file { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #374151; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 3px 8px; }
.mat-empty { margin-top: 6px; font-size: 12px; color: #d1d5db; }
.mat-optional { margin-top: 8px; font-size: 13px; color: #6b7280; }
.mat-optional summary { cursor: pointer; }
.fl-mat { font-size: 11px; color: #1d4ed8; background: #eff6ff; border-radius: 4px; padding: 1px 6px; flex-shrink: 0; }
/* 🔴 整页固定：外层 app 外壳不再滚窗口（见 AppLayout `.pl-content.is-fixed`），
   这里占满可用高度，**只有 .gen 正文区和 .sidebar 各自内部滚动**。 */
.gen-layout { display: flex; height: 100%; overflow: hidden; }
.intent-row { display: flex; gap: 10px; margin-bottom: 12px; }
.intent-input { flex: 1; min-width: 0; box-sizing: border-box; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px; outline: none; }
.intent-input:focus { border-color: #1d4ed8; }
.intent-guide { background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; }
.intent-guide h3 { font-size: 14px; margin: 0 0 6px; color: #1e40af; }
.intent-desc { font-size: 13px; color: #4b5563; margin: 0 0 10px; }
.case-list { max-height: 420px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; margin: 0 0 12px; background: #fafafa; }
.case-item { padding: 6px 0; border-bottom: 1px dashed #e5e7eb; }
.case-item:last-child { border-bottom: none; }
.case-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.case-kind { font-size: 12px; color: #2563eb; background: #eff6ff; border-radius: 4px; padding: 1px 6px; }
.case-item .intent-desc { margin: 2px 0; font-size: 12px; }
.bid-company-select { padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; margin-right: 8px; }
.guide-label { font-size: 13px; font-weight: 600; color: #374151; margin: 10px 0 6px; }
.guide-list { list-style: none; padding: 0; margin: 0; }
.guide-list li { font-size: 13px; color: #374151; padding: 4px 0; }
.guide-list strong { color: #1d4ed8; }
.sidebar { width: 220px; background: #f8fafc; border-right: 1px solid #e5e7eb; padding: 16px; overflow-y: auto; flex-shrink: 0; }
.hist-all { margin-top: 10px; padding: 6px 10px; border: 1px solid #2563eb; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; font-size: 12px; width: 100%; }
.hist-all:hover { background: #1d4ed8; }
.sidebar h3 { font-size: 13px; margin: 0 0 12px; color: #374151; }
.hist-list { display: flex; flex-direction: column; gap: 8px; }
.hist-item { padding: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; }
.hist-title { font-weight: 600; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-meta { color: #9ca3af; font-size: 11px; margin: 2px 0; }
.hist-dl { color: #1d4ed8; font-size: 11px; text-decoration: none; }
.hist-dl.disabled { color: #d1d5db; }
.hist-refresh { margin-top: 10px; padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 11px; width: 100%; }

.gen { flex: 1; max-width: 780px; margin: 0 auto; padding: 24px 20px 60px; font-family: -apple-system,BlinkMacSystemFont,sans-serif; color: #1f2937; overflow-y: auto; }
.gh { text-align: center; margin-bottom: 32px; }
.gh h1 { font-size: 24px; margin: 0 0 4px; color: #111827; }
.gh p { font-size: 14px; color: #6b7280; margin: 0; }
.gs { margin-bottom: 24px; }
.gs h2 { font-size: 15px; font-weight: 600; margin: 0 0 12px; color: #374151; }
.up-stat { font-size: 12px; color: #1d4ed8; font-weight: 400; }

/* Domain */
.dc { display: flex; gap: 12px; }
.dc-card { flex: 1; padding: 20px 16px; border: 2px solid #e5e7eb; border-radius: 10px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: all .15s; }
.dc-card:hover { border-color: #93c5fd; }
.dc-card.sel { border-color: #1d4ed8; background: #eff6ff; }
.dc-note { margin: 8px 2px 0; color: #6b7280; }
.dc-icon { font-size: 32px; }
.dc-title { font-size: 15px; font-weight: 600; }

/* Upload */
.up-zone { border: 2px dashed #d1d5db; border-radius: 10px; padding: 32px; text-align: center; cursor: pointer; transition: border-color .15s; }
.up-zone:hover { border-color: #1d4ed8; background: #f9fafb; }
.up-inner { pointer-events: none; }
.up-icon { font-size: 36px; }
.up-inner p { font-size: 14px; color: #374151; margin: 8px 0 4px; }
.up-inner small { font-size: 12px; color: #9ca3af; }
.fl { margin-top: 10px; }
.fl-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 4px; font-size: 13px; }
.fl-badge { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; color: #fff; font-size: 10px; font-weight: 700; flex-shrink: 0; }
.bpdf { background: #ef4444; } .bdoc { background: #3b82f6; } .bxls { background: #059669; } .bimg { background: #8b5cf6; } .bfile { background: #9ca3af; }
.fl-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fl-size { font-size: 11px; color: #9ca3af; flex-shrink: 0; }
.fl-del { border: none; background: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 2px 4px; }
.up-btns { display: flex; gap: 8px; margin-top: 10px; }
.ubtn { padding: 7px 14px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.ubtn:hover { background: #f3f4f6; }
.ubtn:disabled { opacity: .5; cursor: not-allowed; }
.ubtn-clear { color: #ef4444; border-color: #fca5a5; }

/* Generate */
.gen-row { display: flex; gap: 10px; }
.gbtn { flex: 1; padding: 14px; border: none; border-radius: 10px; background: #1d4ed8; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
.gbtn:disabled { background: #9ca3af; cursor: not-allowed; }
.gbtn:not(:disabled):hover { background: #1e40af; }
.gbtn-cancel { flex: 0 0 auto; padding: 14px 24px; background: #ef4444; }
.gbtn-cancel:hover { background: #dc2626 !important; }
.ghint { font-size: 12px; color: #f59e0b; margin: 8px 0 0; text-align: center; }

/* Progress */
.progress-section { background: #f9fafb; padding: 20px; border-radius: 10px; border: 1px solid #e5e7eb; }
.log-panel { margin-top: 12px; background: #1e1e2e; border-radius: 8px; overflow: hidden; max-height: 200px; }
.log-header { padding: 6px 12px; font-size: 12px; color: #a0a0b0; background: #2a2a3a; border-bottom: 1px solid #3a3a4a; }
.log-body { padding: 8px 12px; max-height: 160px; overflow-y: auto; font-family: 'Menlo', 'Consolas', monospace; font-size: 11px; line-height: 1.6; }
.log-line { color: #c0c0d0; }
.log-line.log-done { color: #4ade80; }
.log-line.log-running { color: #60a5fa; }
.missing-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.missing-card { background: #fff; border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.missing-card h3 { margin: 0 0 8px; font-size: 18px; }
.missing-hint { color: #666; font-size: 13px; margin-bottom: 16px; }
.missing-card-wide { max-width: 760px; max-height: 88vh; overflow-y: auto; }

/* 🔴 逐条填写进度：第 N / M 项 + 所在章节 + 细进度条 */
.missing-progress { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
.mp-count { font-size: 14px; color: #374151; }
.mp-count b { color: #1d4ed8; font-size: 16px; }
.mp-where { font-size: 12px; color: #6b7280; background: #f3f4f6; padding: 2px 8px; border-radius: 10px; }
.mp-bar { flex: 1; min-width: 120px; height: 4px; background: #eef2f7; border-radius: 2px; overflow: hidden; }
.mp-bar-fill { height: 100%; background: linear-gradient(90deg, #2e5bff, #6a3cff); transition: width .2s; }

.missing-field { display: flex; flex-direction: column; margin-bottom: 12px; }
.missing-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #374151; }
.missing-field label small { font-weight: 400; color: #999; }
/* 🔴 常驻字数备注 —— 不能只在超限时才报错（业主：限制字数要写备注） */
.char-note { font-weight: 400; color: #909399; font-size: 12px; margin-left: 6px; }
.missing-field input,
.missing-field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
}
/* 🔴 长文本用大文本框：一眼能看到整段字（单行 input 根本看不全） */
.missing-field textarea { resize: vertical; min-height: 120px; }
.missing-field input:focus,
.missing-field textarea:focus {
  outline: none;
  border-color: #1d4ed8;
  box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.1);
}
.missing-field input.input-error,
.missing-field textarea.input-error { border-color: #f56c6c; }
.req { color: #f56c6c; margin-left: 2px; }
.field-error { color: #f56c6c; font-size: 12px; margin-top: 3px; }
.field-usage { color: #909399; font-size: 12px; margin-top: 3px; }
.missing-actions { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
/* 🔴 人工复核面板：可滚动、分章节卡片、违规高亮 */
.missing-card { max-height: 85vh; overflow-y: auto; }
.missing-card::-webkit-scrollbar { width: 8px; }
.missing-card::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.missing-card::-webkit-scrollbar-track { background: #f1f5f9; }
.hr-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.hr-head strong { font-size: 14px; color: #111827; }
.hr-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #f59e0b; color: #fff; }
.hr-status.queued { background: #f59e0b; }
.hr-status.human_reviewed { background: #8b5cf6; }
.hr-status.approved, .hr-status.passed { background: #059669; }
.hr-retry { font-size: 11px; color: #9ca3af; }
.hr-violations { list-style: none; margin: 0 0 8px; padding: 0; }
.hr-violations li {
  font-size: 13px; color: #374151; padding: 4px 0 4px 0;
  border-bottom: 1px dashed #e5e7eb; display: flex; gap: 6px; align-items: baseline;
}
.hr-violations li:last-child { border-bottom: none; }
.sev { font-size: 11px; padding: 1px 6px; border-radius: 8px; white-space: nowrap; flex-shrink: 0; }
.sev.critical { background: #fee2e2; color: #dc2626; }
.sev.error { background: #ffedd5; color: #ea580c; }
.sev.warning { background: #fef3c7; color: #d97706; }
.disp { font-size: 11px; padding: 1px 6px; border-radius: 8px; background: #dbeafe; color: #1d4ed8; white-space: nowrap; flex-shrink: 0; }
.disp.human { background: #ede9fe; color: #7c3aed; }
.hr-actions { display: flex; flex-direction: column; gap: 8px; }
.hr-opinion {
  width: 100%; box-sizing: border-box; padding: 8px 12px;
  border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px;
  resize: vertical; font-family: inherit;
}
.hr-opinion:focus { outline: none; border-color: #1d4ed8; box-shadow: 0 0 0 2px rgba(29,78,216,0.1); }
.hr-opinion:disabled { background: #f3f4f6; color: #9ca3af; }
.hr-btns { display: flex; gap: 8px; flex-wrap: wrap; }
.hr-global { margin-top: 4px; display: flex; gap: 8px; justify-content: flex-end; }
.pbar-wrap { display: flex; align-items: center; gap: 10px; }
.pbar { flex: 1; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.pbar-fill { height: 100%; background: #1d4ed8; border-radius: 4px; transition: width .3s; }
.pbar-pct { font-size: 13px; font-weight: 600; color: #1d4ed8; min-width: 36px; }
.pmsg { font-size: 13px; color: #6b7280; margin: 10px 0 0; }
.ch-info { font-size: 13px; color: #1d4ed8; font-weight: 600; margin-left: 8px; }
.steps { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
.step { display: flex; align-items: center; gap: 4px; font-size: 11px; padding: 3px 8px; border-radius: 12px; background: #e5e7eb; color: #9ca3af; }
.step.done { background: #d1fae5; color: #059669; }
.step.active { background: #dbeafe; color: #1d4ed8; animation: pulse 1s infinite; }
.step-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

/* Download */
.dl-wrap { text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: center; }
.dlbtn { display: inline-block; padding: 10px 24px; background: #059669; color: #fff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; border: none; cursor: pointer; }
.dlbtn:hover { background: #047857; }
.dlbtn-new { background: #1d4ed8; }
.dlbtn-new:hover { background: #1e40af; }

/* 下载进度蒙层 */
.dl-mask { position: fixed; inset: 0; background: rgba(17,24,39,0.45); display: flex;
  align-items: center; justify-content: center; z-index: 2000; }
.dl-card { background: #fff; border-radius: 12px; padding: 24px 28px; width: 340px; text-align: center;
  box-shadow: 0 12px 40px rgba(0,0,0,0.25); }
.dl-spin { width: 32px; height: 32px; margin: 0 auto 12px; border: 3px solid #d1fae5;
  border-top-color: #059669; border-radius: 50%; animation: dl-spin 0.8s linear infinite; }
@keyframes dl-spin { to { transform: rotate(360deg); } }
.dl-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #111827; }
.dl-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
.dl-bar-fill { height: 100%; background: #059669; border-radius: 4px; transition: width .2s; }
.dl-bar-indet { animation: dl-pulse 1.2s ease-in-out infinite; }
@keyframes dl-pulse { 0%,100% { opacity: .35 } 50% { opacity: .9 } }
.dl-sub { margin: 8px 0 0; font-size: 13px; color: #059669; font-weight: 600; }
.dl-note { margin: 6px 0 0; font-size: 12px; color: #6b7280; }

/* ═══ ③ 选择报告人员 ═══ */
.pp-hint { text-align: left; margin-bottom: 4px; }
.pp-tools { display: flex; align-items: center; gap: 14px; margin: 10px 0; flex-wrap: wrap; }
.pp-tool { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: #374151; cursor: pointer; }
.pp-count { font-size: 12px; color: #6b7280; margin-left: auto; }
.pp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 8px; }
.pp-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #e5e7eb;
  border-radius: 6px; cursor: pointer; font-size: 13px; background: #fff; }
.pp-item:hover { border-color: #93c5fd; background: #f8fbff; }
.pp-item.sel { border-color: #2563eb; background: #eff6ff; }
.pp-name { font-weight: 600; color: #111827; min-width: 44px; }
.pp-meta { color: #6b7280; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-role { color: #1d4ed8; font-size: 12px; background: #eef2ff; border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
.pp-badge { color: #047857; font-size: 11px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
.pp-img { color: #92400e; font-size: 11px; }

/* 缺口清单（生成完成后提示，不进交付稿） */
.gap-panel { margin-top: 14px; border: 1px solid #f0c36d; background: #fffbf0; border-radius: 8px; padding: 10px 14px; text-align: left; }
.gap-panel summary { cursor: pointer; font-size: 14px; color: #8a5a00; }
.gap-list { margin: 10px 0 0; padding: 0; list-style: none; max-height: 320px; overflow: auto; }
.gap-item { display: flex; gap: 8px; padding: 6px 0; border-top: 1px dashed #f0d9a8; font-size: 13px; line-height: 1.6; flex-wrap: wrap; }
.gap-item.warn .gap-detail { color: #b42318; }
.gap-kind { font-size: 12px; color: #8a5a00; background: #fff3d6; border-radius: 4px; padding: 0 6px; flex-shrink: 0; }
.audit-bad { color: #b42318; }
.gap-ch { flex: 0 0 auto; font-weight: 600; color: #8a5a00; }
.gap-detail { flex: 1 1 auto; color: #5a4a2a; }
.gap-sentence { flex: 1 1 100%; color: #98a2b3; font-size: 12px; }
.gap-hint { margin: 10px 0 0; font-size: 12px; color: #98a2b3; }
</style>
