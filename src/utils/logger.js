/**
 * 前端日志 —— 除了打进浏览器控制台，还**批量上报到后端**。
 *
 * 🔴 为什么要有这个
 *   前端原先只有 28 处裸 `console.*`，**只进浏览器控制台**。用户一句「报错了」，
 *   我们这边什么都拿不到 —— 只能让他按 F12 截图。
 *   现在按键入 `logs/frontend.log`（与 `logs/backend.log` 同目录），
 *   排查时可以两边对时间线。
 *
 * 🔴 三条纪律
 *   1. **不落用户可见的界面** —— 日志只进控制台与文件，绝不渲染到页面上。
 *   2. **不能递归** —— 上报本身用原生 `fetch`，不走 axios 拦截器；
 *      且带 `_sending` 闸门，上报失败时不再触发新的上报。
 *   3. **有上限** —— 单条截断、队列封顶、按批发送；前端死循环刷日志不会把磁盘写满。
 */

const _ENDPOINT = '/api/v1/logs/frontend'
const _MAX_LINE = 1500
const _MAX_QUEUE = 200
const _FLUSH_MS = 5000

const _queue = []
let _timer = null
let _sending = false
let _installed = false

function _page() {
  try {
    return location.pathname + location.hash
  } catch {
    return ''
  }
}

function _str(v) {
  if (v instanceof Error) return `${v.name}: ${v.message}${v.stack ? ' | ' + v.stack.split('\n')[1] : ''}`
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function _enqueue(level, args) {
  if (_queue.length >= _MAX_QUEUE) return           // 满了就丢，绝不无限增长
  _queue.push({
    level,
    page: _page(),
    message: args.map(_str).join(' ').slice(0, _MAX_LINE),
  })
  if (!_timer) _timer = setTimeout(_flush, _FLUSH_MS)
}

async function _flush() {
  _timer = null
  if (_sending || !_queue.length) return
  // 🔴 未登录不上报：接口要求登录态，匿名请求只会拿到 401
  const token = localStorage.getItem('zhongtuo_token')
  if (!token) { _queue.length = 0; return }

  _sending = true
  const batch = _queue.splice(0, 50)
  try {
    // 用原生 fetch：走 axios 会在 401 时触发跳登录页，可能形成「上报失败→跳登录→再上报」
    await fetch(_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lines: batch }),
      keepalive: true,
    })
  } catch {
    // 上报失败就丢弃这一批 —— 日志上报绝不能反过来影响用户操作
  } finally {
    _sending = false
  }
}

/** 记一条**关键**日志（会进后端文件；普通 console.log 不会）。 */
export function logEvent(message, extra = {}) {
  _enqueue('event', [message, extra])
}

/** 安装全局钩子：把 console.error/warn 与未捕获异常都接进来。只装一次。 */
export function installLogger() {
  if (_installed) return
  _installed = true

  const _origError = console.error.bind(console)
  const _origWarn = console.warn.bind(console)
  console.error = (...a) => { _origError(...a); _enqueue('error', a) }
  console.warn = (...a) => { _origWarn(...a); _enqueue('warn', a) }

  window.addEventListener('error', (e) => {
    _enqueue('uncaught', [e.message, `${e.filename}:${e.lineno}`])
  })
  window.addEventListener('unhandledrejection', (e) => {
    _enqueue('promise', [e.reason])
  })
  // 关页面前尽量把剩下的送出去
  window.addEventListener('beforeunload', () => { _flush() })
}

export default { installLogger, logEvent }
