<script setup lang="ts">
const { user, busy, error, login, loginOpen, afterLogin } = usePlayHub()
const dialog = ref<HTMLDialogElement | null>(null)
watch(loginOpen, open => { if (open) dialog.value?.showModal(); else dialog.value?.close() })
function close() { loginOpen.value = false; afterLogin.value = null }
async function signIn() {
  const player = await login()
  if (!player || !loginOpen.value) return
  const destination = afterLogin.value
  close()
  if (destination) await navigateTo(destination)
}
</script>
<template>
  <dialog ref="dialog" class="login-dialog" aria-labelledby="login-title" @cancel="close" @close="close" @click="event => { if (event.target === dialog) close() }">
    <div class="login-content">
      <button class="dialog-close" aria-label="로그인 창 닫기" @click="close">×</button>
      <span class="login-symbol" aria-hidden="true">P<span>↗</span></span>
      <p class="eyebrow">WELCOME TO PLAYHUB</p>
      <h2 id="login-title">나의 다음 기록을 위해.</h2>
      <p class="login-copy">게스트로 로그인하고 게임을 즐겨보세요.<br>최고 점수와 순위를 함께 기록해 드려요.</p>
      <button class="hub-button hub-button-dark" :disabled="busy || !!user" @click="signIn">{{ busy ? '로그인 중…' : '게스트로 로그인' }} <span aria-hidden="true">→</span></button>
      <p v-if="error" class="feedback error" role="alert">{{ error }}</p>
      <p class="login-note">별도 가입 없이 시작할 수 있어요. 같은 브라우저에서는 이전 기록을 이어갑니다. 사이트 데이터를 삭제하면 게스트 계정을 복구할 수 없습니다.</p>
    </div>
  </dialog>
</template>
<style scoped>
.login-dialog { border:0; padding:0; width:min(440px, calc(100% - 32px)); border-radius:24px; color:#202820; box-shadow:0 30px 100px #0004; }
.login-dialog::backdrop { background:#10191099; backdrop-filter:blur(5px); }
.login-content { position:relative; padding:42px 32px 30px; text-align:center; }
.dialog-close { position:absolute; right:16px; top:12px; width:36px; height:36px; border:0; background:transparent; font-size:28px; color:#677166; cursor:pointer; }
.login-symbol { display:inline-block; position:relative; padding:12px 20px; border-radius:17px; background:#d9f589; font-size:36px; font-weight:900; margin-bottom:26px; transform:rotate(-6deg); }
.login-symbol span { position:absolute; bottom:-6px; right:-10px; background:#202820; color:white; border-radius:50%; font-size:19px; padding:4px 9px; }
.login-content h2 { font-size:26px; margin-top:10px; }
.login-copy { font-size:14px; color:#677166; line-height:1.9; margin:18px 0 26px; }
.login-content .hub-button { width:100%; }
.login-note { color:#899085; font-size:12px; line-height:1.8; margin-top:20px; }
</style>
