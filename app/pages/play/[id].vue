<script setup lang="ts">
import { createGameBridge } from '~/lib/game-bridge'
import { findGame, gameUrl } from '~/lib/games'
const route = useRoute()
const game = computed(() => findGame(route.params.id))
if (!game.value) throw createError({ statusCode: 404, statusMessage: '게임을 찾을 수 없습니다.' })
useHead(() => ({ title: `플레이 · ${game.value?.title || '게임'} · PlayHub` }))
const config = useRuntimeConfig()
const { user, ready, client, openLogin } = usePlayHub()
const frame = ref<HTMLIFrameElement | null>(null)
const src = ref('')
// 게임이 알려준 화면 높이. 알려주기 전에는 games.ts의 frameHeight를 쓴다.
const reportedHeight = ref<number | null>(null)
const frameStyle = computed(() => reportedHeight.value
  ? { height: `${reportedHeight.value}px` }
  : { '--frame-height': `${game.value?.frameHeight ?? 870}px` })
const connected = ref(false)
const connectionError = ref('')
const savedMessage = ref('')
const refreshKey = ref(0)
let disposeBridge: (() => void) | null = null
let stopResize: (() => void) | null = null
let connectTimer: ReturnType<typeof setTimeout> | undefined

// 등록된 게임 출처·현재 iframe에서 온 높이 알림만 받는다.
function listenResize(origin: string) {
  const onMessage = (event: MessageEvent) => {
    const data = event.data
    if (event.origin !== origin || event.source !== frame.value?.contentWindow) return
    if (!data || data.channel !== 'playhub.frame.v1' || data.type !== 'resize') return
    if (Number.isFinite(data.height) && data.height >= 200 && data.height <= 4000) reportedHeight.value = Math.ceil(data.height)
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}

function launch() {
  disposeBridge?.(); disposeBridge = null; stopResize?.(); stopResize = null; clearTimeout(connectTimer)
  connected.value = false; connectionError.value = ''; src.value = ''; savedMessage.value = ''; reportedHeight.value = null
  const current = game.value
  if (!user.value || !current) return
  try {
    const sdk = client()
    const url = gameUrl(String(config.public[current.urlKey]), window.location.origin)
    url.searchParams.set('platformOrigin', window.location.origin)
    url.searchParams.set('launch', crypto.randomUUID())
    disposeBridge = createGameBridge({
      host: window, frame: () => frame.value?.contentWindow || null,
      gameId: current.id, gameOrigin: url.origin, user: user.value,
      submitScore: (id, score) => sdk.submitScore(id, score),
      getTop: (id, limit) => sdk.getTop(id, limit),
      onConnect: () => { connected.value = true; connectionError.value = ''; clearTimeout(connectTimer) },
      onSaved: score => { savedMessage.value = `최근 저장: ${score}점 · 최고 기록에 반영했어요.`; refreshKey.value++ },
    })
    stopResize = listenResize(url.origin)
    src.value = url.href
    connectTimer = setTimeout(() => { if (!connected.value) connectionError.value = '게임을 불러오지 못했어요. 잠시 후 다시 열어 주세요.' }, 18000)
  } catch { connectionError.value = '게임을 열지 못했어요. 잠시 후 다시 시도해 주세요.' }
}
onMounted(launch)
watch([user, () => route.params.id], () => { if (import.meta.client) launch() })
onBeforeUnmount(() => { clearTimeout(connectTimer); disposeBridge?.(); stopResize?.() })
</script>
<template>
  <main v-if="game" id="main-content" class="snake-page">
    <header class="play-heading"><div><NuxtLink class="back-link" :to="`/games/${game.id}`">← 게임 상세</NuxtLink><h1>{{ game.title }}</h1></div><span v-if="user" class="play-connection" role="status">{{ connected ? '● 연결됨 · 기록 자동 저장' : '게임 연결 중…' }}</span></header>
    <div v-if="!ready" class="ranking-placeholder" role="status">로그인을 확인하고 있어요…</div>
    <section v-else-if="!user" class="play-login-panel"><h2>나만의 기록을 시작해 볼까요?</h2><p>로그인하면 바로 게임을 즐길 수 있어요.</p><button class="hub-button hub-button-dark" @click="openLogin()">로그인하고 플레이</button></section>
    <template v-else>
      <p v-if="connectionError" class="feedback error" role="alert">{{ connectionError }}<button class="ranking-retry" @click="launch">게임 다시 열기</button></p>
      <iframe v-if="src" ref="frame" :src="src" :title="`${game.title} 게임`" class="game-frame" :style="frameStyle" sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" />
      <div class="game-toolbar"><p role="status">{{ savedMessage || '한 판이 끝나면 최고 점수가 기록됩니다.' }}</p><button class="hub-button hub-button-outline" @click="launch">게임 새로 열기</button></div>
      <p class="reload-note">게임을 새로 열면 진행 중인 판과 저장하지 못한 점수는 사라집니다.</p>
      <GameRanking :game-id="game.id" :refresh-key="refreshKey" />
    </template>
  </main>
</template>
<style scoped>
.play-heading { display:flex; justify-content:space-between; align-items:end; gap:20px; margin-bottom:28px; }
.play-connection { color:#547047; font-size:12px; }
.game-frame { display:block; width:100%; height:var(--frame-height, 870px); border:0; border-radius:22px; background:#101719; }
.game-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:16px 0 8px; font-size:13px; color:#53664a; }
.reload-note { text-align:right; color:#91958d; font-size:11px; margin-bottom:30px; }
.play-login-panel { text-align:center; padding:70px 20px; border:1px solid #e0e4d9; border-radius:24px; background:white; }
.play-login-panel p { color:#7c8475; margin:14px 0 24px; }
@media(max-width:850px) { .game-frame { height:1380px; } .play-heading { align-items:start; flex-direction:column; gap:12px; } .game-toolbar { flex-wrap:wrap; } }
</style>
