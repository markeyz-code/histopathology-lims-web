import { fileURLToPath } from 'node:url';

// Local development reads the monorepo .env so both apps share one source of truth.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // No root .env (Docker and CI inject environment variables directly).
}

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  compatibilityDate: '2025-07-15',
  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxt/image', '@nuxtjs/tailwindcss', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000/api',
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Histopathology LIMS',
      webBase: process.env.NUXT_PUBLIC_WEB_BASE || 'http://localhost:3000',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Histopathology LIMS',
      titleTemplate: '%s · Histopathology LIMS',
      meta: [
        {
          name: 'description',
          content:
            'Block-and-slide level histopathology laboratory information management: accessioning, custody, reporting and turnaround tracking.',
        },
        { name: 'theme-color', content: '#171A1C' },
        { name: 'color-scheme', content: 'light dark' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/pwa-192x192.png' },
      ],
      script: [
        {
          innerHTML:
            "(function(){try{var t=localStorage.getItem('lims-theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}else{document.documentElement.style.colorScheme='light';}}catch(e){}})();",
        },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    configPath: '~/tailwind.config.ts',
    viewer: false,
    exposeConfig: false,
  },
  image: {
    provider: 'ipx',
    quality: 72,
    format: ['webp'],
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Histopathology LIMS',
      short_name: 'Histo LIMS',
      description:
        'Block and slide custody, synoptic reporting and TAT control for histopathology.',
      theme_color: '#171A1C',
      background_color: '#F4F1EA',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      icons: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/offline',
      globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: /^https?:\/\/fonts\./i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'lims-fonts',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: { enabled: false },
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
  vite: {
    resolve: {
      alias: {
        '@lims/shared': fileURLToPath(
          new URL('../../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
  },
  nitro: {
    compressPublicAssets: { gzip: true, brotli: true },
  },
  experimental: {
    payloadExtraction: false,
  },
});
