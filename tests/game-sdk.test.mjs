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
