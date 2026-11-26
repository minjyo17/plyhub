import { computed, onMounted, ref } from 'vue'
import { describeError, validateScore, type RankEntry } from '~/lib/playhub'

type RequestState = 'idle' | 'loading' | 'success' | 'error'
const GAME_ID = 'test-game'

export function useTestScreen() {
  const auth = usePlayHub()
  const user = auth.user
  const records = ref<RankEntry[]>([])
  const myRecord = ref<RankEntry | null>(null)
  const scoreInput = ref('1000')
  const ready = ref(false)
  const authState = ref<RequestState>('idle')
  const submitState = ref<RequestState>('idle')
  const rankingState = ref<RequestState>('idle')
  const authError = ref('')
  const submitError = ref('')
  const rankingError = ref('')
  const validationError = ref('')
  const submissionMessage = ref('')
  const busy = computed(() => !ready.value || [authState.value, submitState.value, rankingState.value].includes('loading'))
  const getSdk = auth.client

  async function loadRanking() {
    rankingState.value = 'loading'
    rankingError.value = ''
    try {
      const ranking = await getSdk().getTop(GAME_ID)
      records.value = ranking.records
      myRecord.value = ranking.myRecord
      rankingState.value = 'success'
    } catch (error) {
      rankingError.value = describeError(error)
      rankingState.value = 'error'
    }
  }

  async function login() {
    if (busy.value) return
    authState.value = 'loading'
    authError.value = ''
    try {
      const player = await auth.login()
      if (!player) throw new Error(auth.error.value || '로그인하지 못했습니다.')
      authState.value = 'success'
    } catch (error) {
      authError.value = auth.error.value || describeError(error)
      authState.value = 'error'
      return
    }
    await loadRanking()
  }

  async function submitScore() {
    if (busy.value || !user.value) return
    validationError.value = submissionMessage.value = submitError.value = ''
    submitState.value = 'idle'
    const value = scoreInput.value.trim()
    const score = Number(value)
    try {
      if (!/^\d+$/.test(value)) throw new Error('0부터 1,000,000,000까지의 정수를 입력해 주세요.')
      validateScore(score)
    } catch (error) {
      validationError.value = (error as Error).message
      return
    }
    submitState.value = 'loading'
    try {
      await getSdk().submitScore(GAME_ID, score)
      submitState.value = 'success'
      submissionMessage.value = '점수를 서버에 저장했습니다. 최고 점수만 기록에 반영됩니다.'
    } catch (error) {
      submitError.value = describeError(error)
      submitState.value = 'error'
      return
    }
    // A ranking read failure must not misreport a successful score write as failed.
    await loadRanking()
  }

  async function refreshRanking() {
    if (busy.value || !user.value) return
    await loadRanking()
  }

  watch(user, value => {
    records.value = []; myRecord.value = null
    if (value && ready.value) void loadRanking()
    else { authState.value = 'idle'; rankingState.value = 'idle' }
  })

  onMounted(() => {
    ready.value = true
    try {
      if (user.value) void loadRanking()
    } catch (error) {
      authError.value = auth.error.value || describeError(error)
      authState.value = 'error'
    }
  })

  return {
    user, records, myRecord, scoreInput, authState, submitState, rankingState,
    authError, submitError, rankingError, validationError, submissionMessage,
    busy, login, submitScore, refreshRanking,
  }
}
