import type { GuestUser, Ranking } from './playhub'

const channel = 'playhub.sdk.v1'
type BridgeOptions = {
  host: Pick<Window, 'addEventListener' | 'removeEventListener'>
  frame: () => Window | null
  gameOrigin: string
  gameId: string
  user: GuestUser
  submitScore: (gameId: string, score: number) => Promise<void>
  getTop: (gameId: string, limit: number) => Promise<Ranking>
  onConnect?: () => void
  onSaved?: (score: number) => void
}
type Reply = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } }
const invalid = (message: string): Reply => ({ ok: false, error: { code: 'INVALID_ARGUMENT', message } })

// A bridge belongs to exactly one registered iframe and one signed-in user.
export function createGameBridge(options: BridgeOptions) {
  let activeClient: string | null = null
  let disposed = false
  const cache = new Map<string, { fingerprint: string; response: Promise<Reply>; done: boolean }>()
  async function receive(event: MessageEvent) {
    const target = options.frame()
    if (disposed || !target || event.source !== target || event.origin !== options.gameOrigin) return
    const data = event.data
    if (!data || data.channel !== channel || data.type !== 'request' || typeof data.id !== 'string' || typeof data.clientId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(data.id) || !/^[a-zA-Z0-9-]{1,80}$/.test(data.clientId)) return
    if (!['connect', 'submitScore', 'getTop'].includes(data.method)) return
    if (data.method === 'connect' && data.clientId !== activeClient) {
      activeClient = data.clientId
      cache.clear()
    }
    if (data.clientId !== activeClient) return
    const client = activeClient
    const payload = data.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
    if ((data.method === 'submitScore' && typeof payload.score !== 'number') || (data.method === 'getTop' && typeof payload.limit !== 'number')) return
    const fingerprint = JSON.stringify([data.method, data.method === 'submitScore' ? payload.score : data.method === 'getTop' ? payload.limit : null])
    function send(reply: Reply) {
      if (!disposed && client === activeClient && options.frame() === target) target!.postMessage({ channel, type: 'response', clientId: client, id: data.id, ...reply }, options.gameOrigin)
    }
    const existing = cache.get(data.id)
    if (existing) {
      if (existing.fingerprint !== fingerprint) { send(invalid('같은 요청 ID의 내용이 변경되었습니다.')); return }
      send(await existing.response); return
    }
    // Bound memory and outstanding backend work from an embedded game.
    if (cache.size >= 128) {
      for (const [key, entry] of cache) if (entry.done) cache.delete(key)
    }
    if ([...cache.values()].filter(entry => !entry.done).length >= 16) {
      send({ ok: false, error: { code: 'BUSY', message: '진행 중인 요청이 많습니다.' } }); return
    }
    async function execute(): Promise<Reply> {
      try {
        if (data.method === 'connect') {
          options.onConnect?.()
          return { ok: true, result: { user: { userId: options.user.userId, displayName: options.user.displayName }, gameId: options.gameId } }
        }
        if (data.method === 'submitScore') {
          if (!Number.isSafeInteger(payload.score) || payload.score < 0 || payload.score > 1_000_000_000) return invalid('점수 범위가 올바르지 않습니다.')
          await options.submitScore(options.gameId, payload.score)
          if (!disposed && activeClient === client) options.onSaved?.(payload.score)
          return { ok: true, result: { saved: true } }
        }
        if (!Number.isInteger(payload.limit) || payload.limit < 1 || payload.limit > 100) return invalid('랭킹 개수가 올바르지 않습니다.')
        return { ok: true, result: await options.getTop(options.gameId, payload.limit) }
      } catch {
        // Do not send internal SDK exceptions, server details, or tokens to games.
        return { ok: false, error: { code: 'BACKEND_UNAVAILABLE', message: '서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' } }
      }
    }
    const entry = { fingerprint, response: execute(), done: false }
    cache.set(data.id, entry)
    const reply = await entry.response
    entry.done = true
    send(reply)
  }
  options.host.addEventListener('message', receive)
  return () => {
    disposed = true; activeClient = null; cache.clear()
    options.host.removeEventListener('message', receive)
  }
}
