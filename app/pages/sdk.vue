<script setup lang="ts">
useHead({ title: 'SDK 설계 · PlayHub' })
const steps = [
  { number: '01', title: '외부 게임용 SDK 인터페이스 정의', body: '게임 개발자가 사용할 연결·점수 제출·랭킹 조회 함수와 성공·실패 응답을 정합니다.', output: '함수 명세, 요청·응답 자료형, 오류 처리 규칙', done: '게임 개발자는 짧은 사용 가이드만으로 연동 흐름을 이해할 수 있습니다.' },
  { number: '02', title: '게임 SDK와 포털 통신 구현', body: '게임의 함수 호출을 포털로 전달하고, 포털이 현재 사용자의 인증 정보로 Nakama 기능을 실행합니다.', output: '게임 SDK, 포털 브리지, 연결 준비·요청 ID·시간 초과 처리', done: '발신 origin과 iframe을 확인하고, 실행 중인 게임 ID로 요청을 처리합니다. 인증 토큰은 포털에서 관리합니다.' },
  { number: '03', title: '게임 URL 등록과 iframe 실행', body: '게임 ID, 제목, 실행 URL, 허용 origin을 등록하고 포털에서 선택한 게임을 엽니다. 처음에는 설정 파일로 시작합니다.', output: '최소 게임 목록, iframe 플레이 화면, 목록 복귀', done: '게임 소스를 Nuxt에 넣지 않고 등록한 URL만으로 실행할 수 있습니다.' },
  { number: '04', title: '독립 샘플 게임으로 검증', body: '플랫폼 내부 코드를 참조하지 않는 작은 웹 게임을 만들고, 공개 게임 SDK만 사용해 연동합니다.', output: '독립 실행 가능한 샘플 프로젝트와 재현 가이드', done: '플레이 → 점수 제출 → 실제 랭킹 반영을 확인하고, 통신 실패 후 재시도도 검증합니다.' },
]
const tree = `playhub/
├─ app/                       포털 화면과 Nakama 연동 · 현재 구현
├─ infra/nakama/              서버 설정과 초기화 코드 · 현재 구현
├─ packages/game-sdk/         외부 게임용 SDK · 구현
└─ examples/games/sdk-demo/   독립 샘플 게임 · 구현
   ├─ package.json           자체 실행·빌드 명령
   ├─ index.html
   └─ src/                   게임 코드 + 공개 SDK 사용`
</script>

<template>
  <main id="main-content" class="docs-page">
    <header class="docs-heading">
      <p class="eyebrow">플랫폼 개발자를 위한 문서</p>
      <h1>게임은 독립적으로.<br>공통 기능은 PlayHub로.</h1>
      <p class="description">웹 게임이 로그인·점수·랭킹을 간단하게 사용할 수 있도록 SDK와 실행 환경을 제공합니다.</p>
      <nav class="section-links" aria-label="SDK 문서 목차">
        <a href="#nakama-guide">Nakama 실행 구조</a>
        <a href="#platform-roadmap">플랫폼 개발 1–4</a>
        <a href="#sample-location">샘플 게임 위치</a>
      </nav>
    </header>

    <section class="docs-card" aria-labelledby="integration-title">
      <div class="docs-section-heading"><h2 id="integration-title">게임부터 서버까지 연결된 구조</h2><span class="docs-badge done">외부 SDK 연결 완료</span></div>
      <p>Nakama는 로그인과 리더보드 등을 제공하는 게임 백엔드입니다. PlayHub는 이 기능을 게임 개발자가 쓰기 쉬운 인터페이스로 제공합니다.</p>
      <div class="integration-flow" aria-label="외부 게임에서 데이터베이스까지의 목표 연결 구조">
        <div><span class="docs-badge done">구현됨</span><strong>외부 웹 게임</strong><small>PlayHub 게임 SDK 사용</small></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div><span class="docs-badge done">구현됨</span><strong>포털 브리지</strong><small>게임 요청 전달·검증</small></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div><span class="docs-badge done">구현됨</span><strong>Nakama 연동</strong><small>인증 · 점수 · 랭킹</small></div>
        <span class="flow-arrow" aria-hidden="true">→</span>
        <div><span class="docs-badge done">구현됨</span><strong>서버와 DB</strong><small>Nakama · PostgreSQL</small></div>
      </div>
      <p class="docs-callout">/dev/test의 수동 테스트는 기존 Nakama 래퍼를 사용합니다. /play/snake는 별도 주소의 게임을 iframe으로 실행하고, 공개 SDK 요청을 포털 브리지에서 받아 같은 래퍼로 처리합니다. 게임에는 사용자 공개 정보만 전달하며 인증 토큰을 넘기지 않습니다.</p>
      <NuxtLink class="docs-link" to="/dev/test">실제 로그인·점수 테스트 열기 →</NuxtLink>
    </section>

    <section class="docs-card">
      <h2>코드에서 연결을 따라가기</h2>
      <ol class="docs-checklist">
        <li><strong>게임 → 공개 SDK</strong><span>examples/games/sdk-demo/src/platform.js → packages/game-sdk/index.js. connectPlayHub, submitScore, getTop을 사용합니다.</span></li>
        <li><strong>SDK → 포털 브리지</strong><span>app/lib/game-bridge.ts. playhub.sdk.v1 메시지, 요청 ID, 연결 ID, origin·발신 iframe 확인, 중복 요청 처리와 제한 시간을 사용합니다.</span></li>
        <li><strong>포털 → Nakama</strong><span>app/pages/play/snake.vue → app/lib/playhub.ts. 포털이 snake 게임 ID를 결정하고 인증된 사용자로 playhub-snake에 저장합니다.</span></li>
        <li><strong>Nakama → DB</strong><span>infra/nakama/src/main.ts에서 스네이크 리더보드를 만듭니다. PostgreSQL 볼륨에 최고 기록이 유지됩니다.</span></li>
      </ol>
      <p>게임 설정: app/lib/games.ts의 ID·제목, nuxt.config.ts의 snakeGameUrl. 실행 URL은 NUXT_PUBLIC_SNAKE_GAME_URL로 변경합니다. 해당 URL의 origin만 브리지에서 허용하며 포털과 다른 출처여야 합니다.</p>
      <p class="docs-callout">현재는 클라이언트가 계산한 점수를 받는 로컬 데모입니다. 메시지 출처 검증이 점수의 진위를 보장하지는 않습니다. 공개 경쟁 서비스용 점수 검증은 별도 범위입니다.</p>
    </section>

    <NakamaGuide />

    <section id="platform-roadmap" class="docs-section" aria-labelledby="roadmap-title">
      <p class="eyebrow">구현된 플랫폼 구성</p>
      <h2 id="roadmap-title">플랫폼이 준비할 네 가지</h2>
      <p class="description">아래는 플랫폼 개발자의 작업입니다. 게임 개발자에게는 SDK 사용법과 게임 등록 조건만 안내합니다.</p>
      <ol class="roadmap-list">
        <li v-for="step in steps" :key="step.number" class="docs-card roadmap-step">
          <span class="step-number" aria-hidden="true">{{ step.number }}</span>
          <div>
            <div class="docs-section-heading"><h3>{{ step.title }}</h3><span class="docs-badge done">구현됨</span></div>
            <p>{{ step.body }}</p>
            <dl class="step-details"><dt>산출물</dt><dd>{{ step.output }}</dd><dt>완료 기준</dt><dd>{{ step.done }}</dd></dl>
          </div>
        </li>
      </ol>
    </section>

    <section id="sample-location" class="docs-card" aria-labelledby="sample-title">
      <p class="eyebrow">게임 개발자 입장에서 검증하기</p>
      <h2 id="sample-title">샘플 게임은 독립 프로젝트로 둡니다.</h2>
      <p>같은 저장소의 <code>examples/games/sdk-demo/</code>를 권장합니다. 게임 자체의 실행·빌드 환경을 두고, Nuxt의 내부 코드 대신 공개 게임 SDK만 사용합니다.</p>
      <pre tabindex="0" class="docs-code" aria-label="권장 프로젝트 구조"><code>{{ tree }}</code></pre>
      <p>로컬에서는 포털과 게임을 서로 다른 포트로 실행하고, 포털에 샘플 게임 URL을 등록해 테스트합니다. 배포할 때도 별도 주소를 사용할 수 있으며, 필요하면 게임만 다른 저장소로 옮길 수 있습니다.</p>
      <p class="docs-muted">공개 SDK는 로컬 패키지로 제공하며 npm 배포는 아직 하지 않았습니다. 게임 등록은 코드와 환경 설정으로 관리합니다. 샘플은 실제 종료 점수를 playhub-snake 리더보드에 저장합니다.</p>
    </section>

    <aside class="docs-next">
      <div><strong>게임 개발자에게 필요한 내용만 보고 싶다면</strong><p>연결 준비, 점수 제출, 실패 처리와 등록 조건을 안내합니다.</p></div>
      <NuxtLink class="docs-link" to="/guide">게임 개발 가이드 →</NuxtLink>
    </aside>
    <footer>PlayHub · 플랫폼 SDK 설계</footer>
  </main>
</template>
