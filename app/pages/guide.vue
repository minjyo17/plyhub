<script setup lang="ts">
useHead({ title: '게임 개발 가이드 · PlayHub' })
const connectionExample = `import { connectPlayHub } from '@playhub/game-sdk'

const playhub = await connectPlayHub({
  platformOrigin: 'http://127.0.0.1:3317',
})

// 연결이 완료되면 게임의 시작 버튼을 활성화하세요.`
const scoreExample = `// finalScore는 게임에서 계산한 최종 점수입니다.
try {
  await playhub.submitScore(finalScore)
  // 저장 완료를 표시하세요.
} catch (error) {
  // finalScore를 유지하고 재시도 버튼을 표시하세요.
}`
const rankingExample = `// 게임 안에서도 랭킹을 보여주고 싶다면
const { records, myRecord } = await playhub.getTop(10)

// records: 상위 플레이어의 순위·이름·점수
// myRecord: 내 순위·최고 점수. 기록이 없으면 null`
</script>

<template>
  <main id="main-content" class="docs-page">
    <header class="docs-heading">
      <p class="eyebrow">게임 개발자를 위한 가이드</p>
      <h1>게임을 만들고,<br>PlayHub에 연결하세요.</h1>
      <p class="description">게임의 재미와 플레이 로직에 집중하세요. 사용자 로그인과 점수 저장은 플랫폼이 담당합니다.</p>
    </header>

    <aside class="docs-draft" aria-label="가이드 제공 상태">
      <span class="docs-badge done">로컬 SDK v0.1.0</span>
      <p>외부 게임용 SDK와 포털 연결이 구현되어 있습니다. packages/game-sdk의 로컬 패키지를 사용하며, npm 레지스트리에는 아직 배포하지 않았습니다. 샘플에서 연결·저장·랭킹을 바로 실행할 수 있습니다.</p>
    </aside>

    <section class="docs-card">
      <h2>샘플부터 실행해 보세요.</h2>
      <pre tabindex="0" class="docs-code"><code># 터미널 1 · 저장소 루트
npm run backend:up
npm run dev -- --host 127.0.0.1 --port 3317

# 터미널 2 · 저장소 루트에서 시작
cd examples/games/sdk-demo
npm ci
npm run dev</code></pre>
      <p><NuxtLink class="docs-link" to="/play/snake">Snake Garden 열기 →</NuxtLink>에서 게스트로 게임을 열고 플레이하세요. 3318 주소를 직접 열면 서버 저장이 없는 연습 모드입니다. 이미 실행 중인 서버가 있다면 중복 실행하지 않아도 됩니다.</p>
      <p>Vite 등의 번들러 프로젝트에서는 로컬 SDK 경로로 <code>npm install /절대/경로/playhub/packages/game-sdk</code> 후 아래 import를 사용합니다. 번들러 없는 샘플은 설치한 패키지를 <code>/sdk/playhub.js</code>로 제공하고 이 경로에서 import합니다. 빌드하면 SDK 파일도 dist에 포함됩니다.</p>
      <p>platformOrigin은 포털의 정확한 주소(프로토콜·호스트·포트)입니다. 게임 개발자가 허용할 주소를 정하며 임의 쿼리 값을 그대로 신뢰하지 않습니다. 샘플 허용 목록은 <code>src/platform.js</code>에 있습니다.</p>
    </section>

    <section class="docs-card" aria-labelledby="prepare-title">
      <h2 id="prepare-title">먼저 준비할 것</h2>
      <p>브라우저에서 실행되는 독립 웹 게임과, 게임을 열 수 있는 URL을 준비합니다. 순수 JavaScript, Vue, React 등 게임을 만드는 기술은 자유롭게 선택할 수 있습니다.</p>
      <div class="responsibility-grid">
        <div><h3>게임이 담당해요</h3><ul><li>시작·조작·종료·다시하기</li><li>최종 점수 계산</li><li>저장 상태와 재시도 화면</li></ul></div>
        <div><h3>PlayHub가 담당해요</h3><ul><li>사용자 로그인과 인증 유지</li><li>게임별 점수 저장과 랭킹 조회</li><li>SDK 요청 전달과 응답 처리</li></ul></div>
      </div>
    </section>

    <section class="docs-section" aria-labelledby="usage-title">
      <p class="eyebrow">연동 흐름</p>
      <h2 id="usage-title">게임에서는 이 세 가지만 사용합니다.</h2>
      <div class="docs-card">
        <div class="docs-section-heading"><h3>01. 플랫폼 연결 준비</h3><span class="docs-badge done">구현됨</span></div>
        <p>PlayHub에서 게임이 실행되면 SDK 연결을 기다립니다. 연결에 실패하면 안내와 재시도를 제공하세요.</p>
        <pre tabindex="0" class="docs-code" aria-label="SDK 연결 예시"><code>{{ connectionExample }}</code></pre>
      </div>
      <div class="docs-card">
        <div class="docs-section-heading"><h3>02. 게임 종료 후 점수 제출</h3><span class="docs-badge done">구현됨</span></div>
        <p>종료 시 최종 점수를 한 번 제출합니다. 요청 중에는 중복 제출을 막고, 실패하면 점수를 보관해 재시도할 수 있게 합니다.</p>
        <pre tabindex="0" class="docs-code" aria-label="점수 제출과 실패 처리 예시"><code>{{ scoreExample }}</code></pre>
        <p class="docs-callout">초기 점수 규칙: 0부터 1,000,000,000까지의 정수, 높은 점수가 상위, 사용자별 최고 기록 유지. 서버 저장 여부가 불확실한 오류에서도 재시도할 수 있게 최종 점수를 남겨 두세요.</p>
      </div>
      <div class="docs-card">
        <div class="docs-section-heading"><h3>03. 랭킹 표시하기</h3><span class="docs-badge optional">선택 기능</span></div>
        <p>게임 화면에 랭킹을 넣고 싶을 때 사용합니다. 조회 실패가 게임 진행이나 이미 완료한 점수 저장을 취소하지 않도록 분리하세요.</p>
        <pre tabindex="0" class="docs-code" aria-label="랭킹 조회 예시"><code>{{ rankingExample }}</code></pre>
      </div>
    </section>

    <section class="docs-card">
      <h2>연결 수명과 실패 처리</h2>
      <p>페이지를 닫거나 연동을 해제할 때 <code>playhub.dispose()</code>를 호출합니다. 새로 열린 iframe에서는 다시 connectPlayHub를 호출하세요. SDK는 기본 15초 후 TIMEOUT을 반환하며, 점수 쓰기를 자동 재전송하지 않습니다. 오류의 <code>code</code>로 TIMEOUT, BACKEND_UNAVAILABLE, DISCONNECTED, INVALID_ARGUMENT 등을 구분할 수 있습니다.</p>
      <p>샘플은 저장 실패 시 미저장 최고 점수를 메모리에 보관합니다. 다음 판을 해도 유지되지만 새로고침·닫기 전에는 재시도해야 합니다. 저장 완료와 랭킹 조회 실패는 별도로 표시합니다.</p>
    </section>

    <section class="docs-card" aria-labelledby="registration-title">
      <h2 id="registration-title">게임 등록과 로컬 테스트</h2>
      <p>첫 버전은 PlayHub 안에서 실행되는 게임을 대상으로 합니다. 게임 URL만 직접 열었을 때 플랫폼 기능까지 연결되는 것은 아닙니다.</p>
      <ol class="docs-checklist">
        <li><strong>게임 실행 URL을 준비합니다.</strong><span>게임을 독립 개발 서버에서 실행하거나 배포합니다. PlayHub에서 iframe으로 열 수 있어야 합니다.</span></li>
        <li><strong>플랫폼에 게임 정보를 등록합니다.</strong><span>게임 이름, 실행 URL, 허용 출처를 전달합니다. 초기 등록은 플랫폼 설정으로 진행하며, 등록 화면은 아직 제공하지 않습니다.</span></li>
        <li><strong>PlayHub에서 실행해 연동을 확인합니다.</strong><span>SDK 연결, 점수 저장, 랭킹 반영, 통신 실패 후 재시도를 확인합니다. /play/snake에서 독립 스네이크 게임을 열어 확인할 수 있습니다.</span></li>
      </ol>
    </section>

    <section class="docs-card" aria-labelledby="example-title">
      <h2 id="example-title">샘플 게임은 어디에 있나요?</h2>
      <p>독립 예제는 <code>examples/games/sdk-demo/</code>에 있습니다. <code>src/platform.js</code>가 공개 SDK를 호출하고, <code>src/main.js</code>가 게임 종료 점수를 전달합니다.</p>
      <p>개발하는 게임을 PlayHub 저장소 안에 넣을 필요는 없습니다. 본인의 저장소에서 개발·배포하고 실행 URL로 연결할 수 있습니다.</p>
    </section>

    <aside class="docs-next">
      <div><strong>지금 동작하는 기능을 확인해 보세요.</strong><p>개발용 화면에서 실제 게스트 로그인과 점수·랭킹 저장을 테스트할 수 있습니다.</p></div>
      <NuxtLink class="docs-link" to="/dev/test">연동 테스트 열기 →</NuxtLink>
    </aside>
    <footer>PlayHub · 게임 개발 가이드 · SDK v0.1.0</footer>
  </main>
</template>
