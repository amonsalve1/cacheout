/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function requireBackend(mode: string): void {
  if (mode !== 'production' || process.env.CACHE_OUT_ALLOW_DEMO_BUILD === '1') return
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((key) => !env[key])
  if (missing.length === 0) return
  throw new Error(
    `Refusing to build: ${missing.join(' and ')} not set.\n` +
      'Without these the build silently ships the localStorage demo — seeded players,\n' +
      'invented debts, no shared table — and looks like it works.\n' +
      "Set them in .env.local, or in your host's build environment.\n" +
      'To build the demo: CACHE_OUT_ALLOW_DEMO_BUILD=1 npm run build',
  )
}

function absoluteOgTags(siteUrl: string) {
  return {
    name: 'cache-out:absolute-og',
    transformIndexHtml(html: string) {
      if (!siteUrl) return html
      const base = siteUrl.replace(/\/+$/, '')
      return html
        .replace(/(property="og:image" content=")\//, `$1${base}/`)
        .replace(/(name="twitter:image" content=")\//, `$1${base}/`)
        .replace(/(property="og:url" content=")\/"/, `$1${base}/"`)
    },
  }
}

export default defineConfig(({ mode }) => {
  requireBackend(mode)
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const siteUrl = env.VITE_SITE_URL ?? ''

  const demoAvailable = !(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
  return {
    define: { __DEMO_AVAILABLE__: JSON.stringify(demoAvailable) },
    plugins: [react(), tailwindcss(), absoluteOgTags(siteUrl)],
    server: { port: 5173 },
    test: {
      include: ['src/**/*.test.ts'],
    },
  }
})
