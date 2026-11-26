export default defineNuxtConfig({
  compatibilityDate: '2026-11-12',
  css: ['~/assets/css/base.css', '~/assets/css/platform.css'],
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      nakamaUrl: 'http://127.0.0.1:7350',
      snakeGameUrl: 'http://127.0.0.1:3318',
      // Client connection key, never a console password or session signing key.
      nakamaServerKey: 'playhub-local-server-key',
    },
  },
  app: {
    head: {
      title: 'PlayHub',
      htmlAttrs: { lang: 'ko' },
    },
  },
})
