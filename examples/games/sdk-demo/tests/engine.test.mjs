import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, startGame, pauseGame, turn, tick, placeFood, tickDuration } from '../src/engine.js'

test('ready and paused games do not move; resume retains progress', () => {
  const game = createGame()
  const head = { ...game.snake[0] }
  tick(game)
  assert.deepEqual(game.snake[0], head)
  startGame(game); tick(game)
  assert.equal(game.snake[0].x, head.x + 1)
  pauseGame(game)
  const pausedHead = { ...game.snake[0] }
  tick(game); assert.deepEqual(game.snake[0], pausedHead)
  startGame(game); tick(game)
  assert.equal(game.snake[0].x, pausedHead.x + 1)
})

test('eating grows once, awards 10 points, and places food outside the body', () => {
  const game = createGame()
  game.food = { x: 11, y: 10 }
  startGame(game); tick(game, () => 0)
  assert.equal(game.score, 10)
  assert.equal(game.snake.length, 4)
  assert.ok(!game.snake.some(cell => cell.x === game.food.x && cell.y === game.food.y))
})

test('reverse direction is rejected; two queued turns occur on separate ticks', () => {
  const game = createGame()
  game.food = { x: 0, y: 0 }
  startGame(game)
  assert.equal(turn(game, 'left'), false)
  assert.equal(turn(game, 'up'), true)
  assert.equal(turn(game, 'down'), false)
  assert.equal(turn(game, 'left'), true)
  assert.equal(turn(game, 'down'), false)
  tick(game); assert.deepEqual(game.snake[0], { x: 10, y: 9 })
  tick(game); assert.deepEqual(game.snake[0], { x: 9, y: 9 })
})

test('wall collision ends exactly once and preserves the final score', () => {
  const game = createGame()
  game.snake = [{ x: 19, y: 10 }, { x: 18, y: 10 }, { x: 17, y: 10 }]
  game.score = 50
  startGame(game); tick(game)
  assert.equal(game.status, 'over'); assert.equal(game.reason, 'wall')
  const final = JSON.stringify(game)
  tick(game); assert.equal(JSON.stringify(game), final)
})

test('body collision ends play, but entering a departing tail is allowed', () => {
  const game = createGame()
  game.snake = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 }]
  game.food = { x: 0, y: 0 }
  startGame(game); tick(game)
  assert.equal(game.status, 'running')
  game.direction = 'down'; tick(game)
  assert.equal(game.status, 'running')
  game.snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }]
  game.direction = 'right'; tick(game)
  assert.equal(game.status, 'over'); assert.equal(game.reason, 'body')
})

test('filling the board wins without looping forever to place food', () => {
  const game = createGame(3)
  game.snake = [{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 }]
  game.food = { x: 2, y: 0 }
  startGame(game); tick(game)
  assert.equal(game.status, 'won'); assert.equal(game.food, null)
  assert.equal(game.snake.length, 9); assert.equal(game.score, 10)
})

test('food selection covers remaining spaces and speed is bounded', () => {
  assert.deepEqual(placeFood([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], 2), { x: 1, y: 1 })
  assert.equal(placeFood([{ x: 0, y: 0 }], 1), null)
  assert.equal(tickDuration(0), 165)
  assert.equal(tickDuration(50), 153)
  assert.equal(tickDuration(10000), 75)
})

test('a new game resets score, turns and status', () => {
  const previous = createGame()
  startGame(previous); turn(previous, 'up'); previous.score = 100
  const next = createGame()
  assert.equal(next.score, 0); assert.equal(next.status, 'ready')
  assert.deepEqual(next.turns, []); assert.equal(next.snake.length, 3)
})

test('small board starts with all body cells in bounds', () => {
  const game = createGame(3)
  assert.ok(game.snake.every(cell => cell.x >= 0 && cell.x < 3 && cell.y >= 0 && cell.y < 3))
  assert.throws(() => createGame(2))
})
