import { authFetch } from '@/api/report'

/**
 * 带鉴权的文件下载。
 *
 * 🔴 为什么不能用 `<a href="/api/v1/...">` / `window.open(url)`
 *     浏览器**直链不会带 `Authorization` 头** —— 后端一开鉴权，这些下载全部 401。
 *     正确做法是用 fetch 拿到 blob，造一个临时 objectURL 再点一下。
 *
 * @param {string} url       后端下载地址
 * @param {string} [filename] 建议文件名；留空则用后端 `Content-Disposition`
 */
export async function downloadFile(url, filename = '') {
  const resp = await authFetch(url)
  if (!resp.ok) {
    throw new Error(`下载失败（${resp.status}）`)
  }

  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename || _filenameFromHeader(resp) || ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 立刻回收：blob 已经在浏览器下载队列里了，不会因此丢内容
  URL.revokeObjectURL(objectUrl)
}

function _filenameFromHeader(resp) {
  // `Content-Disposition: attachment; filename="x.docx"`（可能是 RFC5987 编码）
  const cd = resp.headers.get('Content-Disposition') || ''
  const star = cd.match(/filename\*=UTF-8''([^;]+)/i)
  if (star) {
    try { return decodeURIComponent(star[1]) } catch { /* 落到下面 */ }
  }
  const plain = cd.match(/filename="?([^";]+)"?/i)
  return plain ? plain[1] : ''
}
