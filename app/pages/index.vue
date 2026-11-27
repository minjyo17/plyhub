<script setup lang="ts">
import { games } from '~/lib/games'
useHead({ title: 'PlayHub · 가볍게 시작하는 한 판' })
const search = ref('')
const visibleGames = computed(() => games.filter(game => `${game.title} ${game.description} ${game.genre} ${game.tags.join(' ')}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
</script>
<template>
  <main id="main-content" class="catalogue-page">
    <section class="hub-hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="hero-eyebrow"><span /> JUST ONE MORE GAME</p>
        <h1 id="hero-title">잠깐의 여유,<br>즐거운 한 판.</h1>
        <p>설치 없이 바로 만나는 작은 즐거움.<br>마음에 드는 게임을 찾고, 나만의 기록을 남겨보세요.</p>
        <a class="hub-button hub-button-lime" href="#games">게임 둘러보기 <span aria-hidden="true">↗</span></a>
        <div class="hero-footnote">브라우저에서 바로 <span>·</span> 가볍게 플레이</div>
      </div>
      <NuxtLink class="hero-game" to="/games/snake" aria-label="추천 게임 Snake Garden 상세 보기">
        <SnakeArtwork />
        <div class="hero-game-caption"><div><span>FEATURED GAME</span><strong>Snake Garden</strong></div><span class="round-arrow" aria-hidden="true">↗</span></div>
      </NuxtLink>
    </section>
    <section id="games" class="game-catalogue" aria-labelledby="games-title">
      <div class="catalogue-heading"><div><p class="eyebrow">FIND YOUR NEXT GAME</p><h2 id="games-title">어떤 게임을 해볼까요?<span class="game-count">{{ games.length }}</span></h2></div>
        <label class="game-search"><span aria-hidden="true">⌕</span><span class="sr-only">게임 검색</span><input v-model="search" type="search" placeholder="게임 이름, 장르 검색" autocomplete="off"></label>
      </div>
      <div class="catalogue-meta"><span class="category-pill">전체 게임</span><span>다운로드 없이, 바로 시작하세요.</span></div>
      <div v-if="visibleGames.length" class="game-grid">
        <NuxtLink v-for="game in visibleGames" :key="game.id" class="game-card" :to="`/games/${game.id}`">
          <div class="game-cover"><GameArtwork :game-id="game.id" /><span class="cover-badge">바로 플레이</span><span class="cover-arrow" aria-hidden="true">↗</span></div>
          <div class="game-card-body"><div class="game-card-heading"><h3>{{ game.title }}</h3><span>{{ game.genre }}</span></div><p>{{ game.description }}</p><span class="game-card-link">게임 상세 보기 <span aria-hidden="true">→</span></span></div>
        </NuxtLink>
      </div>
      <div v-else class="search-empty" role="status"><strong>찾는 게임이 아직 없어요.</strong><p>다른 이름이나 장르로 검색해 보세요.</p><button class="hub-button hub-button-outline" @click="search = ''">전체 게임 보기</button></div>
    </section>
    <aside class="creator-banner"><div><span class="eyebrow">MADE FOR PLAY. BUILT BY YOU.</span><h2>당신의 게임도, 이곳에서.</h2><p>직접 만든 웹 게임을 PlayHub에 연결해 보세요.</p></div><NuxtLink class="hub-button hub-button-outline" to="/guide">게임 개발 가이드 ↗</NuxtLink></aside>
  </main>
</template>
