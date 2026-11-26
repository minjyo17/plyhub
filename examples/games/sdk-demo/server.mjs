import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), process.argv.includes('--dist') ? 'dist' : '')
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/src/platform.js', ['src/platform.js', 'text/javascript; charset=utf-8']],
  ['/sdk/playhub.js', ['sdk/playhub.js', 'text/javascript; charset=utf-8']],
  ['/src/main.js', ['src/main.js', 'text/javascript; charset=utf-8']],
  ['/src/engine.js', ['src/engine.js', 'text/javascript; charset=utf-8']],
  ['/src/style.css', ['src/style.css', 'text/css; charset=utf-8']],
])
const port = Number(process.env.PORT || 3318)
const server = createServer(async (request, response) => {
  try {
    const file = files.get(new URL(request.url, 'http://localhost').pathname)
    if (!file || !['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(404); response.end('Not found'); return
    }
    const source = file[0] === 'sdk/playhub.js' && !process.argv.includes('--dist')
      ? fileURLToPath(import.meta.resolve('@playhub/game-sdk')) : path.join(root, file[0])
    const data = await readFile(source)
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
    response.end(request.method === 'HEAD' ? undefined : data)
  } catch {
    response.writeHead(500); response.end('Unable to load game. Run npm run build before preview.')
  }
})
server.on('error', error => { console.error(error.message); process.exitCode = 1 })
server.listen(port, '127.0.0.1', () => console.log(`Snake Garden: http://127.0.0.1:${port}`))
