<script setup lang="ts">
const { user, busy, ready, error, logout, openLogin } = usePlayHub()
</script>
<template>
  <div class="page">
    <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
    <header class="site-header hub-header">
      <NuxtLink class="brand" to="/" aria-label="PlayHub 홈"><span class="brand-mark" aria-hidden="true">P<span>↗</span></span>playhub<span class="brand-period">.</span></NuxtLink>
      <nav class="site-nav" aria-label="주 메뉴"><NuxtLink to="/">게임 둘러보기</NuxtLink></nav>
      <div class="account-actions">
        <template v-if="user"><span class="header-player"><span class="player-dot" />게스트 <small>{{ user.userId.slice(0, 6) }}</small></span><button class="header-logout" :disabled="busy" @click="logout">로그아웃</button></template>
        <button v-else class="hub-button hub-button-dark header-login" :disabled="busy || !ready" @click="openLogin()">{{ busy || !ready ? '확인 중…' : '로그인' }}<span aria-hidden="true">↗</span></button>
      </div>
    </header>
    <div v-if="error && !user && ready" class="auth-banner" role="status">이전 로그인에 연결하지 못했어요. 로그인 버튼으로 다시 시도해 주세요.</div>
    <NuxtPage />
    <footer class="hub-footer"><div><NuxtLink class="footer-brand" to="/">playhub.</NuxtLink><p>A LITTLE BREAK. A LITTLE PLAY.</p></div><nav aria-label="개발자 문서"><NuxtLink to="/guide">게임 개발 가이드 ↗</NuxtLink><NuxtLink to="/sdk">SDK 설계</NuxtLink><NuxtLink to="/dev/test">연동 테스트</NuxtLink></nav></footer>
    <LoginDialog />
    <NuxtRouteAnnouncer />
  </div>
</template>
