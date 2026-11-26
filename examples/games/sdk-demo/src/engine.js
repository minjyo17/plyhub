export const DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
})
const same = (a, b) => a.x === b.x && a.y === b.y

export function placeFood(snake, size, random = Math.random) {
  const occupied = new Set(snake.map(cell => `${cell.x},${cell.y}`))
  const empty = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!occupied.has(`${x},${y}`)) empty.push({ x, y })
    }
  }
  return empty.length ? empty[Math.min(empty.length - 1, Math.max(0, Math.floor(random() * empty.length)))] : null
}

export function createGame(size = 20, random = Math.random) {
  if (!Number.isInteger(size) || size < 3) throw new Error('Board size must be an integer of at least 3')
  const middle = Math.floor(size / 2)
  const startX = Math.max(2, middle)
  const snake = [{ x: startX, y: middle }, { x: startX - 1, y: middle }, { x: startX - 2, y: middle }]
  // A predictable first bite gives new players a moment to learn the controls.
  const food = startX + 3 < size ? { x: startX + 3, y: middle } : placeFood(snake, size, random)
  return { size, snake, direction: 'right', turns: [], food, score: 0, status: 'ready', reason: null }
}

export function startGame(game) {
  if (game.status === 'ready' || game.status === 'paused') game.status = 'running'
}
export function pauseGame(game) {
  if (game.status === 'running') game.status = 'paused'
}
export function turn(game, direction) {
  if (game.status !== 'running' || !DIRECTIONS[direction] || game.turns.length >= 2) return false
  const previous = DIRECTIONS[game.turns.at(-1) || game.direction]
  const next = DIRECTIONS[direction]
  if (previous.x === next.x && previous.y === next.y) return false
  if (previous.x + next.x === 0 && previous.y + next.y === 0) return false
  game.turns.push(direction)
  return true
}
export function tick(game, random = Math.random) {
  if (game.status !== 'running') return
  game.direction = game.turns.shift() || game.direction
  const direction = DIRECTIONS[game.direction]
  const next = { x: game.snake[0].x + direction.x, y: game.snake[0].y + direction.y }
  if (next.x < 0 || next.x >= game.size || next.y < 0 || next.y >= game.size) {
    game.status = 'over'; game.reason = 'wall'; return
  }
  const eating = game.food && same(next, game.food)
  // The tail moves away on a non-growing tick, so that cell is safe to enter.
  const body = eating ? game.snake : game.snake.slice(0, -1)
  if (body.some(cell => same(cell, next))) {
    game.status = 'over'; game.reason = 'body'; return
  }
  game.snake.unshift(next)
  if (eating) {
    game.score += 10
    game.food = placeFood(game.snake, game.size, random)
    if (!game.food) { game.status = 'won'; game.reason = 'complete' }
  } else game.snake.pop()
}
export const tickDuration = score => Math.max(75, 165 - Math.floor(score / 50) * 12)
