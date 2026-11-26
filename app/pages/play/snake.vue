<script setup lang="ts">
import { createGameBridge } from '~/lib/game-bridge'
import { games, gameUrl } from '~/lib/games'
useHead({ title: '플레이 · Snake Garden · PlayHub' })
const game = games[0]
const config = useRuntimeConfig()
const { user, ready, client, openLogin } = usePlayHub()
const frame = ref<HTMLIFrameElement | null>(null)
const src = ref('')
const connected = ref(false)
const connectionError = ref('')
const savedMessage = ref('')
const refreshKey = ref(0)
let disposeBridge: (() => void) | null = null
let connectTimer: ReturnType<typeof setTimeout> | undefined
function launch() {
  disposeBridge?.(); disposeBridge = null; clearTimeout(connectTimer)
  connected.value = false; connectionError.value = ''; src.value = ''; savedMessage.value = ''
  if (!user.value) return
  try {
    const sdk = client()
    const url = gameUrl(config.public.snakeGameUrl, window.location.origin)
    url.searchParams.set('platformOrigin', window.location.origin)
    url.searchParams.set('launch', crypto.randomUUID())
    disposeBridge = createGameBridge({
      host: window, frame: () => frame.value?.contentWindow || null,
      gameId: game.id, gameOrigin: url.origin, user: user.value,
      submitScore: (id, score) => sdk.submitScore(id, score),
      getTop: (id, limit) => sdk.getTop(id, limit),
      onConnect: () => { connected.value = true; connectionError.value = ''; clearTimeout(connectTimer) },
      onSaved: score => { savedMessage.value = `최근 저장: ${score}점 · 최고 기록에 반영했어요.`; refreshKey.value++ },
    })
    src.value = url.href
    connectTimer = setTimeout(() => { if (!connected.value) connectionError.value = '게임을 불러오지 못했어요. 잠시 후 다시 열어 주세요.' }, 18000)
  } catch { connectionError.value = '게임을 열지 못했어요. 잠시 후 다시 시도해 주세요.' }
}
onMounted(launch)
watch(user, () => { if (import.meta.client) launch() })
onBeforeUnmount(() => { clearTimeout(connectTimer); disposeBridge?.() })
</script>
<template>
  <main id="main-content" class="snake-page">
    <header class="play-heading"><div><NuxtLink class="back-link" to="/games/snake">← 게임 상세</NuxtLink><h1>{{ game.title }}</h1></div><span v-if="user" class="play-connection" role="status">{{ connected ? '● 연결됨 · 기록 자동 저장' : '게임 연결 중…' }}</span></header>
    <div v-if="!ready" class="ranking-placeholder" role="status">로그인을 확인하고 있어요…</div>
    <section v-else-if="!user" class="play-login-panel"><h2>나만의 기록을 시작해 볼까요?</h2><p>로그인하면 바로 게임을 즐길 수 있어요.</p><button class="hub-button hub-button-dark" @click="openLogin()">로그인하고 플레이</button></section>
    <template v-else>
      <p v-if="connectionError" class="feedback error" role="alert">{{ connectionError }}<button class="ranking-retry" @click="launch">게임 다시 열기</button></p>
      <iframe v-if="src" ref="frame" :src="src" title="Snake Garden 게임" class="game-frame" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" />
      <div class="game-toolbar"><p role="status">{{ savedMessage || '한 판이 끝나면 최고 점수가 기록됩니다.' }}</p><button class="hub-button hub-button-outline" @click="launch">게임 새로 열기</button></div>
      <p class="reload-note">게임을 새로 열면 진행 중인 판과 저장하지 못한 점수는 사라집니다.</p>
      <GameRanking :game-id="game.id" :refresh-key="refreshKey" />
    </template>
  </main>
</template>
<style scoped>
.play-heading { display:flex; justify-content:space-between; align-items:end; gap:20px; margin-bottom:28px; }
.play-connection { color:#547047; font-size:12px; }
.game-frame { display:block; width:100%; height:870px; border:0; border-radius:22px; background:#101719; }
.game-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:16px 0 8px; font-size:13px; color:#53664a; }
.reload-note { text-align:right; color:#91958d; font-size:11px; margin-bottom:30px; }
.play-login-panel { text-align:center; padding:70px 20px; border:1px solid #e0e4d9; border-radius:24px; background:white; }
.play-login-panel p { color:#7c8475; margin:14px 0 24px; }
@media(max-width:850px) { .game-frame { height:1380px; } .play-heading { align-items:start; flex-direction:column; gap:12px; } .game-toolbar { flex-wrap:wrap; } }
</style>
