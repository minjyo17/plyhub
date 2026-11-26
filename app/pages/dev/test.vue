<script setup lang="ts">
useHead({ title: '연동 테스트 · PlayHub' })
const {
  user, records, myRecord, scoreInput, authState, submitState, rankingState,
  authError, submitError, rankingError, validationError, submissionMessage, busy, login, submitScore, refreshRanking,
} = useTestScreen()
const numberFormat = new Intl.NumberFormat('ko-KR')
</script>

<template>


    <main id="main-content">
      <div class="page-heading">
        <p class="eyebrow">플랫폼 테스트</p>
        <h1>첫 번째 점수를 남겨보세요.</h1>
        <p class="description">게스트 로그인부터 점수 제출, 랭킹 확인까지 한 화면에서 테스트합니다.</p>
      </div>

      <aside class="docs-next">
        <div><strong>Snake Garden · 지금 플레이</strong><p>독립 웹 게임을 PlayHub에 연결했습니다. 한 판을 마치면 실제 랭킹에 기록됩니다.</p></div>
        <NuxtLink class="button primary" to="/play/snake">게임 시작 →</NuxtLink>
      </aside>

      <aside class="notice" aria-label="테스트 환경 안내">
        <span class="status-dot" aria-hidden="true" />
        <div><strong>Nakama 실제 연동 · 로컬 개발 환경</strong><p>게스트 계정과 점수는 실제 서버에 저장됩니다. 같은 브라우저와 주소로 다시 방문하면 계정과 최고 기록을 이어서 사용합니다.</p></div>
      </aside>

      <section class="card auth-card" aria-labelledby="auth-title" :aria-busy="authState === 'loading'">
        <div class="auth-info">
          <span class="avatar" aria-hidden="true">{{ user ? 'G' : '?' }}</span>
          <div>
            <h2 id="auth-title">게스트 로그인</h2>
            <p class="subtle" role="status">{{ authState === 'loading' ? 'Nakama에 로그인하는 중…' : user ? `${user.displayName} · 로그인됨` : '로그인 전 · 점수를 제출하려면 먼저 로그인하세요.' }}</p>
          </div>
        </div>
        <button class="button primary" :disabled="busy || (!!user && authState !== 'error')" @click="login">
          {{ authState === 'loading' ? '로그인 중…' : authState === 'error' ? '로그인 다시 시도' : user ? '게스트 로그인 완료' : '게스트로 시작' }}
        </button>
        <p v-if="authState === 'error'" class="feedback error auth-error" role="alert">{{ authError }}</p>
      </section>

      <div class="workspace-grid">
        <section class="card score-card" aria-labelledby="score-title">
          <div class="section-heading"><h2 id="score-title">테스트 점수</h2><span class="tag">TEST GAME</span></div>
          <p class="subtle section-description">게임 종료 시 전달할 점수를 직접 입력해 보세요.</p>
          <form novalidate :aria-busy="submitState === 'loading'" @submit.prevent="submitScore">
            <label class="field-label" for="score">제출할 점수</label>
            <div class="score-field">
              <input id="score" v-model="scoreInput" type="text" inputmode="numeric" autocomplete="off" maxlength="10" :disabled="!user || busy" :aria-invalid="!!validationError" :aria-describedby="validationError ? 'score-hint score-error' : 'score-hint'" @input="validationError = ''; submissionMessage = ''">
              <span aria-hidden="true">점</span>
            </div>
            <p id="score-hint" class="field-hint">0 ~ 1,000,000,000 · 최고 점수만 랭킹에 표시됩니다.</p>
            <p v-if="validationError" id="score-error" class="feedback error" role="alert">{{ validationError }}</p>
            <button class="button primary full-width" type="submit" :disabled="!user || busy">{{ submitState === 'loading' ? '점수 제출 중…' : submitState === 'error' ? '점수 다시 제출' : '점수 제출' }}</button>
            <p v-if="!user" class="field-hint center">게스트 로그인 후 제출할 수 있습니다.</p>
            <p v-if="submissionMessage" class="feedback success" role="status">{{ submissionMessage }}</p>
            <p v-if="submitState === 'error'" class="feedback error" role="alert">점수 저장을 확인하지 못했습니다. 입력값은 유지됩니다. {{ submitError }} 재제출해도 최고 점수만 유지됩니다.</p>
          </form>
        </section>

        <section class="card ranking-card" aria-labelledby="ranking-title" :aria-busy="rankingState === 'loading'">
          <div class="section-heading">
            <div class="ranking-heading"><h2 id="ranking-title">상위 랭킹</h2><span class="tag">TOP 10</span></div>
            <button class="button quiet" :disabled="busy || !user" @click="refreshRanking">새로고침</button>
          </div>
          <p class="subtle section-description">서버에 저장된 전체 플레이어의 최고 기록입니다.</p>
          <div v-if="!user" class="empty-state"><strong>로그인하면 랭킹을 확인할 수 있어요.</strong><p>상위 10명과 내 기록을 함께 보여드립니다.</p></div>
          <div v-else-if="rankingState === 'loading'" class="empty-state" role="status"><span class="spinner" aria-hidden="true" /><strong>랭킹을 불러오는 중…</strong></div>
          <div v-else-if="rankingState === 'error'" class="empty-state">
            <div role="alert"><strong>랭킹을 불러오지 못했어요.</strong><p>{{ rankingError }}</p></div>
            <button class="button secondary" :disabled="busy || !user" @click="refreshRanking">랭킹 다시 불러오기</button>
          </div>
          <div v-else-if="records.length === 0" class="empty-state" role="status"><span class="empty-icon" aria-hidden="true">—</span><strong>아직 기록이 없어요.</strong><p>첫 점수를 제출하면 여기에 표시됩니다.</p></div>
          <div v-else class="table-wrap">
            <table>
              <caption class="sr-only">테스트 게임 서버 최고 점수 랭킹</caption>
              <thead><tr><th scope="col">순위</th><th scope="col">플레이어</th><th scope="col" class="number">최고 점수</th></tr></thead>
              <tbody><tr v-for="record in records" :key="record.userId"><td><span class="rank">{{ record.rank }}</span></td><td>{{ record.displayName }} <span v-if="record.userId === user?.userId" class="me-badge">나</span></td><td class="number score-number">{{ numberFormat.format(record.score) }}</td></tr></tbody>
            </table>
            <p class="ranking-note">최고 점수 기준 · Nakama 저장 기록</p>
          </div>
          <div v-if="user && rankingState === 'success'" class="my-record" role="status">
            <strong>내 최고 기록</strong>
            <span v-if="myRecord">{{ numberFormat.format(myRecord.score) }}점 · {{ numberFormat.format(myRecord.rank) }}위</span>
            <span v-else>아직 제출한 점수가 없습니다.</span>
          </div>
        </section>
      </div>

      <details class="test-controls">
        <summary>게스트 계정 안내</summary>
        <div class="controls-content">
          <div>
            <p class="subtle">게스트 식별자는 이 브라우저에 저장됩니다. 사이트 데이터를 삭제하면 기존 계정에 다시 접근할 수 없으므로 주의해 주세요.</p>
            <p v-if="user" class="field-hint account-id">사용자 ID: {{ user.userId }}</p>
            <p class="field-hint">다시 연결해도 같은 계정을 사용하며 저장된 점수는 삭제하지 않습니다.</p>
          </div>
          <button class="button secondary" :disabled="busy" @click="login">같은 게스트로 다시 연결</button>
        </div>
      </details>
      <aside class="docs-next">
        <div><strong>PlayHub의 연결 구조가 궁금하다면</strong><p>Nakama 실행 구조와 외부 게임 SDK의 개발 계획을 확인하세요.</p></div>
        <NuxtLink class="docs-link" to="/sdk">SDK 설계 보기 →</NuxtLink>
      </aside>
      <footer>PlayHub <span aria-hidden="true">·</span> S1 최소 테스트 화면</footer>
    </main>
</template>
