const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/* Hata metinleri arayüz diline uyar: bu mesajlar kullanıcıya kırmızı kutuda
 * aynen gösteriliyor ve İngilizce arayüzde Türkçe çıkıyordu. Sözlüğü buraya
 * koymak i18n.js'i veri katmanına bağlamadan çeviriyi sağlar (getLang zaten
 * localStorage'dan okuyan saf bir yardımcı). */
import { getLang } from "./i18n";

const LOAD_FAILED = {
  news: ["Haber verisi yüklenemedi", "Could not load news"],
  funds: ["Fon verisi yüklenemedi", "Could not load fund data"],
  fundPrices: ["Fon fiyat verisi yüklenemedi", "Could not load fund prices"],
  series: ["Fiyat serisi yüklenemedi", "Could not load price series"],
  priceIndex: ["Fiyat dizini yüklenemedi", "Could not load price index"],
  signalLog: ["Sinyal arşivi yüklenemedi", "Could not load the signal archive"],
  fx: ["Kur verisi yüklenemedi", "Could not load FX data"],
  dividends: ["Temettü verisi yüklenemedi", "Could not load dividend data"],
  macro: ["Makro veri yüklenemedi", "Could not load macro data"],
  scores: ["Skor geçmişi yüklenemedi", "Could not load score history"],
  fundFlows: ["Fon akışı verisi yüklenemedi", "Could not load fund flow data"],
  positions: ["Hisse pozisyonları yüklenemedi", "Could not load stock positions"],
  backtest: ["Backtest verisi yüklenemedi", "Could not load backtest data"],
  markets: ["Market listesi yüklenemedi", "Could not load the market list"],
  overview: ["Günlük özet yüklenemedi", "Could not load the daily overview"],
  request: ["İstek başarısız", "Request failed"],
  kap: ["KAP bildirimleri yüklenemedi", "Could not load KAP disclosures"],
  inflation: ["TÜFE verisi yüklenemedi", "Could not load CPI data"],
  financials: ["Finansal veri yüklenemedi", "Could not load financial data"],
  calendar: ["Takvim yüklenemedi", "Could not load the calendar"],
};

function loadError(key, status) {
  const [tr, en] = LOAD_FAILED[key] || LOAD_FAILED.request;
  const text = getLang() === "en" ? en : tr;
  return new Error(status == null ? text : `${text} (${status})`);
}


// "static" modunda backend yerine build'e gömülü JSON dosyaları okunur
// (GitHub Pages gibi sunucusuz yayın için).
export const STATIC_MODE = API_BASE === "static";

export async function fetchNews(market) {
  // Haber dosyaları hem dev sunucusunda (public/) hem statik yayında aynı yoldan servis edilir
  const res = await fetch(`${import.meta.env.BASE_URL}data/news_${market}.json`);
  if (!res.ok) throw loadError("news", res.status);
  return res.json();
}

// Haberler market sekmesine göre değil, tek akışta BIST/Global olarak gösterilir;
// bu yüzden etkin marketlerin dosyaları birlikte yüklenip birleştirilir.
export async function fetchAllNews(markets) {
  // allSettled: bir marketin dosyası eksik/bozuksa akışın tamamı çökmesin
  const results = await Promise.allSettled(markets.map((m) => fetchNews(m)));

  if (results.every((r) => r.status === "rejected")) {
    throw loadError("news");
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
    throw body.detail ? new Error(body.detail) : loadError("funds", res.status);
  }
  return res.json();
}

/** Fon karşılaştırma grafiği: günlük fiyat serileri + opsiyonel benchmarklar. */
export async function fetchFundPrices() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/fund_prices.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("fundPrices", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/* ---------------------------- Hisse fiyat serileri ----------------------------
 * Seriler SEMBOL BAŞINA ayrı dosyalarda durur. Eskiden tek bir stock_prices.json
 * vardı ve tek bir hisseye tıklamak **2,6 MB** indiriyordu (611 sembol x 270 mum);
 * ölçüldü, en yüksek niyetli an sitenin en yavaş anıydı. Artık grafik açmak ~4 KB.
 *
 * Dosya adı eşlemesi backend'deki `app/data/price_files.py::price_file_name` ile
 * AYNI olmalı — biri değişirse diğeri de değişmeli. */

/** `THYAO.IS` -> `THYAO_IS`, `GC=F` -> `GC_F`, `^GSPC` -> `_GSPC` */
export function priceFileName(symbol) {
  return String(symbol).replace(/[^A-Za-z0-9-]/g, "_");
}

/** Tek bir sembolün fiyat serisi. Yoksa null (hata değil: o sembol taranmamış olabilir). */
export async function fetchStockSeries(symbol) {
  const res = await fetch(
    `${import.meta.env.BASE_URL}data/prices/${priceFileName(symbol)}.json`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("series", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  const data = await res.json();
  return data?.bars || null;
}

/**
 * Birden çok sembolü paralel çeker. Eş zamanlı istek sayısı sınırlıdır: tarama
 * tablosunda 60 satır varken 60 isteği aynı anda açmak tarayıcı kuyruğunu kilitler
 * ve asıl istenen (kullanıcının tıkladığı hisse) arkada kalırdı.
 */
const SERIES_CONCURRENCY = 6;

export async function fetchStockSeriesMany(symbols) {
  const out = {};
  const queue = [...symbols];

  async function worker() {
    while (queue.length) {
      const symbol = queue.shift();
      try {
        const bars = await fetchStockSeries(symbol);
        if (bars) out[symbol] = bars;
      } catch {
        /* tek sembolün hatası diğerlerini düşürmesin */
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SERIES_CONCURRENCY, queue.length) }, worker),
  );
  return out;
}

/** Serisi olan semboller (portföy sayfasındaki hisse listesi). Seri taşımaz. */
export async function fetchPriceIndex() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/prices/index.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("priceIndex", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/**
 * Şirket logosu manifesti: { "THYAO.IS": "THYAO_IS.png", ... }. Logolar build
 * zamanında indirilip repoya konur (scripts/build_logos.py); çalışma anında yalnızca
 * bu küçük manifest inip hangi sembolün gerçek logosu olduğunu söyler. Logosu
 * olmayan sembol manifestte yer almaz ve arayüzde nötr harf rozetine düşer.
 * Dosya yoksa (henüz logo üretilmemiş) boş manifest döner: hata değil, herkes monogram.
 */
export async function fetchLogoManifest() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}logos/index.json`);
    if (!res.ok) return {};
    if (!(res.headers.get("content-type") || "").includes("json")) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Bir sembolün logo URL'i (manifestte varsa), yoksa null. */
export function logoUrl(manifest, symbol) {
  const file = manifest?.[symbol];
  return file ? `${import.meta.env.BASE_URL}logos/${file}` : null;
}

/**
 * Fon logosu: bir fonun kendi logosu yoktur, onu yöneten PORTFÖY ŞİRKETİNİN
 * logosu vardır (Pusula Portföy'ün tüm fonları aynı logoyu gösterir). Manifest
 * şirket slug'ıyla anahtarlanır (scripts/build_fund_logos.py); slug fon adından
 * çıkarılır. Bu fonksiyonun AYNISI backend'de var (company_slug); değişirse ikisi de.
 */
export function fundCompanySlug(fundName) {
  if (!fundName) return null;
  const m = /^(.*?portf[öo]y)\b/i.exec(fundName);
  if (!m) return null;
  return m[1]
    .replace(/İ/g, "i").replace(/I/g, "i").replace(/ı/g, "i")
    .replace(/Ş/g, "s").replace(/ş/g, "s").replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u").replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

export async function fetchFundLogoManifest() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}fund-logos/index.json`);
    if (!res.ok) return {};
    if (!(res.headers.get("content-type") || "").includes("json")) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/** Fon şirketi logosunun URL'i (slug manifestte varsa), yoksa null. */
export function fundLogoUrl(manifest, slug) {
  const file = slug ? manifest?.[slug] : null;
  return file ? `${import.meta.env.BASE_URL}fund-logos/${file}` : null;
}

/** Sinyal karnesi arşivi: her taramanın taze sinyalleri, fiyatıyla mühürlenmiş.
 * Arşiv birikene kadar 404/az gün normaldir (kayıt ileriye doğru dolar). */
export async function fetchSignalLog() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/signal_log.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("signalLog", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Döviz/altın serileri: TL / $ / gram altın bazlı gösterim için. İlk taramaya kadar 404 normaldir. */
export async function fetchFx() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/fx.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("fx", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Temettü takvimi: geçmiş ödemeler + yaklaşan ex-tarihler. İlk taramaya kadar 404 normaldir. */
export async function fetchDividends() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/dividends.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("dividends", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Makro panel: kur/faiz/emtia/endeks özeti. İlk taramaya kadar 404 normaldir. */
export async function fetchMacro() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/macro.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("macro", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Günlük skor/sinyal arşivi (değişim raporu). İki gün birikene kadar 404/tek gün normaldir. */
export async function fetchScoreHistory() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/score_history.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("scores", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Günlük yatırımcı sayısı arşivi (fon akışı paneli). Veri birikene kadar 404 normaldir. */
export async function fetchFundFlows() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/fund_flows.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("fundFlows", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Aylık KAP portföy raporlarından üretilen hisse → taşıyan fon matrisi. */
export async function fetchStockPositions() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/fund_stock_positions.json`);
  if (res.status === 404) {
    return { generated_at: null, months: [], stocks: {} };
  }
  if (!res.ok) throw loadError("positions", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) {
    return { generated_at: null, months: [], stocks: {} };
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
  if (!res.ok) throw loadError("backtest", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;

  return res.json();
}

// Hangi marketlerin tarandığı backend'de (settings.enabled_markets) belirlenir ve
// her taramada markets.json'a yazılır. Arayüz sekmelerini buradan üretir; aksi halde
// kapalı bir marketin sekmesi görünüp veri dosyası bulunamazdı.
export async function fetchEnabledMarkets() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/markets.json`);
  if (!res.ok) throw loadError("markets", res.status);
  return res.json();
}

// "Bugün" sayfası tek bir marketin değil, tüm marketlerin özetini gösterir.
// timeframe: daily | weekly | monthly (Marketlere göre sinyaller sekmeleri).
export async function fetchDailyOverview(markets, timeframe = "daily") {
  const results = await Promise.allSettled(
    markets.map((m) => fetchScreener(m, { timeframe })),
  );

  const byMarket = {};
  markets.forEach((market, i) => {
    if (results[i].status === "fulfilled") byMarket[market] = results[i].value;
  });

  if (!Object.keys(byMarket).length) throw loadError("overview");
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
    throw body.detail ? new Error(body.detail) : loadError("request", res.status);
  }
  return res.json();
}

/** KAP şirket bildirimleri (birincil kaynak). İlk taramaya kadar 404 normaldir. */
export async function fetchKap() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/kap.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("kap", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** TÜFE serisi: reel (enflasyondan arındırılmış) getiri hesabı için.
 * `as_of` serinin son ayıdır ve arayüzde GÖSTERİLİR — kapsanmayan dönemde
 * reel getiri hesaplanmaz, çünkü eksik ayı tahmin etmek sayıyı olduğundan
 * güvenilir gösterirdi. */
export async function fetchInflation() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/inflation.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("inflation", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Çeyreklik finansal özet (satış, net kâr, marjlar). Repoda statik durur. */
export async function fetchFinancials() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/financials.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("financials", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}

/** Ekonomik takvim: faiz kararları ve enflasyon raporları. İlk taramaya kadar 404 normaldir. */
export async function fetchCalendar() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/calendar.json`);
  if (res.status === 404) return null;
  if (!res.ok) throw loadError("calendar", res.status);
  if (!(res.headers.get("content-type") || "").includes("json")) return null;
  return res.json();
}
