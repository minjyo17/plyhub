import { recordFinalScore } from './platform.js'
import { createGame, startGame, pauseGame, turn, tick, tickDuration, DIRECTIONS } from './engine.js'

const board = document.querySelector('#board')
const ctx = board.getContext('2d')
const scoreLabel = document.querySelector('#score')
const bestLabel = document.querySelector('#best')
const lengthLabel = document.querySelector('#length')
const primary = document.querySelector('#primary')
const pause = document.querySelector('#pause')
const restart = document.querySelector('#restart')
const overlay = document.querySelector('#overlay')
const title = document.querySelector('#overlay-title')
const kicker = document.querySelector('#overlay-kicker')
const description = document.querySelector('#overlay-description')
const announcement = document.querySelector('#announcement')
const bestKey = 'playhub.snake-demo.best.v1'
let best = 0
try {
  const stored = Number(localStorage.getItem(bestKey))
  if (Number.isSafeInteger(stored) && stored >= 0 && stored <= 3970) best = stored
} catch { /* Storage is optional: gameplay still works without it. */ }
let game = createGame()
let lastTime = 0
let elapsed = 0
let frame = null
const format = number => String(number).padStart(3, '0')

function roundedCell(x, y, size, inset, radius) {
  ctx.beginPath()
  ctx.roundRect(x * size + inset, y * size + inset, size - inset * 2, size - inset * 2, radius)
}

function draw() {
  const size = board.width / game.size
  ctx.clearRect(0, 0, board.width, board.height)
  ctx.fillStyle = '#142326'
  ctx.fillRect(0, 0, board.width, board.height)
  for (let y = 0; y < game.size; y++) {
    for (let x = 0; x < game.size; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#18292b' : '#162629'
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2)
    }
  }
  if (game.food) {
    const x = (game.food.x + .5) * size, y = (game.food.y + .5) * size
    ctx.shadowColor = '#f5a85b'; ctx.shadowBlur = size * .65
    ctx.fillStyle = '#f5a85b'; ctx.beginPath(); ctx.arc(x, y, size * .31, 0, Math.PI * 2); ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffd6a1'; ctx.beginPath(); ctx.arc(x - size * .08, y - size * .09, size * .08, 0, Math.PI * 2); ctx.fill()
  }
  game.snake.forEach((cell, index) => {
    ctx.fillStyle = index === 0 ? '#cef99c' : index % 2 ? '#a6da78' : '#b7e987'
    roundedCell(cell.x, cell.y, size, 2, size * .23); ctx.fill()
  })
  const head = game.snake[0], direction = DIRECTIONS[game.direction]
  const perpendicular = { x: -direction.y, y: direction.x }
  ctx.fillStyle = '#253b27'
  for (const side of [-1, 1]) {
    const x = (head.x + .5 + direction.x * .18 + perpendicular.x * .18 * side) * size
    const y = (head.y + .5 + direction.y * .18 + perpendicular.y * .18 * side) * size
    ctx.beginPath(); ctx.arc(x, y, size * .055, 0, Math.PI * 2); ctx.fill()
  }
}

function updateUi(announce = false) {
  if (game.score > best) {
    best = game.score
    try { localStorage.setItem(bestKey, String(best)) } catch { /* Optional local record. */ }
  }
  scoreLabel.textContent = format(game.score)
  bestLabel.textContent = format(best)
  lengthLabel.textContent = String(game.snake.length).padStart(2, '0')
  const running = game.status === 'running'
  overlay.hidden = running
  primary.disabled = running
  primary.textContent = game.status === 'ready' ? '시작하기 ↗' : running ? '플레이 중' : game.status === 'paused' ? '계속하기 →' : '다시하기 ↻'
  pause.disabled = !running
  restart.disabled = game.status === 'ready'
  document.querySelectorAll('[data-direction]').forEach(button => { button.disabled = !running })
  if (game.status === 'ready') {
    kicker.textContent = 'READY WHEN YOU ARE'; title.textContent = '첫 한 입을 향해.'; description.textContent = '시작하기를 누르면 뱀이 움직여요.'
  } else if (game.status === 'paused') {
    kicker.textContent = 'TAKE A BREATH'; title.textContent = '잠깐 쉬어가요.'; description.textContent = '계속하기 또는 Space로 이어서 플레이하세요.'
  } else if (game.status === 'over' || game.status === 'won') {
    kicker.textContent = game.status === 'won' ? 'GARDEN COMPLETE' : 'ONE MORE ROUND?'
    title.textContent = game.status === 'won' ? '정원을 가득 채웠어요!' : '이번 한 판, ' + game.score + '점.'
    description.textContent = game.reason === 'wall' ? '벽에 닿았어요. 다음에는 조금 일찍 꺾어봐요.' : game.reason === 'body' ? '내 몸에 닿았어요. 조금 더 넓게 돌아봐요.' : '모든 칸을 채웠습니다. 멋진 플레이예요!'
  }
  if (announce) announcement.textContent = running ? '게임 시작. 방향키로 이동하세요.' : `${title.textContent} ${description.textContent}`
  draw()
}

function stopLoop() {
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null; elapsed = 0; lastTime = 0
}
function loop(now) {
  if (game.status !== 'running') { frame = null; return }
  if (lastTime) elapsed += Math.min(now - lastTime, 250)
  lastTime = now
  while (elapsed >= tickDuration(game.score) && game.status === 'running') {
    elapsed -= tickDuration(game.score)
    const previousScore = game.score
    tick(game)
    if (game.status === 'over' || game.status === 'won') recordFinalScore(game.score)
    if (game.score !== previousScore || game.status !== 'running') updateUi(game.status !== 'running')
    else draw()
  }
  if (game.status === 'running') frame = requestAnimationFrame(loop)
  else { frame = null; elapsed = 0; lastTime = 0 }
}
function play(fresh = false) {
  stopLoop()
  if (fresh || game.status === 'over' || game.status === 'won') game = createGame()
  startGame(game)
  updateUi(true)
  if (window.matchMedia('(max-width: 850px)').matches) {
    document.querySelector('.game').scrollIntoView({ block: 'start' })
  }
  board.focus({ preventScroll: true })
  frame = requestAnimationFrame(loop)
}
function suspend() {
  if (game.status !== 'running') return
  pauseGame(game); stopLoop(); updateUi(true)
}
primary.addEventListener('click', () => play())
restart.addEventListener('click', () => play(true))
pause.addEventListener('click', suspend)
const keys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' }
window.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const direction = keys[event.key] || keys[event.key.toLowerCase()]
  if (direction && game.status === 'running') { event.preventDefault(); turn(game, direction); return }
  if ((event.code === 'Space' || event.key === 'Escape') && !event.repeat) {
    // Let native button Space activation work; canvas/body keys pause and resume.
    if (event.code === 'Space' && event.target.closest('button, a')) return
    if (game.status === 'running') { event.preventDefault(); suspend() }
    else if (game.status === 'paused' && event.code === 'Space') { event.preventDefault(); play() }
  }
})
document.querySelectorAll('[data-direction]').forEach(button => {
  button.addEventListener('click', () => { turn(game, button.dataset.direction); board.focus({ preventScroll: true }) })
})
window.addEventListener('blur', suspend)
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend() })
updateUi()
