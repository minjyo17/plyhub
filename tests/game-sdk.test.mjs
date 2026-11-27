import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameBridge } from '../app/lib/game-bridge.ts'
import { connectPlayHub } from '../packages/game-sdk/index.js'

const origin = 'http://game.example'
const portal = 'http://portal.example'
const user = { userId: 'player-1', displayName: 'Guest' }
const channel = 'playhub.sdk.v1'
const envelope = (method, payload = {}, id = method, clientId = 'client-1') => ({ channel, type: 'request', id, clientId, method, payload })
function setup(overrides = {}) {
  let listener
  const replies = []
  const writes = []
  const reads = []
  const target = { postMessage: (data, origin) => replies.push({ data, origin }) }
  const dispose = createGameBridge({
    host: { addEventListener: (_, fn) => { listener = fn }, removeEventListener: () => { listener = null } },
    frame: () => target, gameOrigin: origin, gameId: 'snake', user,
    submitScore: async (...args) => { writes.push(args) },
    getTop: async (...args) => { reads.push(args); return { records: [], myRecord: null } },
    ...overrides,
  })
  const send = (data, extra = {}) => listener?.({ data, source: target, origin, ...extra })
  return { replies, writes, reads, target, dispose, send }
}

test('bridge rejects foreign origins, sibling windows, unconnected clients and unsupported methods', async () => {
  const h = setup()
  await h.send(envelope('connect'), { origin: 'http://evil.example' })
  await h.send(envelope('connect'), { source: {} })
  await h.send(envelope('submitScore', { score: 10 }))
  await h.send(envelope('deleteAccount'))
  assert.equal(h.replies.length, 0); assert.equal(h.writes.length, 0)
  await h.send(envelope('connect'))
  assert.deepEqual(h.replies[0], { data: { channel, type: 'response', id: 'connect', clientId: 'client-1', ok: true, result: { gameId: 'snake', user } }, origin })
  h.dispose()
})

test('bridge binds writes and reads to the registered game, validates input, deduplicates writes', async () => {
  const h = setup()
  await h.send(envelope('connect'))
  await Promise.all([h.send(envelope('submitScore', { score: 10, gameId: 'test-game' })), h.send(envelope('submitScore', { score: 10 }))])
  assert.deepEqual(h.writes, [['snake', 10]])
  await h.send(envelope('submitScore', { score: 20 }))
  assert.equal(h.replies.at(-1).data.error.code, 'INVALID_ARGUMENT')
  await h.send(envelope('submitScore', { score: -1 }, 'negative'))
  await h.send(envelope('submitScore', { score: 1.5 }, 'decimal'))
  await h.send(envelope('submitScore', { score: 1e9 + 1 }, 'large'))
  assert.equal(h.writes.length, 1)
  await h.send(envelope('getTop', { limit: 10, gameId: 'test-game' }))
  await h.send(envelope('getTop', { limit: 101 }, 'invalid-limit'))
  assert.deepEqual(h.reads, [['snake', 10]])
  h.dispose()
})

test('late responses are discarded on iframe reconnection or bridge disposal', async () => {
  let finish
  const h = setup({ submitScore: () => new Promise(resolve => { finish = resolve }) })
  await h.send(envelope('connect'))
  const old = h.send(envelope('submitScore', { score: 10 }))
  await h.send(envelope('connect', {}, 'new-connect', 'client-2'))
  finish(); await old
  assert.equal(h.replies.length, 2)
  const newer = h.send(envelope('submitScore', { score: 20 }, 'new-score', 'client-2'))
  h.dispose(); finish(); await newer
  assert.equal(h.replies.length, 2)
})

test('backend errors are sanitized and caller can explicitly retry with a fresh request', async () => {
  let calls = 0
  const h = setup({ submitScore: async () => { if (++calls === 1) throw new Error('secret token') } })
  await h.send(envelope('connect'))
  await h.send(envelope('submitScore', { score: 10 }))
  assert.equal(h.replies.at(-1).data.error.code, 'BACKEND_UNAVAILABLE')
  assert.ok(!JSON.stringify(h.replies).includes('secret'))
  await h.send(envelope('submitScore', { score: 10 }, 'retry'))
  assert.equal(h.replies.at(-1).data.ok, true)
  h.dispose()
})

function browserHarness(onSend) {
  const previous = globalThis.window
  const handlers = new Set()
  const sent = []
  const parent = { postMessage(data, targetOrigin) { sent.push({ data, targetOrigin }); onSend?.(data) } }
  const fake = { parent, addEventListener: (_, fn) => handlers.add(fn), removeEventListener: (_, fn) => handlers.delete(fn) }
  globalThis.window = fake
  function respond(request, result, extra = {}) {
    for (const fn of handlers) fn({ origin: portal, source: parent, data: { channel, type: 'response', id: request.id, clientId: request.clientId, ok: true, result }, ...extra })
  }
  return { sent, respond, handlers, restore() { globalThis.window = previous } }
}
async function connected(h) {
  const connecting = connectPlayHub({ platformOrigin: portal, timeoutMs: 100 })
  h.respond(h.sent[0].data, { gameId: 'snake', user })
  return connecting
}
test('public SDK ignores forged source/origin/correlation, then validates and resolves real responses', async () => {
  const h = browserHarness()
  let sdk
  try {
    sdk = await connected(h)
    const promise = sdk.submitScore(10)
    const request = h.sent.at(-1).data
    h.respond(request, { saved: true }, { origin: 'http://evil.example' })
    h.respond(request, { saved: true }, { source: {} })
    h.respond({ ...request, id: 'wrong-id' }, { saved: true })
    let settled = false
    promise.then(() => { settled = true })
    await Promise.resolve()
    assert.equal(settled, false)
    h.respond(request, { saved: true })
    await promise
    assert.ok(h.sent.every(item => item.targetOrigin === portal))
    const before = h.sent.length
    await assert.rejects(sdk.submitScore(-1), { code: 'INVALID_ARGUMENT' })
    await assert.rejects(sdk.getTop(101), { code: 'INVALID_ARGUMENT' })
    assert.equal(h.sent.length, before)
    const ranking = sdk.getTop(10)
    h.respond(h.sent.at(-1).data, { records: [], myRecord: null })
    assert.deepEqual(await ranking, { records: [], myRecord: null })
  } finally { sdk?.dispose(); h.restore() }
})

test('public SDK times out without retrying writes, and dispose rejects pending requests', async () => {
  const h = browserHarness()
  let sdk
  try {
    sdk = await connected(h)
    await assert.rejects(sdk.submitScore(10), { code: 'TIMEOUT' })
    assert.equal(h.sent.filter(item => item.data.method === 'submitScore').length, 1)
    const waiting = sdk.getTop()
    sdk.dispose()
    await assert.rejects(waiting, { code: 'DISCONNECTED' })
    await assert.rejects(sdk.submitScore(1), { code: 'DISCONNECTED' })
    assert.equal(h.handlers.size, 0)
  } finally { sdk?.dispose(); h.restore() }
})

test('failed handshake cleans up listener, and SDK rejects malformed ranking data', async () => {
  const h = browserHarness()
  let sdk
  try {
    await assert.rejects(connectPlayHub({ platformOrigin: portal, timeoutMs: 100 }), { code: 'TIMEOUT' })
    assert.equal(h.handlers.size, 0)
    h.sent.length = 0
    sdk = await connected(h)
    const pending = sdk.getTop()
    h.respond(h.sent.at(-1).data, { records: [{ token: 'not a rank' }], myRecord: null })
    await assert.rejects(pending, { code: 'INVALID_RESPONSE' })
  } finally { sdk?.dispose(); h.restore() }
})

test('standalone mode and wildcard parent origins are rejected', async () => {
  const previous = globalThis.window
  const fake = {}; fake.parent = fake; globalThis.window = fake
  try {
    await assert.rejects(connectPlayHub({ platformOrigin: portal }), { code: 'NOT_EMBEDDED' })
    await assert.rejects(connectPlayHub({ platformOrigin: '*' }), { code: 'INVALID_ORIGIN' })
  } finally { globalThis.window = previous }
})

// Vue's shared authentication state can wrap the user in a reactive Proxy.
// Only plain public fields may cross the iframe structured-clone boundary.
test('bridge connection response is cloneable even when shared auth user is a Proxy', async () => {
  const h = setup({ user: new Proxy(user, {}) })
  await h.send(envelope('connect'))
  assert.deepEqual(structuredClone(h.replies[0].data).result, { user, gameId: 'snake' })
  h.dispose()
})

// 실시간 방: 포털은 게임 ID로 방을 나누고, 이벤트는 현재 연결에만 보내고, 재연결·종료 때 방을 닫는다.
function fakeRooms() {
  const rooms = []
  const joinRoom = async (gameId, code, handlers) => {
    const room = { gameId, code, handlers, sent: [], left: false }
    rooms.push(room)
    return { others: [{ userId: 'friend', displayName: 'Friend' }], send: async data => { room.sent.push(data) }, leave: async () => { room.left = true } }
  }
  return { rooms, joinRoom }
}

test('bridge opens rooms scoped to the registered game, relays events and closes rooms on reconnect/dispose', async () => {
  const fake = fakeRooms()
  const h = setup({ joinRoom: fake.joinRoom })
  await h.send(envelope('connect'))
  await h.send(envelope('roomSend', { data: { a: 1 } }, 'early'))
  assert.equal(h.replies.at(-1).data.error.code, 'NO_ROOM')
  await h.send(envelope('joinRoom', { code: 'bad code' }, 'bad'))
  assert.equal(h.replies.at(-1).data.error.code, 'INVALID_ARGUMENT')
  await h.send(envelope('joinRoom', { code: 'K7Q2X9', gameId: 'other' }, 'join'))
  assert.deepEqual(h.replies.at(-1).data.result, { code: 'K7Q2X9', others: [{ userId: 'friend', displayName: 'Friend' }] })
  assert.equal(fake.rooms[0].gameId, 'snake')
  await h.send(envelope('roomSend', { data: { t: 'throw', angle: 45 } }, 'send'))
  assert.deepEqual(fake.rooms[0].sent, [{ t: 'throw', angle: 45 }])
  await h.send(envelope('roomSend', { data: 'not an object' }, 'string'))
  await h.send(envelope('roomSend', { data: { big: 'x'.repeat(5000) } }, 'big'))
  assert.equal(h.replies.at(-1).data.error.code, 'INVALID_ARGUMENT')
  assert.equal(fake.rooms[0].sent.length, 1)
  fake.rooms[0].handlers.onData({ hi: 1 }, { userId: 'friend', displayName: 'Friend' })
  assert.deepEqual(h.replies.at(-1).data, { channel, type: 'event', clientId: 'client-1', event: 'roomData', payload: { data: { hi: 1 }, from: { userId: 'friend', displayName: 'Friend' } } })
  // 게임이 다시 연결되면 이전 방을 나가고, 그 방의 늦은 이벤트는 버린다.
  await h.send(envelope('connect', {}, 'reconnect', 'client-2'))
  assert.equal(fake.rooms[0].left, true)
  const count = h.replies.length
  fake.rooms[0].handlers.onPresence([], [{ userId: 'friend', displayName: 'Friend' }])
  assert.equal(h.replies.length, count)
  await h.send(envelope('joinRoom', { code: 'ABCD' }, 'join-2', 'client-2'))
  h.dispose()
  assert.equal(fake.rooms[1].left, true)
})

test('bridge rejects rooms when the platform does not support them', async () => {
  const h = setup()
  await h.send(envelope('connect'))
  await h.send(envelope('joinRoom', { code: 'ABCD' }))
  assert.equal(h.replies.at(-1).data.error.code, 'UNSUPPORTED')
  h.dispose()
})

test('public SDK room tracks players, delivers validated messages and closes once', async () => {
  const h = browserHarness()
  let sdk
  try {
    sdk = await connected(h)
    await assert.rejects(sdk.joinRoom('nope'), { code: 'INVALID_ARGUMENT' })
    const joining = sdk.joinRoom('K7Q2X9')
    const request = h.sent.at(-1).data
    assert.deepEqual(request.payload, { code: 'K7Q2X9' })
    h.respond(request, { code: 'K7Q2X9', others: [] })
    const room = await joining
    const messages = [], changes = []
    let closes = 0
    room.onMessage((data, from) => messages.push([data, from.userId]))
    room.onPlayers(change => changes.push(change))
    room.onClose(() => closes++)
    const event = (name, payload, extra = {}) => { for (const fn of h.handlers) fn({ origin: portal, source: h.sent[0] && globalThis.window.parent, data: { channel, type: 'event', clientId: request.clientId, event: name, payload }, ...extra }) }
    event('roomPresence', { joined: [{ userId: 'friend', displayName: 'Friend' }], left: [] })
    assert.deepEqual(room.others, [{ userId: 'friend', displayName: 'Friend' }])
    event('roomData', { data: { t: 'aim' }, from: { userId: 'friend', displayName: 'Friend' } })
    event('roomData', { data: { t: 'forged' }, from: { userId: 'friend', displayName: 'Friend' } }, { origin: 'http://evil.example' })
    event('roomData', { data: { t: 'bad' }, from: { nope: true } })
    assert.deepEqual(messages, [[{ t: 'aim' }, 'friend']])
    await assert.rejects(room.send('text'), { code: 'INVALID_ARGUMENT' })
    const sending = room.send({ t: 'throw' })
    h.respond(h.sent.at(-1).data, { sent: true })
    await sending
    event('roomPresence', { joined: [], left: [{ userId: 'friend', displayName: 'Friend' }] })
    assert.deepEqual(room.others, [])
    assert.equal(changes.length, 2)
    event('roomClosed', {})
    event('roomClosed', {})
    assert.equal(closes, 1)
    assert.equal(room.closed, true)
    await assert.rejects(room.send({ t: 'late' }), { code: 'NO_ROOM' })
  } finally { sdk?.dispose(); h.restore() }
})

test('public SDK keeps room events that arrive before the join response or before listeners', async () => {
  const h = browserHarness()
  let sdk
  try {
    sdk = await connected(h)
    const joining = sdk.joinRoom('ABCD')
    const request = h.sent.at(-1).data
    for (const fn of h.handlers) fn({ origin: portal, source: globalThis.window.parent, data: { channel, type: 'event', clientId: request.clientId, event: 'roomData', payload: { data: { t: 'start' }, from: { userId: 'host', displayName: 'Host' } } } })
    h.respond(request, { code: 'ABCD', others: [{ userId: 'host', displayName: 'Host' }] })
    const room = await joining
    const got = []
    room.onMessage(data => got.push(data))
    await Promise.resolve()
    assert.deepEqual(got, [{ t: 'start' }])
  } finally { sdk?.dispose(); h.restore() }
})
