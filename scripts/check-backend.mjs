import assert from 'node:assert/strict'

// Infrastructure smoke check, independent of the frontend and future SDK.
// This reserved local test account and its record remain for persistence checks.
const verifyOnly = process.argv.includes('--verify')
const baseUrl = process.env.NAKAMA_URL || 'http://127.0.0.1:7350'
const serverKey = process.env.NAKAMA_SERVER_KEY || 'playhub-local-server-key'
const leaderboardId = 'playhub-test'
const expectedScore = 12345

async function request(path, { method = 'GET', body, authorization } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`)
  const text = await response.text()
  return text ? JSON.parse(text) : {}
}

try {
  await request('/healthcheck')
  const session = await request(`/v2/account/authenticate/device?create=${!verifyOnly}&username=infra_check`, {
    method: 'POST',
    body: { id: 'playhub-stage2-infrastructure-check-v1' },
    authorization: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
  })
  const authorization = `Bearer ${session.token}`
  const account = await request('/v2/account', { authorization })
  const userId = account.user.id

  if (!verifyOnly) {
    for (const score of [expectedScore, 100]) {
      await request(`/v2/leaderboard/${leaderboardId}`, {
        method: 'POST', body: { score: String(score) }, authorization,
      })
    }
  }

  const ranking = await request(`/v2/leaderboard/${leaderboardId}?limit=10&owner_ids=${encodeURIComponent(userId)}`, { authorization })
  const own = ranking.owner_records?.find(record => record.owner_id === userId)
  assert.ok(own, 'Infrastructure test record must exist')
  assert.equal(Number(own.score), expectedScore, 'Best score must survive lower submissions and restarts')
  assert.ok(Number(own.rank) >= 1, 'Rank computation must be enabled')
  console.log(`PASS: ${leaderboardId}, account=infra_check, best=${own.score}, rank=${own.rank}`)
  console.log(verifyOnly ? 'Existing account and record verified without writing a score.' : 'Authentication, score write, best-score retention, and ranked read verified.')
} catch (error) {
  console.error(`Backend check failed: ${error.message}`)
  process.exitCode = 1
}
