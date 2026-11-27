// 포털과 examples/games/* 게임 서버를 한 터미널에서 같이 띄운다.
//   npm run dev:all
// - 게임은 examples/games 아래 package.json에 dev 스크립트가 있는 폴더를 자동으로 찾는다.
// - 게임 폴더에 node_modules가 없으면 먼저 npm ci(또는 npm install)를 한다.
// - Ctrl+C 한 번이면 전부 같이 꺼진다.
// 백엔드(Nakama·PostgreSQL)는 Docker라서 따로 npm run backend:up 으로 띄운다.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const gamesDir = path.join(root, 'examples', 'games')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const PORTAL_PORT = process.env.PORTAL_PORT || '3317'

const games = readdirSync(gamesDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(gamesDir, entry.name))
  .filter(dir => {
    const file = path.join(dir, 'package.json')
    return existsSync(file) && Boolean(JSON.parse(readFileSync(file, 'utf8')).scripts?.dev)
  })

for (const dir of games) {
  if (existsSync(path.join(dir, 'node_modules'))) continue
  const command = existsSync(path.join(dir, 'package-lock.json')) ? 'ci' : 'install'
  console.log(`[setup] ${path.basename(dir)}: npm ${command}`)
  const result = spawnSync(npm, [command, '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// 셸에 PORT가 잡혀 있으면 게임 서버(sdk-demo)가 그 포트를 먼저 잡아 포털이 밀려난다. 자식에게는 넘기지 않는다.
const childEnv = { ...process.env, FORCE_COLOR: '1' }
delete childEnv.PORT

const COLORS = [36, 35, 33, 32, 34, 31]
const tasks = [
  { name: 'portal', cwd: root, args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', PORTAL_PORT] },
  ...games.map(dir => ({ name: path.basename(dir), cwd: dir, args: ['run', 'dev'] })),
]
const width = Math.max(...tasks.map(task => task.name.length))
const children = []
let stopping = false

function pipe(stream, label) {
  let rest = ''
  stream.on('data', chunk => {
    const lines = (rest + chunk).split(/\r?\n/)
    rest = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) process.stdout.write(`${label} ${line}\n`)
  })
  stream.on('end', () => { if (rest.trim()) process.stdout.write(`${label} ${rest}\n`) })
}

tasks.forEach((task, index) => {
  const label = `\x1b[${COLORS[index % COLORS.length]}m${task.name.padEnd(width)}\x1b[0m |`
  // detached: npm이 띄운 vite·nuxt 같은 손자 프로세스까지 그룹으로 같이 끄기 위해
  const child = spawn(npm, task.args, {
    cwd: task.cwd,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  })
  pipe(child.stdout, label)
  pipe(child.stderr, label)
  child.on('exit', code => {
    children.splice(children.indexOf(child), 1)
    if (!stopping) console.log(`${label} 종료됨 (code ${code ?? 'signal'})`)
    if (!children.length) process.exit(stopping ? 0 : 1)
  })
  children.push(child)
})

console.log(`\n포털: http://127.0.0.1:${PORTAL_PORT}  ·  게임 ${games.length}개  ·  Ctrl+C로 전부 종료\n`)

function stopAll() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill()
      else process.kill(-child.pid, 'SIGTERM')
    } catch { /* already exited */ }
  }
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', stopAll)
process.on('SIGTERM', stopAll)
