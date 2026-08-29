import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages gibi alt dizinde yayınlarken VITE_BASE_PATH=/repo-adi/ verilir.
const base = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        // data/*.json tarama çıktısı — SW'ye gömülmesin (her deploy'da değişir)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // hisse/ (SEO sayfaları, ~600+ HTML) ve rapor/ arşivi precache'e GİRMEMELİ:
        // her deploy'da hepsi değiştiğinden her ziyaretçi her deploy sonrası ~800
        // dosyayı yeniden indiriyordu. Yavaş bağlantıda bu güncelleme hiç bitmiyor
        // ve kullanıcı haftalarca eski uygulama sürümüne takılı kalıyordu.
        globIgnores: ['hisse/**', 'rapor/**', 'fon-kategori/**'],
        // Precache dışı sayfalara SPA fallback uygulanmasın: /hisse/X.html ve
        // /rapor/Y.html gerçek dosyalar, index.html değil.
        navigateFallbackDenylist: [/\/(data|hisse|rapor|fon-kategori)\//],
      },
      manifest: {
        name: 'Borsa Tarama',
        short_name: 'Borsa Tarama',
        description: 'BIST 100 ve S&P 500 için teknik tarama uygulaması',
        theme_color: '#7c3aed',
        background_color: '#0f1115',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
