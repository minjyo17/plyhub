import { Client, type LeaderboardRecord, type Session } from '@heroiclabs/nakama-js'

export type GuestUser = { userId: string; displayName: string }
export type RankEntry = GuestUser & { rank: number; score: number }
export type Ranking = { records: RankEntry[]; myRecord: RankEntry | null }
export type ConnectionOptions = { url: string; serverKey: string }
type GuestStorage = Pick<Storage, 'getItem' | 'setItem'>

const LEADERBOARDS: Record<string, string> = { 'test-game': 'playhub-test', snake: 'playhub-snake' }
export const MAX_SCORE = 1_000_000_000

export function validateScore(score: number) {
  if (!Number.isSafeInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new Error('0부터 1,000,000,000까지의 정수를 입력해 주세요.')
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  if ('status' in error && typeof error.status === 'number') return error.status
  if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode
}

export function describeError(error: unknown): string {
  if (error instanceof GuestStorageError) return error.message
  const status = statusOf(error)
  if (status === 401) return '인증을 확인하지 못했습니다. 같은 게스트로 다시 연결해 주세요.'
  if (status === 403) return '요청 권한이 없습니다. 계정과 서버 설정을 확인해 주세요.'
  if (status === 404) return '리더보드를 찾을 수 없습니다. 백엔드 초기화 상태를 확인해 주세요.'
  if (status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
  return '서버에 연결하지 못했습니다. Docker와 Nakama 실행 상태를 확인한 뒤 다시 시도해 주세요.'
}

class GuestStorageError extends Error {}

function mapRecord(record: LeaderboardRecord): RankEntry {
  if (!record.owner_id || !Number.isSafeInteger(record.score) || !record.rank || record.rank < 1) {
    throw new Error('Invalid leaderboard record')
  }
  return {
    userId: record.owner_id,
    displayName: record.username || `guest_${record.owner_id.slice(0, 8)}`,
    rank: record.rank,
    score: record.score!,
  }
}

// One SDK instance per mounted browser view. No server-global sessions or stored JWTs.
export function createPlayHubSdk(options: ConnectionOptions, storage: GuestStorage) {
  const url = new URL(options.url)
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Nakama URL must be an HTTP(S) origin')
  }
  const client = new Client(options.serverKey, url.hostname, url.port || (url.protocol === 'https:' ? '443' : '80'), url.protocol === 'https:', 10000, false)
  const storageKey = `playhub.guest.v1:${url.origin}`
  let session: Session | null = null
  let deviceId: string | null = null

  function readDevice() {
    try {
      const id = storage.getItem(storageKey)
      if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        throw new Error('Invalid guest ID')
      }
      return id
    } catch {
      throw new GuestStorageError('게스트 정보를 읽지 못했습니다. 브라우저의 사이트 저장소 설정을 확인해 주세요.')
    }
  }

  function getDevice() {
    if (deviceId) return deviceId
    deviceId = readDevice()
    if (!deviceId) {
      const id = crypto.randomUUID()
      // Persist before creating a server account so a retry can reuse this identity.
      try { storage.setItem(storageKey, id) } catch {
        throw new GuestStorageError('게스트 정보를 저장하지 못했습니다. 사이트 저장소를 허용한 뒤 다시 시도해 주세요.')
      }
      deviceId = id
    }
    return deviceId
  }

  async function authenticate(create: boolean) {
    const id = getDevice()
    session = await client.authenticateDevice(id, create, `guest_${id.replaceAll('-', '').slice(0, 16)}`)
    return session
  }

  async function ensureSession() {
    if (!session) throw new Error('Login required')
    if (session.isexpired(Date.now() / 1000 + 60)) {
      if (!session.refresh_token || session.isrefreshexpired(Date.now() / 1000 + 60)) {
        return authenticate(false)
      }
      try { session = await client.sessionRefresh(session) } catch (error) {
        if (statusOf(error) !== 401) throw error
        return authenticate(false)
      }
    }
    return session
  }

  async function authenticated<T>(request: (active: Session) => Promise<T>): Promise<T> {
    const active = await ensureSession()
    try { return await request(active) } catch (error) {
      // Retry once only for rejected authentication. Never retry ambiguous network writes.
      if (statusOf(error) !== 401) throw error
      return request(await authenticate(false))
    }
  }

  function leaderboardFor(gameId: string) {
    const id = LEADERBOARDS[gameId]
    if (!id) throw new Error('Unknown game')
    return id
  }

  return {
    hasGuest: () => Boolean(readDevice()),
    async loginGuest(): Promise<GuestUser> {
      const active = await authenticate(true)
      if (!active.user_id) throw new Error('Missing user ID')
      return { userId: active.user_id, displayName: active.username || '게스트' }
    },
    async submitScore(gameId: string, score: number): Promise<void> {
      validateScore(score)
      const leaderboardId = leaderboardFor(gameId)
      await authenticated(active => client.writeLeaderboardRecord(active, leaderboardId, { score: String(score) }))
    },
    async getTop(gameId: string, limit = 10): Promise<Ranking> {
      const leaderboardId = leaderboardFor(gameId)
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid ranking limit')
      return authenticated(async active => {
        const result = await client.listLeaderboardRecords(active, leaderboardId, [active.user_id!], limit)
        const own = result.owner_records?.find(record => record.owner_id === active.user_id)
        return { records: (result.records || []).map(mapRecord), myRecord: own ? mapRecord(own) : null }
      })
    },
  }
}
