export const REPORT_CATEGORIES = [
  '通用',
  '社会稳定性风险评估',
  '复垦方案',
  '投标文件',
  '招标公告',
  '环境影响评价',
  '可行性研究',
  '安全评估',
  '格式规范',
  '其他',
]

// 报告领域：模板/知识文档都按它分类，与后端 domain 取值一致
export const REPORT_DOMAINS = [
  { value: 'stability', label: '稳评报告' },
  { value: 'reclamation', label: '复垦方案' },
  { value: 'bidding', label: '投标文件' },
]

// 地区：模板按地区分版（不同区县用官方发布的不同模板）。
// 只是候选，页面上允许直接输入新地区 —— 新地区模板随时可以入库。
export const TEMPLATE_REGIONS = [
  '淮安', '洪泽', '金湖', '盱眙', '涟水', '淮阴', '淮安区', '清江浦', '开发区',
]

export const PLACEHOLDER_TYPES = {
  text: '文本',
  number: '数字',
  date: '日期',
  location: '地点',
  table: '表格',
  image: '图片',
  choice: '选择',
}
