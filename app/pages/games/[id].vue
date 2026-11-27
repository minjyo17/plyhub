<script setup lang="ts">
import { findGame } from '~/lib/games'
const route = useRoute()
const game = computed(() => findGame(route.params.id))
if (!game.value) throw createError({ statusCode: 404, statusMessage: '게임을 찾을 수 없습니다.' })
useHead(() => ({ title: `${game.value?.title || '게임'} · PlayHub` }))
const { user, busy, ready, openLogin } = usePlayHub()
async function play() {
  if (!game.value) return
  const destination = `/play/${game.value.id}`
  if (!user.value) openLogin(destination)
  else await navigateTo(destination)
}
</script>
<template>
  <main v-if="game" id="main-content" class="game-detail-page">
    <NuxtLink class="back-link" to="/">← 모든 게임</NuxtLink>
    <section class="game-detail-hero" aria-labelledby="detail-title">
      <div class="detail-art"><GameArtwork :game-id="game.id" /></div>
      <div class="detail-summary"><div class="detail-tags"><span v-for="tag in game.tags" :key="tag">{{ tag }}</span></div><p class="detail-subtitle">{{ game.subtitle }}</p><h1 id="detail-title">{{ game.title }}</h1><p class="detail-description">{{ game.description }}</p><button class="hub-button hub-button-dark play-button" :disabled="busy || !ready" @click="play"><span aria-hidden="true">▶</span> {{ busy || !ready ? '로그인 확인 중…' : '플레이하기' }}<span aria-hidden="true">↗</span></button><p class="play-note">{{ user ? '준비됐어요. 최고 기록에 도전해 보세요.' : '게스트 로그인 후 바로 플레이할 수 있어요.' }}</p></div>
    </section>
    <div class="detail-columns">
      <div class="game-information"><section><p class="eyebrow">ABOUT THIS GAME</p><h2>{{ game.aboutTitle }}</h2><p class="game-about">{{ game.about }}</p></section><section class="how-to-play"><h2>이렇게 플레이하세요.</h2><ol><li v-for="(rule, index) in game.rules" :key="rule"><span>{{ String(index + 1).padStart(2, '0') }}</span>{{ rule }}</li></ol><div class="controls-guide"><span>조작 방법</span><strong>{{ game.controls }}</strong><p>{{ game.controlsNote }}</p></div></section></div>
      <GameRanking :game-id="game.id" />
    </div>
  </main>
</template>
