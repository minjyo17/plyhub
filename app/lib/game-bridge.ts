import type { GuestUser, Ranking, RoomHandle, RoomHandlers } from './playhub'

const channel = 'playhub.sdk.v1'
const methods = ['connect', 'submitScore', 'getTop', 'joinRoom', 'roomSend', 'leaveRoom']
// playhub.ts의 ROOM_CODE·MAX_ROOM_MESSAGE와 같은 값. 테스트가 이 파일만 불러오도록 값은 따로 둔다.
const ROOM_CODE = /^[A-Z0-9]{4,12}$/
const MAX_ROOM_MESSAGE = 4096
type BridgeOptions = {
  host: Pick<Window, 'addEventListener' | 'removeEventListener'>
  frame: () => Window | null
  gameOrigin: string
  gameId: string
  user: GuestUser
  submitScore: (gameId: string, score: number) => Promise<void>
  getTop: (gameId: string, limit: number) => Promise<Ranking>
  // 실시간 방. 없으면 게임의 방 요청은 UNSUPPORTED로 거절한다.
  joinRoom?: (gameId: string, code: string, handlers: RoomHandlers) => Promise<RoomHandle>
  onConnect?: () => void
  onSaved?: (score: number) => void
}
type Reply = { ok: true; result: unknown } | { ok: false; error: { code: string; message: string } }
const invalid = (message: string): Reply => ({ ok: false, error: { code: 'INVALID_ARGUMENT', message } })
const failure = (code: string, message: string): Reply => ({ ok: false, error: { code, message } })

function encodeRoomData(data: unknown) {
  if (!data || typeof data !== 'object') return null
  try {
    const text = JSON.stringify(data)
    return text && text.length <= MAX_ROOM_MESSAGE ? text : null
  } catch { return null }
}

// A bridge belongs to exactly one registered iframe and one signed-in user.
export function createGameBridge(options: BridgeOptions) {
  let activeClient: string | null = null
  let disposed = false
  const cache = new Map<string, { fingerprint: string; response: Promise<Reply>; done: boolean }>()
  // 게임 하나당 방은 하나. ticket으로 이미 닫은 방의 늦은 이벤트를 버린다.
  let room: RoomHandle | null = null
  let roomTicket: object | null = null

  function closeRoom() {
    const current = room
    room = null; roomTicket = null
    void current?.leave().catch(() => {})
  }

  function emit(client: string, event: string, payload: unknown) {
    const target = options.frame()
    if (!disposed && target && client === activeClient) target.postMessage({ channel, type: 'event', clientId: client, event, payload }, options.gameOrigin)
  }

  async function openRoom(client: string, code: string): Promise<Reply> {
    if (!options.joinRoom) return failure('UNSUPPORTED', '이 플랫폼은 실시간 방을 지원하지 않습니다.')
    closeRoom()
    const ticket = {}
    roomTicket = ticket
    const live = () => roomTicket === ticket && client === activeClient && !disposed
    const handle = await options.joinRoom(options.gameId, code, {
      onData: (data, from) => { if (live()) emit(client, 'roomData', { data, from }) },
      onPresence: (joined, left) => { if (live()) emit(client, 'roomPresence', { joined, left }) },
      onClose: () => {
        if (!live()) return
        room = null; roomTicket = null
        emit(client, 'roomClosed', {})
      },
    })
    // 기다리는 사이 게임이 다시 연결됐거나 다른 방을 열었으면 이 방은 바로 닫는다.
    if (!live()) { void handle.leave().catch(() => {}); return failure('DISCONNECTED', '방 연결이 취소되었습니다.') }
    room = handle
    return { ok: true, result: { code, others: handle.others } }
  }

  async function receive(event: MessageEvent) {
    const target = options.frame()
    if (disposed || !target || event.source !== target || event.origin !== options.gameOrigin) return
    const data = event.data
    if (!data || data.channel !== channel || data.type !== 'request' || typeof data.id !== 'string' || typeof data.clientId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(data.id) || !/^[a-zA-Z0-9-]{1,80}$/.test(data.clientId)) return
    if (!methods.includes(data.method)) return
    if (data.method === 'connect' && data.clientId !== activeClient) {
      activeClient = data.clientId
      cache.clear()
      closeRoom()
    }
    if (data.clientId !== activeClient) return
    const client = activeClient
    const payload = data.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return
    if ((data.method === 'submitScore' && typeof payload.score !== 'number') || (data.method === 'getTop' && typeof payload.limit !== 'number') || (data.method === 'joinRoom' && typeof payload.code !== 'string')) return
    const roomText = data.method === 'roomSend' ? encodeRoomData(payload.data) : null
    const fingerprint = JSON.stringify([data.method, data.method === 'submitScore' ? payload.score : data.method === 'getTop' ? payload.limit : data.method === 'joinRoom' ? payload.code : roomText])
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
        if (data.method === 'joinRoom') {
          if (!ROOM_CODE.test(payload.code)) return invalid('방 코드는 영문 대문자·숫자 4~12자입니다.')
          return await openRoom(client!, payload.code)
        }
        if (data.method === 'roomSend') {
          if (roomText === null) return invalid(`방 메시지는 ${MAX_ROOM_MESSAGE}자 이하의 JSON 객체여야 합니다.`)
          if (!room) return failure('NO_ROOM', '참여 중인 방이 없습니다.')
          await room.send(JSON.parse(roomText))
          return { ok: true, result: { sent: true } }
        }
        if (data.method === 'leaveRoom') {
          closeRoom()
          return { ok: true, result: { left: true } }
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
    closeRoom()
    options.host.removeEventListener('message', receive)
  }
}
