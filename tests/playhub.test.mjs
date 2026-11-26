import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@heroiclabs/nakama-js'
import { createPlayHubSdk } from '../app/lib/playhub.ts'

const options = { url: 'http://127.0.0.1:7350', serverKey: 'local-test' }
const memoryStorage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
const active = (overrides = {}) => ({ user_id: 'user-1', username: 'guest_1', refresh_token: 'test-refresh', isexpired: () => false, isrefreshexpired: () => false, ...overrides })
afterEach(() => mock.restoreAll())

test('failed login and a fresh SDK instance reuse the persisted guest ID', async () => {
  const storage = memoryStorage()
  const ids = []
  mock.method(Client.prototype, 'authenticateDevice', async id => {
    ids.push(id)
    if (ids.length === 1) throw { status: 503 }
    return active()
  })
  const first = createPlayHubSdk(options, storage)
  await assert.rejects(first.loginGuest())
  await first.loginGuest()
  const nextPage = createPlayHubSdk(options, storage)
  assert.equal(nextPage.hasGuest(), true)
  await nextPage.loginGuest()
  assert.equal(new Set(ids).size, 1)
  assert.match(ids[0], /^[0-9a-f-]{36}$/)
})

test('storage failure does not create an unrecoverable server account', async () => {
  const authenticate = mock.method(Client.prototype, 'authenticateDevice', async () => active())
  const sdk = createPlayHubSdk(options, { getItem: () => null, setItem: () => { throw new Error('Quota') } })
  await assert.rejects(sdk.loginGuest(), /저장하지 못했습니다/)
  assert.equal(authenticate.mock.callCount(), 0)
})

test('a rejected session is reauthenticated once with the same device and create=false', async () => {
  const auth = mock.method(Client.prototype, 'authenticateDevice', async () => active())
  const write = mock.method(Client.prototype, 'writeLeaderboardRecord', async () => { throw { status: 401 } })
  const sdk = createPlayHubSdk(options, memoryStorage())
  await sdk.loginGuest()
  await assert.rejects(sdk.submitScore('test-game', 55))
  assert.equal(write.mock.callCount(), 2)
  assert.equal(auth.mock.callCount(), 2)
  assert.equal(auth.mock.calls[0].arguments[0], auth.mock.calls[1].arguments[0])
  assert.equal(auth.mock.calls[1].arguments[1], false)
})

test('ambiguous network write failure is not automatically retried', async () => {
  mock.method(Client.prototype, 'authenticateDevice', async () => active())
  const write = mock.method(Client.prototype, 'writeLeaderboardRecord', async () => { throw new TypeError('Network failed') })
  const sdk = createPlayHubSdk(options, memoryStorage())
  await sdk.loginGuest()
  await assert.rejects(sdk.submitScore('test-game', 55))
  assert.equal(write.mock.callCount(), 1)
})

test('expiry refresh rejection falls back to the same guest before writing', async () => {
  const auth = mock.method(Client.prototype, 'authenticateDevice', async () => active({ isexpired: () => true }))
  const refresh = mock.method(Client.prototype, 'sessionRefresh', async () => { throw { status: 401 } })
  const write = mock.method(Client.prototype, 'writeLeaderboardRecord', async () => ({}))
  const sdk = createPlayHubSdk(options, memoryStorage())
  await sdk.loginGuest()
  await sdk.submitScore('test-game', 100)
  assert.equal(refresh.mock.callCount(), 1)
  assert.equal(auth.mock.calls[1].arguments[1], false)
  assert.equal(write.mock.calls[0].arguments[2].score, '100')
})

test('a session nearing expiry is refreshed before the request', async () => {
  const old = active({ isexpired: () => true })
  const fresh = active()
  mock.method(Client.prototype, 'authenticateDevice', async () => old)
  mock.method(Client.prototype, 'sessionRefresh', async () => fresh)
  const write = mock.method(Client.prototype, 'writeLeaderboardRecord', async () => ({}))
  const sdk = createPlayHubSdk(options, memoryStorage())
  await sdk.loginGuest()
  await sdk.submitScore('test-game', 0)
  assert.equal(write.mock.calls[0].arguments[0], fresh)
})

test('owner outside top 10 keeps the server-provided rank', async () => {
  mock.method(Client.prototype, 'authenticateDevice', async () => active())
  const list = mock.method(Client.prototype, 'listLeaderboardRecords', async () => ({
    records: [{ owner_id: 'other', username: 'other', score: 100, rank: 1 }],
    owner_records: [{ owner_id: 'user-1', username: 'guest_1', score: 5, rank: 22 }],
  }))
  const sdk = createPlayHubSdk(options, memoryStorage())
  await sdk.loginGuest()
  const result = await sdk.getTop('test-game')
  assert.deepEqual(list.mock.calls[0].arguments.slice(1), ['playhub-test', ['user-1'], 10])
  assert.equal(result.records[0].rank, 1)
  assert.equal(result.myRecord.rank, 22)
})

test('invalid scores and game IDs never reach the write API', async () => {
  mock.method(Client.prototype, 'authenticateDevice', async () => active())
  const write = mock.method(Client.prototype, 'writeLeaderboardRecord', async () => ({}))
  const sdk = createPlayHubSdk(options, memoryStorage())
  await sdk.loginGuest()
  for (const score of [-1, 1.5, NaN, Infinity, 1_000_000_001]) {
    await assert.rejects(sdk.submitScore('test-game', score))
  }
  await assert.rejects(sdk.submitScore('not-a-game', 1))
  assert.equal(write.mock.callCount(), 0)
})
