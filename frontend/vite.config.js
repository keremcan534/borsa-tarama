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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,webmanifest}'],
        // hisse/ (SEO sayfaları, ~600+ HTML) ve rapor/ arşivi precache'e GİRMEMELİ:
        // her deploy'da hepsi değiştiğinden her ziyaretçi her deploy sonrası ~800
        // dosyayı yeniden indiriyordu. Yavaş bağlantıda bu güncelleme hiç bitmiyor
        // ve kullanıcı haftalarca eski uygulama sürümüne takılı kalıyordu.
        //
        // logos/ + fund-logos/ de aynı sebeple dışarıda: 600+ şirket logosu
        // (~2 KB'lik minik dosyalar) precache'e girseydi ilk açılış 600 istek
        // demek olurdu. Onlar zaten satır render olunca tek tek çekiliyor ve
        // tarayıcı önbelleğinde kalıcı — precache'in ekleyeceği bir şey yok.
        globIgnores: [
          'hisse/**',
          'rapor/**',
          'fon-kategori/**',
          'logos/**',
          'fund-logos/**',
          // Paylaşım kartı görseli: yalnızca sosyal medya botları çeker,
          // uygulama hiç istemez — 200 KB'yi çevrimdışı önbelleğe koymak boşuna.
          'og-image.png',
        ],
        // Precache dışı sayfalara SPA fallback uygulanmasın: /hisse/X.html ve
        // /rapor/Y.html gerçek dosyalar, index.html değil.
        navigateFallbackDenylist: [/\/(data|hisse|rapor|fon-kategori)\//],
      },
      manifest: {
        name: 'Borsa Tarama',
        short_name: 'Borsa Tarama',
        description: 'BIST 100 ve S&P 500 için teknik tarama uygulaması',
        theme_color: '#0e1833',
        background_color: '#0b1224',
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
