const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// "static" modunda backend yerine build'e gömülü JSON dosyaları okunur
// (GitHub Pages gibi sunucusuz yayın için).
export const STATIC_MODE = API_BASE === "static";

export async function fetchNews(market) {
  // Haber dosyaları hem dev sunucusunda (public/) hem statik yayında aynı yoldan servis edilir
  const res = await fetch(`${import.meta.env.BASE_URL}data/news_${market}.json`);
  if (!res.ok) throw new Error(`Haber verisi yüklenemedi (${res.status})`);
  return res.json();
}

// Haberler market sekmesine göre değil, tek akışta BIST/Global olarak gösterilir;
// bu yüzden etkin marketlerin dosyaları birlikte yüklenip birleştirilir.
export async function fetchAllNews(markets) {
  // allSettled: bir marketin dosyası eksik/bozuksa akışın tamamı çökmesin
  const results = await Promise.allSettled(markets.map((m) => fetchNews(m)));

  if (results.every((r) => r.status === "rejected")) {
    throw new Error("Haber verisi yüklenemedi");
  }

  const seen = new Set();
  const items = [];
  let generatedAt = null;

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    if (!generatedAt) generatedAt = result.value.generated_at;
    for (const item of result.value.items || []) {
      if (seen.has(item.link)) continue; // aynı haber birden fazla markette çıkabilir
      seen.add(item.link);
      items.push(item);
    }
  }

  items.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  return { items, generated_at: generatedAt };
}

export async function fetchFunds() {
  const url = STATIC_MODE
    ? `${import.meta.env.BASE_URL}data/funds.json`
    : `${API_BASE}/api/funds`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Fon verisi yüklenemedi (${res.status})`);
  }
  return res.json();
}

// Backtest ayrı ve haftalık bir workflow'da üretilip build'e kopyalanır; canlı
// çalıştırılacak bir endpoint'i yok (600+ sembol x yıllarca veri, dakikalar sürer).
export async function fetchBacktest() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/backtest.json`);

  // Dosya yoksa bu bir hata değil, veri yokluğudur (haftalık backtest workflow'u
  // henüz çalışmamıştır): kullanıcıya kırmızı hata kutusu değil "henüz sonuç yok"
  // gösterilir. GitHub Pages 404 döner; Vite dev/preview ise SPA fallback yüzünden
  // index.html'i 200 ile döndürdüğünden content-type kontrolü de gerekli.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backtest verisi yüklenemedi (${res.status})`);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;

  return res.json();
}

// Hangi marketlerin tarandığı backend'de (settings.enabled_markets) belirlenir ve
// her taramada markets.json'a yazılır. Arayüz sekmelerini buradan üretir; aksi halde
// kapalı bir marketin sekmesi görünüp veri dosyası bulunamazdı.
export async function fetchEnabledMarkets() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/markets.json`);
  if (!res.ok) throw new Error(`Market listesi yüklenemedi (${res.status})`);
  return res.json();
}

// "Bugün" sayfası tek bir marketin değil, tüm marketlerin günlük özetini gösterir.
export async function fetchDailyOverview(markets) {
  const results = await Promise.allSettled(
    markets.map((m) => fetchScreener(m, { timeframe: "daily" })),
  );

  const byMarket = {};
  markets.forEach((market, i) => {
    if (results[i].status === "fulfilled") byMarket[market] = results[i].value;
  });

  if (!Object.keys(byMarket).length) throw new Error("Günlük özet yüklenemedi");
  return byMarket;
}

export async function fetchScreener(market, { live = false, timeframe = "daily" } = {}) {
  const suffix = timeframe === "daily" ? "" : `_${timeframe}`;
  const url = STATIC_MODE
    ? `${import.meta.env.BASE_URL}data/${market}${suffix}.json`
    : `${API_BASE}/api/screener/${market}?timeframe=${timeframe}${live ? "&live=true" : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `İstek başarısız (${res.status})`);
  }
  return res.json();
}
