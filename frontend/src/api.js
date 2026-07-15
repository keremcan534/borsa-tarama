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
