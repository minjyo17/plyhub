import { createPlayHubSdk, describeError, type GuestUser } from '~/lib/playhub'

export default defineNuxtPlugin(nuxtApp => {
  const config = useRuntimeConfig()
  const user = useState<GuestUser | null>('playhub-user', () => null)
  const busy = useState('playhub-auth-busy', () => false)
  const error = useState('playhub-auth-error', () => '')
  const ready = useState('playhub-auth-ready', () => false)
  let sdk: ReturnType<typeof createPlayHubSdk> | undefined
  let pending: Promise<GuestUser | null> | null = null
  function client() {
    if (!import.meta.client) throw new Error('Browser session required')
    sdk ||= createPlayHubSdk({ url: config.public.nakamaUrl, serverKey: config.public.nakamaServerKey }, window.localStorage)
    return sdk
  }
  function login(): Promise<GuestUser | null> {
    if (user.value) return Promise.resolve(user.value)
    if (pending) return pending
    busy.value = true; error.value = ''
    pending = Promise.resolve().then(async () => {
      try {
        const player = await client().loginGuest()
        user.value = player
        try { sessionStorage.removeItem('playhub.signed-out') } catch { /* Optional preference. */ }
        return player
      } catch (cause) { error.value = describeError(cause); return null }
      finally { busy.value = false; pending = null }
    })
    return pending
  }
  function logout() {
    if (busy.value) return
    user.value = null; sdk = undefined; error.value = ''
    try { sessionStorage.setItem('playhub.signed-out', '1') } catch { /* UUID and saved scores remain. */ }
  }
  nuxtApp.hook('app:mounted', async () => {
    try {
      let signedOut = false
      try { signedOut = sessionStorage.getItem('playhub.signed-out') === '1' } catch { /* Optional preference. */ }
      if (!signedOut && client().hasGuest()) await login()
    } catch (cause) { error.value = describeError(cause) }
    finally { ready.value = true }
  })
  return { provide: { playhub: { user, busy, error, ready, login, logout, client } } }
})
