# Site Eksikleri — Rakip Taraması (2026-08-24)

Bu belge "bizde ne eksik" sorusunu iki kaynaktan cevaplıyor: (1) mevcut kodun ne
yaptığı, (2) aynı işi yapan Türkçe platformların ne sunduğu. Her madde
**bizdeki durum → rakipte karşılığı → maliyeti → nasıl yapılır** biçiminde.

Ölçüt bilinçli olarak "rakipte var, bizde yok" değil: bir eksiğin listeye girmesi
için kullanıcının o yüzden **başka bir siteyi açması** gerekiyor. Rakipte olup da
bizim stratejimize hizmet etmeyen şeyler (ör. online seminer, aracı kurum hacim
analizi) bilerek dışarıda bırakıldı.

## Rakip haritası

| Platform | Odak | Bizde karşılığı |
|---|---|---|
| [Fintables](https://fintables.com/) | Finansal tablo + Radar taraması + KAP + karne + ekonomik takvim + alarm (ücretli paketler) | Kısmi: tarama var, tablo/KAP/takvim yok |
| [Tabvendor](https://www.tabvendor.com/) | Tüm BIST bilanço/gelir/nakit akım + arama motoru | Yok |
| [StocKeys](https://www.stockeys.com/) | Web tabanlı temel analiz, bilanço günü içinde güncel | Yok |
| [Finkap](https://finkap.com.tr/) | Yapay zekâ destekli temel analiz, hisse karne, özet rapor | Yok |
| [F-Ray](https://f-rayscoring.com/) | Kullanıcı ağırlıklı puanlama + iki şirket kıyas | Kısmi: teknik puan + karşılaştırma var, temel puan yok |
| [Investing.com TR](https://tr.investing.com/ipo-calendar/) | Halka arz + ekonomik takvim, haber | Yok |
| Matriks Mobil IQ | Bilanço raporu, halka arz takip ekranı, anlık bildirim | Yok |

Ortak nokta: **hepsi temel analiz (bilanço) üzerine kurulu.** Biz tersten,
teknik/momentum tarafından geldik. Bu bir zayıflık değil farklılaşma — ama tek
başına, kullanıcının "bu şirket kâr ediyor mu?" sorusuna cevabımız yok.

---

## Bulgular

### 1. Kapsam: BIST'in ~%14'ü taranıyor  ⬛ en yüksek etki

**Durum:** `app/data/symbols/bist100.json` → 100 sembol. Etkin marketler
`bist100 + sp500 + commodity`. Yani BIST tarafında yalnızca endeks bileşenleri var.

**Rakipte:** Borsada [~700 şirket](https://pusulayatirim.com.tr/blog/borsada-kac-sirket-var)
işlem görüyor; Fintables/Tabvendor/StocKeys hepsini kapsıyor. Kullanıcı ilgilendiği
bir hisseyi arayıp bulamazsa site bir daha açılmıyor — bu, listedeki diğer tüm
eksiklerden daha sert bir terk sebebi.

**Maliyet:** README'deki "her sembol 4 kez çekiliyor" darboğazı burada belirleyici.
Bugün sembol başına 4 istek (günlük/haftalık/aylık/çeyreklik ayrı ayrı) atılıyor.
`max` günlük veriyi bir kez çekip pandas ile resample etmek istek sayısını 4'e böler.
Ölçülmüş hız ~0,5 sn/istek olduğuna göre kaba hesap:

| Senaryo | İstek | Tahmini tarama |
|---|---|---|
| Bugün (100 BIST + 503 S&P + 10 emtia) × 4 | ~2.452 | ~20 dk |
| Resample sonrası, aynı kapsam | ~613 | ~5 dk |
| Resample + **tüm BIST (~700)** + S&P + emtia | ~1.213 | ~10 dk |

Yani resample yapılırsa tüm BIST, bugünkü süreden **daha kısa** bir taramaya sığıyor.
Uyarı: `fetch_fundamentals` sembol başına ayrı bir `.info` isteği (~0,43 sn) ekliyor;
700 sembolde bu tek başına ~5 dk. Temel oranlar tüm BIST'e açılırsa ayrı bir bütçe
kalemi olarak düşünülmeli (ör. haftada bir güncellenen ayrı iş).

**Nasıl:** (a) resample refaktörü, (b) BIST TÜM sembol listesi (KAP/BIST resmi
listesinden), (c) likidite tabanı (`min_daily_turnover`) zaten 50M TRY — küçük
hisselerin çöp sinyal üretmesini bu filtre engelliyor, yani kapsamı açmak listeyi
kirletmez.

### 2. Finansal tablolar / temel analiz derinliği yok

**Durum:** `fetch_fundamentals` yalnızca 4 alan veriyor: F/K, PD/DD, temettü verimi,
ROE — hepsi yfinance `.info`'dan **tek anlık değer**. Tarihsel seri yok, çeyreklik
büyüme yok, marj/borçluluk yok. Kodda dürüst bir not da var: yfinance'in BIST temel
verisi bayat/tutarsız olabiliyor.

**Rakipte:** Bilanço, gelir tablosu, çeyreklik gelir tablosu, nakit akım tablosu,
oran analizi, Excel'e aktarma, dönemler arası karşılaştırma. Fintables'ın "Karne"si,
Finkap'ın hisse karnesi, F-Ray'in puanlaması hep bunun üstünde.

**Maliyet:** Yüksek (veri kaynağı + parse + saklama + arayüz). Ama **ara adım ucuz**:
KAP'ın finansal tablo bildirimlerinden yalnızca özet kalemleri (net kâr, satış, FAVÖK,
özsermaye) çekip çeyreklik seri tutmak, tam tablo altyapısı kurmadan "kâr artıyor mu?"
sorusunu cevaplar. Fon pozisyonları için KAP PDF ayrıştırıcısı (`scripts/kap_fund_positions.py`)
zaten yazılmış — o deneyim buraya taşınabilir.

### 3. KAP şirket bildirim akışı yok

**Durum:** KAP yalnızca fon portföyleri için kullanılıyor. Şirket bildirimleri
(finansal rapor, pay alım-satım, önemli olay, olağandışı fiyat hareketi) sitede hiç yok.
Haber tarafı Google News RSS + Yahoo — yani **ikincil** kaynak; birincil kaynak eksik.

**Rakipte:** Fintables'ın en çok kullanılan özelliği anlık KAP takibi. Matriks
bildirim gönderiyor.

**Maliyet:** Düşük–orta. KAP'ın `https://www.kap.org.tr/tr/api/disclosures` ucu
açık ve ücretsiz; açık kaynak örnekler var
([kap-notifier](https://github.com/cahitihac/kap-notifier),
[KAP_Notifications](https://github.com/alperaydyn/KAP_Notifications)).
Mevcut haber toplama hattına (`app/news/collect.py`) ikinci bir kaynak olarak
takılabilir; JSON üretimi ve arayüz bölümlemesi hazır.

**Not:** KAP bildirimleri 3 dakikada bir güncelleniyor; bizim tarama günde iki kez
çalıştığı için "anlık" iddiasında bulunulmamalı — "son 24 saatin bildirimleri" dürüst
çerçeve olur.

### 4. Reel (enflasyona göre) getiri yok — TR'ye özel, rakiplerde de zayıf ⬛ fırsat

**Durum:** Fon karşılaştırmasında BIST100/USD/altın benchmark'ı var, TÜFE yok.
Portföy sayfası nominal TL getirisi gösteriyor.

**Neden önemli:** Türkiye'de yıllık %40 nominal getiri, enflasyona göre kayıp
olabiliyor. "Kazandım mı?" sorusunun tek dürüst cevabı reel getiri. Rakiplerin
çoğunda bu yok — yani bu bir eksik olduğu kadar **farklılaşma noktası**.

**Maliyet:** Düşük. [TCMB EVDS](https://apideposu.com/tr/catalog/tcmb-evds) API'si
ücretsiz (kayıt + anahtar); TÜFE serisi tek çağrı. Portföy ve fon getirilerine
"reel" kolonu eklemek arayüzde küçük iş.

### 5. Takvimler yok: ekonomik / bilanço / halka arz

**Durum:** Makro panel var ama o **fiyat serisi** paneli (10 enstrüman, değişim +
korelasyon). "Perşembe 14:00 TCMB faiz kararı", "ASELS 3Ç bilançosunu 8 Kasım'da
açıklıyor", "şu şirket gelecek hafta halka arz" gibi **olay** takvimi yok.
Temettü takvimi var — yani takvim arayüz deseni zaten kurulu (`dividends`), yeni
takvimler aynı bileşene oturur.

**Rakipte:** Fintables ve Investing.com'da ekonomik takvim + halka arz takvimi;
Matriks'te halka arz takip ekranı + bildirim.

**Maliyet:** Ekonomik takvim için EVDS/TCMB duyuru takvimi düşük maliyetli;
bilanço takvimi KAP'tan türetilebilir; halka arz takvimi kazıma gerektirir
(en pahalısı, en son yapılmalı).

### 6. Alarmlar yalnızca uygulama açıkken çalışıyor

**Durum:** Alarmlar `new Notification(...)` ile React içinde değerlendiriliyor
(`App.jsx`) — yani sekme kapalıysa hiçbir şey olmuyor. Üstelik veri günde iki kez
güncellendiği için "fiyat X'i geçti" alarmı pratikte **gün sonu** alarmı.
Kullanıcıya bu sınır açıkça söylenmiyor.

**Rakipte:** Sunucu tarafı alarm + mobil push.

**Maliyet:** Orta. Sunucusuz mimariyi bozmadan yapılabilir yol: alarmlar Telegram
botuna taşınır (kod hazır — `app/notify/`, `scripts/notify_telegram.py`), kullanıcı
botu ekleyip sembol/eşik yazar, tarama sonrası GitHub Actions içinde değerlendirilir.
Kısa vadede en azından arayüzde "alarmlar yalnızca site açıkken ve gün sonu verisiyle
çalışır" uyarısı yazılmalı — bugün bu vaat sessizce fazla söz veriyor.

### 7. Cihazlar arası senkron yok

**Durum:** Favoriler, portföy, strateji pozisyonları, alarmlar, kayıtlı taramalar —
hepsi `localStorage`. Telefonda eklenen portföy bilgisayarda görünmüyor. Yedek
al/yükle var ama elle.

**Değerlendirme:** Bu **kasıtlı** bir tasarım (sunucu yok, veri bizde değil) ve
"Hakkında" sayfasında dürüstçe yazıyor. Gizlilik açısından güçlü bir duruş.
Ama Play Store'a çıkma hedefi varsa, kullanıcı telefona geçtiğinde her şeyini
kaybediyor demektir. Ara çözüm: yedeği tek satır **paylaşılabilir koda** (sıkıştırılmış
metin / QR) çevirmek — sunucu gerektirmez, cihaz değiştirmeyi çözer.

### 8. SEO: hisse başına sayfa yok

**Durum:** `sitemap.xml` ve `robots.txt` CI'da üretiliyor, günlük HTML raporlar
statik yayınlanıyor — altyapı **var**. Ama sitemap'te 30 URL var ve 28'i tarih
damgalı rapor. `/hisse/THYAO`, `/fon/AFA` gibi kalıcı sayfa yok; derin bağlantı
`?v=…&s=…` sorgu parametresi (SPA), Google için indekslenebilir içerik değil.

**Sonuç:** İnsanlar "THYAO teknik analiz", "AFA fonu getiri" diye arıyor; bu
sorgular için sitede hedef sayfa yok. Organik trafik kanalı fiilen kapalı.

**Maliyet:** Orta. Rapor üreticisi (`app/reports/generate.py`) zaten statik HTML
yazabiliyor — aynı hat sembol başına sayfa üretmek için kullanılabilir
(fiyat + sinyal durumu + temel oranlar + son haberler). 100 hisse = 100 sayfa,
tarama başına yeniden üretilir.

### 9. Seans içi veri yok

**Durum:** Günde iki kez tarama (BIST kapanışı sonrası ~18:45, ABD kapanışı sonrası
~00:15). Statik yayında "Canlı Tara" butonu gizli.

**Değerlendirme:** Strateji gereği bu doğru bir tercih — kapanış mumuna dayalı
sinyal üretiliyor, seans içi veri sinyali değiştirmez. Gerçek eksik veri değil,
**beklenti yönetimi**: fiyat kolonu "şu anki fiyat" gibi duruyor ama dünün
kapanışı. Kolon başlığında/ipucunda tarih göstermek yeterli.

### 10. Yabancı takas oranı / takas analizi yok

**Durum:** Yok.

**Rakipte:** Yaygın; BIST yatırımcısının sık baktığı göstergelerden
([takas analizi](https://algodirekt.com/algoritma/bilgi-merkezi/takas-analizi)).

**Maliyet:** Orta — MKK/Takasbank verisi ücretsiz API ile gelmiyor, kazıma gerekiyor.
Etki/maliyet oranı 1-4 arasındaki maddelerden düşük; sonraya bırakılmalı.

### 11. Analist hedef fiyat / tavsiye konsensüsü yok

**Durum:** Yok. Haber filtresi "hedef fiyat listesi" başlıklarını **eliyor** bile.

**Değerlendirme:** yfinance `.info` içinde `targetMeanPrice` / `recommendationKey`
alanları BIST için çoğu zaman boş; güvenilir kaynak ücretli. Düşük öncelik —
ama S&P tarafı açık olduğu için ABD hisselerinde bedavaya gelir.

### 12. Yayın kanalları duruyor: Telegram/X botu ve Play Store

**Durum:** Bot kodu hazır, secret eklenene kadar workflow adımları sessizce
atlanıyor. Play yol haritasının 1. adımı bitmiş, 2–7 duruyor.

**Değerlendirme:** Bunlar teknik eksik değil, **dağıtım eksiği** — ürün iyi ama
kimse görmüyor. Kod tarafında yapılacak iş yok, hesap/token işi var. Etki/emek
oranı en yüksek maddelerden biri: bir öğlen sonu iş.

### 13. Dokümantasyon kayması: README "S&P 500 KAPALI" diyor, açık

**Durum:** README'nin "Etkin Marketler (S&P 500 şu an KAPALI)" başlıklı bölümü
güncelliğini yitirmiş. Kod (`app/core/config.py`) ve yayındaki
`data/markets.json` ikisi de `["bist100", "sp500", "commodity"]`.

**Maliyet:** Dakikalar. Ama README bu projenin tek dokümantasyonu olduğu için
yanlış kalması pahalı: kapsam kararlarının hepsi o bölüme dayanıyor.

### 14. Tek veri kaynağı riski

**Durum:** Fiyat, temel oran, temettü — hepsi yfinance. Resmi API değil;
rate-limit ve tutarsızlık riski README'de kabul edilmiş, `repair.py` ile bölünme
artefaktları onarılıyor, `fundamentals_enabled` ile temel veri kapatılabiliyor.

**Değerlendirme:** Risk yönetilmiş ama tek bacaklı. Kapsam tüm BIST'e açılırsa
istek hacmi ~2 katına çıkacağı için rate-limit olasılığı da artar. `BaseFetcher`
soyutlaması hazır — ikinci bir kaynak (ör. BIST/İş Yatırım verisi) eklemek için
mimari engel yok.

---

## Bizde olup rakiplerde olmayanlar

Eksik listesi tek başına yanıltıcı olur; şu maddeler rakiplerin çoğunda yok ve
korunmalı:

- **Strateji backtest'i + portföy simülasyonu** — sinyalin geçmişte ne kazandırdığını
  ölçüp gösteren, üstelik pozisyon kapasitesi kısıtını modelleyen bir tarama aracı
  nadir. Çoğu site sinyali verir, hesabını vermez.
- **Risk-ayarlı fon metrikleri** (Sortino, Calmar, Jensen alfası, beta) — TEFAS
  sitelerinin çoğu getiri tablosunda kalıyor.
- **Fon hisse pozisyonları** (KAP raporlarından) — "bu fon aslında ne tutuyor?"
  sorusuna cevap veren az sayıda yerden biri.
- **Ücretsiz ve reklamsız** — sayılan rakiplerin neredeyse hepsi abonelik.
- **Veri kalitesi titizliği** — bölünme onarımının dar koşulu, tamamlanmamış mumun
  düşürülmesi, likidite tabanı. Bunlar rakip sitelerde sessizce yanlış çıkan yerler.

---

## Önerilen sıra

Ölçüt: kullanıcının başka siteyi açma sebebini kaldırma / harcanan emek.

**1. dalga — kapsam ve dürüstlük (kod işi, birkaç gün)**
1. Resample refaktörü (sembol başına 4 istek → 1)
2. Tüm BIST'e açılma (~700 sembol, likidite filtresi zaten koruyor)
3. README'deki S&P kayması + alarm/fiyat tazeliği uyarıları

**2. dalga — birincil veri (orta, en yüksek ürün etkisi)**
4. KAP şirket bildirimleri akışı
5. Reel getiri (TCMB EVDS TÜFE) — portföy ve fonlarda
6. Bilanço özet kalemleri (net kâr/satış/özsermaye, çeyreklik seri)

**3. dalga — dağıtım ve büyüme (kod işi az, hesap işi çok)**
7. Telegram/X botlarını yayına alma (token)
8. Hisse başına statik sayfa (SEO)
9. Play Store paketleme (TWA)

**Sonraya:** ekonomik/halka arz takvimi, yabancı takas oranı, analist konsensüsü,
cihazlar arası senkron, ikinci veri kaynağı.

---

### Kaynaklar
- [Fintables](https://fintables.com/) · [Radar](https://fintables.com/radar) · [Screening rehberi](https://fintables.com/arastirma/yazilar/yatirim-stratejileri/fintables-ile-sceening-rehberi-hisse-filtreleme-ve-secim-sureci)
- [Tabvendor](https://www.tabvendor.com/) · [StocKeys](https://www.stockeys.com/) · [Finkap](https://finkap.com.tr/) · [F-Ray](https://f-rayscoring.com/)
- [Investing.com halka arz takvimi](https://tr.investing.com/ipo-calendar/) · [Garanti BBVA halka arz takvimi](https://www.garantibbvayatirim.com.tr/halka-arz-takvimi)
- [Borsada kaç şirket var (Pusula Yatırım)](https://pusulayatirim.com.tr/blog/borsada-kac-sirket-var) · [SPK halka açılan şirket sayısı](https://spk.gov.tr/ihrac-verileri/halk-acilan-sirket-sayisi)
- [KAP bildirim sorgu](https://kap.org.tr/tr/bildirim-sorgu) · [kap-notifier](https://github.com/cahitihac/kap-notifier) · [KAP_Notifications](https://github.com/alperaydyn/KAP_Notifications)
- [TCMB EVDS](https://apideposu.com/tr/catalog/tcmb-evds) · [EVDS Python paketi](https://github.com/fatihmete/evds) · [borsapy](https://github.com/saidsurucu/borsapy)
- [Yabancı takas oranı](https://www.finanskaynak.com/yabanci-takas-orani-nedir-hisse-yatiriminda-stratejik-gosterge/) · [Takas analizi](https://algodirekt.com/algoritma/bilgi-merkezi/takas-analizi)
- [En iyi borsa uygulamaları (Tamindir)](https://www.tamindir.com/blog/borsa-uygulamalari_74247/)
