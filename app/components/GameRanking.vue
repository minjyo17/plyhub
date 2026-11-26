<script setup lang="ts">
import { describeError, type Ranking } from '~/lib/playhub'
const props = defineProps<{ gameId: string; refreshKey?: number }>()
const { user, ready, client, openLogin } = usePlayHub()
const ranking = ref<Ranking | null>(null)
const busy = ref(false)
const error = ref('')
let revision = 0
let active = true
async function refresh() {
  const current = ++revision
  if (!user.value) { ranking.value = null; error.value = ''; busy.value = false; return }
  busy.value = true; error.value = ''
  try {
    const result = await client().getTop(props.gameId, 10)
    if (active && current === revision) ranking.value = result
  } catch (cause) { if (active && current === revision) error.value = describeError(cause) }
  finally { if (active && current === revision) busy.value = false }
}
watch([user, () => props.gameId, () => props.refreshKey], () => { void refresh() }, { immediate: true })
onBeforeUnmount(() => { active = false; revision++ })
</script>
<template>
  <section class="leaderboard-panel" aria-label="게임 랭킹" :aria-busy="busy">
    <div class="leaderboard-heading"><div><p class="eyebrow">THE LEADERBOARD</p><h2>최고의 플레이어<span>TOP 10</span></h2></div><button v-if="user" class="ranking-refresh" :disabled="busy" aria-label="랭킹 새로고침" @click="refresh">↻</button></div>
    <div v-if="!ready || busy && !ranking" class="ranking-placeholder" role="status"><span class="spinner" />기록을 불러오는 중…</div>
    <div v-else-if="!user" class="ranking-placeholder"><span class="ranking-medal" aria-hidden="true">♜</span><strong>다음 기록의 주인공은?</strong><p>로그인하고 상위 랭킹과<br>내 최고 기록을 확인하세요.</p><button class="hub-button hub-button-outline" @click="openLogin()">로그인하고 랭킹 보기</button></div>
    <template v-else>
      <div v-if="error" class="feedback error" role="alert">{{ error }}<button class="ranking-retry" :disabled="busy" @click="refresh">다시 불러오기</button></div>
      <div v-else-if="ranking && !ranking.records.length" class="ranking-placeholder"><span class="ranking-medal" aria-hidden="true">↗</span><strong>첫 번째 기록을 기다리고 있어요.</strong><p>한 판을 마치고 이름을 올려보세요.</p></div>
      <ol v-if="ranking?.records.length" class="leaderboard-list">
        <li v-for="record in ranking.records" :key="record.userId" :class="{ 'own-ranking': record.userId === user.userId }"><span class="ranking-position" :class="{ podium: record.rank <= 3 }">{{ String(record.rank).padStart(2, '0') }}</span><span class="ranking-avatar" aria-hidden="true">{{ record.rank === 1 ? '★' : 'P' }}</span><span class="ranking-name">{{ record.displayName }}<small v-if="record.userId === user.userId">나</small></span><strong>{{ record.score.toLocaleString('ko-KR') }}<small>점</small></strong></li>
      </ol>
      <div v-if="ranking" class="personal-best"><span>내 최고 기록</span><strong>{{ ranking.myRecord ? `${ranking.myRecord.score.toLocaleString('ko-KR')}점 · ${ranking.myRecord.rank}위` : '첫 기록에 도전하세요' }}</strong></div>
      <p class="leaderboard-note">플레이어별 최고 점수 기준</p>
    </template>
  </section>
</template>
