export function usePlayHub() {
  const auth = useNuxtApp().$playhub
  const loginOpen = useState('playhub-login-open', () => false)
  const afterLogin = useState<string | null>('playhub-after-login', () => null)
  function openLogin(destination: string | null = null) {
    afterLogin.value = destination
    auth.error.value = ''
    loginOpen.value = true
  }
  return { ...auth, loginOpen, afterLogin, openLogin }
}
