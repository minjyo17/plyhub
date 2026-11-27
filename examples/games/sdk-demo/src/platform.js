import { connectPlayHub } from '/sdk/playhub.js'

const embedded = window.parent !== window
// Deployment setting owned by the game developer. Never trust an arbitrary query origin.
const allowedPlatforms = new Set(['http://127.0.0.1:3317', 'http://localhost:3317', 'http://127.0.0.1:3000', 'http://localhost:3000', 'https://plyhub.vercel.app'])
const platformOrigin = new URLSearchParams(location.search).get('platformOrigin') || 'http://127.0.0.1:3317'
const status = document.querySelector('#platform-status')
const saveStatus = document.querySelector('#save-status')
const retry = document.querySelector('#platform-retry')
const refresh = document.querySelector('#ranking-refresh')
const rankingStatus = document.querySelector('#ranking-status')
const rankingList = document.querySelector('#ranking-list')
let sdk = null
let connecting = false
let saving = false
let loadingRanking = false
let rankingQueued = false
// BEST leaderboard: retain the highest unsaved score even across subsequent rounds.
let unsavedBest = null
let closing = false
function showRetry(label) { retry.textContent = label; retry.hidden = false }
async function loadRanking() {
  if (!sdk || closing) return
  if (loadingRanking) { rankingQueued = true; return }
  loadingRanking = true; refresh.disabled = true
  rankingStatus.textContent = '랭킹을 불러오는 중…'
  try {
    const { records, myRecord } = await sdk.getTop(5)
    rankingList.replaceChildren()
    for (const record of records) {
      const li = document.createElement('li')
      li.textContent = `${record.rank}위 · ${record.userId === sdk.user.userId ? '나' : record.displayName} · ${record.score}점`
      rankingList.append(li)
    }
    rankingStatus.textContent = myRecord ? `내 최고 ${myRecord.score}점 · ${myRecord.rank}위` : records.length ? '한 판을 마치고 기록에 도전하세요.' : '아직 기록이 없어요.'
  } catch {
    rankingStatus.textContent = '랭킹을 불러오지 못했어요. 새로고침해 주세요. 점수 저장 상태는 위 안내를 확인하세요.'
  } finally {
    loadingRanking = false; refresh.disabled = false
    if (rankingQueued) { rankingQueued = false; void loadRanking() }
  }
}
async function flushScore() {
  if (!sdk || saving || unsavedBest === null) return
  const score = unsavedBest
  unsavedBest = null; saving = true; retry.hidden = true
  saveStatus.textContent = `${score}점 저장 중…`
  let failed = false
  try {
    await sdk.submitScore(score)
    saveStatus.textContent = `${score}점 저장 완료 · 최고 기록 유지`
    void loadRanking()
  } catch {
    failed = true
    unsavedBest = Math.max(score, unsavedBest ?? 0)
    saveStatus.textContent = `저장 여부를 확인하지 못했어요. ${unsavedBest}점을 보관 중입니다. 페이지를 닫기 전에 재시도해 주세요.`
    showRetry('점수 저장 다시 시도')
  } finally {
    saving = false
    if (!failed && unsavedBest !== null) void flushScore()
  }
}
async function connect() {
  if (connecting || closing) return
  connecting = true; retry.hidden = true
  status.textContent = 'PlayHub에 연결하는 중…'
  try {
    if (!allowedPlatforms.has(platformOrigin)) throw new Error('Unregistered platform origin')
    sdk = await connectPlayHub({ platformOrigin })
    if (closing) { sdk.dispose(); return }
    status.textContent = '● PlayHub 연결됨 · 종료 후 자동 저장'
    refresh.hidden = false
    void loadRanking()
    void flushScore()
  } catch {
    if (closing) return
    status.textContent = 'PlayHub 연결 실패 · 게임은 계속할 수 있어요.'
    showRetry('PlayHub 다시 연결')
  } finally { connecting = false }
}
export function recordFinalScore(score) {
  if (!embedded) {
    saveStatus.textContent = `${score}점 · 연습 기록입니다. 서버에는 저장되지 않습니다.`
    return
  }
  unsavedBest = Math.max(score, unsavedBest ?? 0)
  if (saving) saveStatus.textContent = `저장 중… 다음 기록 ${unsavedBest}점도 보관 중입니다.`
  else if (!sdk) saveStatus.textContent = `${unsavedBest}점 보관 중 · PlayHub 연결 후 저장합니다. 페이지를 닫으면 사라집니다.`
  void flushScore()
}
retry.addEventListener('click', () => sdk ? void flushScore() : void connect())
refresh.addEventListener('click', () => void loadRanking())
window.addEventListener('pagehide', () => { closing = true; sdk?.dispose() })
window.addEventListener('pageshow', event => { if (event.persisted && embedded) { closing = false; sdk = null; void connect() } })
if (embedded) void connect()
else {
  status.textContent = '연습 모드 · 브라우저 기록만 저장'
  document.querySelector('#portal-link').hidden = false
  rankingStatus.textContent = 'PlayHub에서 열면 서버 랭킹에 도전할 수 있어요.'
}
