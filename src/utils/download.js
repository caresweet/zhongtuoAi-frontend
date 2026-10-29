import { authFetch } from '@/api/report'

/**
 * 带鉴权的文件下载。
 *
 * 🔴 为什么不能用 `<a href="/api/v1/...">` / `window.open(url)`
 *     浏览器**直链不会带 `Authorization` 头** —— 后端一开鉴权，这些下载全部 401。
 *     正确做法是用 fetch 拿到 blob，造一个临时 objectURL 再点一下。
 *
 * 🔴 为什么要自己读流（2026-10-29）
 *     报告 docx 有几 MB、附件多的能到几十 MB，`await resp.blob()` 期间界面
 *     **一点动静都没有**，用户以为没下下来就又点一次。改成边读边报进度，
 *     调用方可以显示「正在下载 42%」，下完再提示文件名和大小。
 *
 * @param {string} url       后端下载地址
 * @param {string} [filename] 建议文件名；留空则用后端 `Content-Disposition`
 * @param {(pct:number|null, received:number, total:number) => void} [onProgress]
 *        pct 为 0~1；服务器没给 Content-Length 时为 null（只能显示已下载字节数）
 * @returns {Promise<{filename: string, size: number}>}
 */
export async function downloadFile(url, filename = '', onProgress) {
  const resp = await authFetch(url)
  if (!resp.ok) {
    throw new Error(`下载失败（${resp.status}）`)
  }

  const total = Number(resp.headers.get('Content-Length') || 0)
  const blob = await _readBlob(resp, total, onProgress)

  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const name = filename || _filenameFromHeader(resp) || '报告.docx'
  a.href = objectUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 立刻回收：blob 已经在浏览器下载队列里了，不会因此丢内容
  // （推迟一点回收，Safari 对刚 click 就 revoke 的 blob 偶尔会失败）
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
  return { filename: name, size: blob.size }
}

/** 流式读 body 并回调进度；不支持流式读的环境退回一次性 blob() */
async function _readBlob(resp, total, onProgress) {
  if (!resp.body || typeof resp.body.getReader !== 'function') {
    const blob = await resp.blob()
    onProgress?.(1, blob.size, blob.size)
    return blob
  }
  const reader = resp.body.getReader()
  const chunks = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      // nginx 压缩后 Content-Length 可能小于实际字节数，钳一下别让进度条超过 100%
      const pct = total > 0 ? Math.min(received / total, 0.99) : null
      onProgress?.(pct, received, total)
      // 让浏览器有机会重绘进度（下载大文件时读流是同步循环）
      await new Promise(r => setTimeout(r, 0))
    }
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }
  const blob = new Blob(chunks, { type: resp.headers.get('Content-Type') || 'application/octet-stream' })
  onProgress?.(1, blob.size, blob.size)
  return blob
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
