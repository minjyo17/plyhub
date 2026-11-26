// Browser-only public SDK. No Nakama dependency or authentication credentials.
const channel = 'playhub.sdk.v1'
const maxScore = 1_000_000_000
export class PlayHubError extends Error {
  constructor(code, message) { super(message); this.name = 'PlayHubError'; this.code = code }
}
const fail = (code, message) => new PlayHubError(code, message)
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value)
const validUser = value => isRecord(value) && typeof value.userId === 'string' && typeof value.displayName === 'string'
const validRank = value => validUser(value) && Number.isSafeInteger(value.rank) && value.rank > 0 && Number.isSafeInteger(value.score) && value.score >= 0 && value.score <= maxScore

export async function connectPlayHub({ platformOrigin, timeoutMs = 15000 } = {}) {
  let origin
  try { origin = new URL(platformOrigin) } catch { throw fail('INVALID_ORIGIN', 'platformOrigin에는 정확한 HTTP(S) 출처를 지정하세요.') }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== platformOrigin) throw fail('INVALID_ORIGIN', 'platformOrigin에는 정확한 HTTP(S) 출처를 지정하세요.')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) throw fail('INVALID_ARGUMENT', 'timeoutMs는 100~60000이어야 합니다.')
  if (window.parent === window) throw fail('NOT_EMBEDDED', 'PlayHub 안에서 게임을 실행해 주세요.')
  const host = window.parent
  const clientId = crypto.randomUUID()
  const pending = new Map()
  let disposed = false
  function receive(event) {
    if (event.source !== host || event.origin !== platformOrigin) return
    const data = event.data
    if (!isRecord(data) || data.channel !== channel || data.type !== 'response' || data.clientId !== clientId || typeof data.id !== 'string') return
    const item = pending.get(data.id)
    if (!item) return
    if (data.ok !== true && !(data.ok === false && isRecord(data.error) && typeof data.error.code === 'string' && typeof data.error.message === 'string')) return
    clearTimeout(item.timer); clearInterval(item.retry); pending.delete(data.id)
    if (data.ok) item.resolve(data.result)
    else item.reject(fail(data.error.code, data.error.message))
  }
  window.addEventListener('message', receive)
  function dispose() {
    if (disposed) return
    disposed = true
    window.removeEventListener('message', receive)
    for (const item of pending.values()) {
      clearTimeout(item.timer); clearInterval(item.retry)
      item.reject(fail('DISCONNECTED', 'SDK 연결이 종료되었습니다.'))
    }
    pending.clear()
  }
  function request(method, payload = {}) {
    if (disposed) return Promise.reject(fail('DISCONNECTED', 'SDK 연결이 종료되었습니다.'))
    if (pending.size >= 16) return Promise.reject(fail('BUSY', '진행 중인 요청이 많습니다.'))
    const id = crypto.randomUUID()
    const envelope = { channel, type: 'request', clientId, id, method, payload }
    return new Promise((resolve, reject) => {
      const item = { resolve, reject, timer: null, retry: null }
      item.timer = setTimeout(() => {
        clearInterval(item.retry); pending.delete(id)
        reject(fail('TIMEOUT', '응답을 확인하지 못했습니다. 연결을 확인한 뒤 재시도해 주세요.'))
      }, timeoutMs)
      pending.set(id, item)
      const send = () => {
        try { host.postMessage(envelope, platformOrigin) }
        catch { clearTimeout(item.timer); clearInterval(item.retry); pending.delete(id); reject(fail('DISCONNECTED', '플랫폼에 요청을 전달하지 못했습니다.')) }
      }
      // Retry only the read-only handshake if the parent listener isn't mounted yet.
      // Score writes are never retried automatically.
      if (method === 'connect') item.retry = setInterval(send, 500)
      send()
    })
  }
  let connection
  try {
    connection = await request('connect')
    if (!isRecord(connection) || !validUser(connection.user) || typeof connection.gameId !== 'string') throw fail('INVALID_RESPONSE', '잘못된 연결 응답입니다.')
  } catch (error) { dispose(); throw error }
  return {
    user: Object.freeze({ ...connection.user }),
    gameId: connection.gameId,
    async submitScore(score) {
      if (!Number.isSafeInteger(score) || score < 0 || score > maxScore) throw fail('INVALID_ARGUMENT', '점수는 0~1,000,000,000의 정수여야 합니다.')
      const result = await request('submitScore', { score })
      if (!isRecord(result) || result.saved !== true) throw fail('INVALID_RESPONSE', '점수 저장 응답을 확인하지 못했습니다.')
    },
    async getTop(limit = 10) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw fail('INVALID_ARGUMENT', 'limit은 1~100의 정수여야 합니다.')
      const result = await request('getTop', { limit })
      if (!isRecord(result) || !Array.isArray(result.records) || result.records.length > limit || !result.records.every(validRank) || (result.myRecord !== null && !validRank(result.myRecord))) throw fail('INVALID_RESPONSE', '잘못된 랭킹 응답입니다.')
      return result
    },
    dispose,
  }
}
