import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = new URL('./', import.meta.url)
await mkdir(new URL('dist/src/', root), { recursive: true })
for (const file of ['index.html', 'src/main.js', 'src/engine.js', 'src/style.css', 'src/platform.js']) {
  await copyFile(new URL(file, root), new URL(`dist/${file}`, root))
}
console.log(`Static game built: ${fileURLToPath(new URL('dist/', root))}`)

await mkdir(new URL('dist/sdk/', root), { recursive: true })
await copyFile(fileURLToPath(import.meta.resolve('@playhub/game-sdk')), new URL('dist/sdk/playhub.js', root))
