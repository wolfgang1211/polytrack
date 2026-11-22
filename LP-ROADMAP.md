# AlphaBoard — LP/Maker Odaklı Yol Haritası (2026-07-12)

Konumlandırma: **"Polymarket LP'lerinin Bloomberg'i."** Rakipler (polymarketanalytics,
hashdive, whale takipçileri) trader/copy-trade tarafında yığılmış durumda; hiçbirinde
**zaman-serisi likidite verisi** yok. Bizim hendeğimiz 10 dakikalık snapshot serisi
(liq/spread/rate, 1100 kayıt) + onun üstüne kurulmuş backtest/vacancy/validate katmanı.
Öne çıkma stratejisi: bu hendeği görünür, günlük-alışkanlık yapan ve paylaşılabilir
araçlara çevirmek.

## Faz 1 — Hendeği günlük alışkanlığa çevir (1-2 hafta)

1. **Farm Δ Feed'i — "Dün neler değişti?"** *(bu session'da yapılıyor)*
   Snapshot serisinden türetilen değişim akışı: yeni açılan farm'lar, biten
   programlar, ödül havuzu artış/azalışları (≥%20), likidite boşalması/dolması
   (≥%30). LP'nin her sabah ilk bakacağı ekran; verisi sadece bizde var.
   `/api/liquidity/changes` + `[03b]` section.

2. **Vacancy/Farm Telegram alarmları.** "Get Alerts" + TelegramModal altyapısı
   duruyor. Tetikleyiciler Farm Δ ve Vacancy Radar'dan: "X farm'ında likidite
   %40 boşaldı, tahmini payın 2.3×" / "yeni $1K/gün havuz açıldı". Retention'ın
   ana motoru; cron zaten var.

3. **Validate UI açıklaması.** LH-C bulgusu ürüne yansısın: `real ≤ 0` iken
   "spread zararı normal — farm LP'si gelirini ödül havuzundan alır, o fill
   tape'inde görünmez" notu + matchedVolumePct'in öne çıkarılması.

## Faz 2 — Karar araçları (2-4 hafta)

4. **LP Deploy Wizard.** Sermaye gir → coverage-ağırlıklı güven skoruyla 3-5
   farm'lık dağıtım önerisi (Calculator + Opportunities + Backtester birleşimi),
   "planı kopyala" çıktısı. Tek sayfalık sihirbaz; dönüşüm noktası.

5. **Market detay sayfası (`/markets/[slug]`).** Şu an yok — hem SEO boşluğu hem
   LP değeri: snapshot serisinden liq/spread/rate tarihi grafiği, reward takvimi,
   derinlik, o marketin aktif maker istatistikleri. Her market = indekslenebilir
   landing.

6. **Cüzdan LP karnesi.** Wallet sayfasındaki LP Earnings'e sim tarafını ekle:
   spread P&L (gerçek) + tahmini reward geliri (validate motoru) = toplam LP
   P&L. Kimsede yok; "LP olarak gerçekten ne kazandım?" sorusunun tek cevabı.

## Faz 3 — Dağıtım ve savunma (4+ hafta)

7. **Public data API + embed kartları.** Snapshot/backtest uçlarını api-docs'ta
   belgele, market-embed widget'ı ver (backlink motoru). Veri hendeği ancak
   herkes ona referans verirse markalaşır.

8. **Farm geçmişi arşivi.** MAX_SNAPSHOTS penceresi dışına taşan veriyi günlük
   özetlere sıkıştırıp kalıcı arşive al (Upstash ayrı key / R2). "6 aylık farm
   tarihi" kimsenin kopyalayamayacağı varlık olur.

9. **Model v2.** Validate bulgularıyla reward modelini kalibre et: uptime,
   two-sidedness, spread-tightness parametreleri; backtest'e güven aralığı.

10. **Yapay zekâ arama optimizasyonu (GEO).** _(eklendi 2026-11-22)_
    Amaç: ChatGPT, Claude, Perplexity gibi asistanlar Polymarket/Kalshi likidite
    ve LP ödülleri sorulduğunda AlphaBoard'u önersin.
    Mevcut durum (2026-11-22 incelemesi): `/liquidity` tamamen istemci tarafında
    (useEffect + fetch) yükleniyor; JS çalıştırmayan AI tarayıcıları rakam görmüyor.
    robots herkese açık ama AI botlarını adıyla anmıyor; sitemap `lastModified`
    her istekte "şimdi"; schema yalnız Organization + WebSite.

    - **Öncelik 0 — Kapıları aç (yarım gün):** robots'ta AI tarayıcılarına
      (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User,
      Claude-SearchBot, PerplexityBot, Perplexity-User) açık izin, `/api/` kapalı
      kalır; Vercel Firewall'da AI bot engeli olmadığını kontrol (Yusuf); sitemap'te
      gerçek güncelleme tarihleri; `llms.txt`.
    - **Öncelik 1 — İlk cevap sayfası (2-3 gün):** ör. `/polymarket-lp-rewards`
      "Polymarket Liquidity Rewards: Highest-Paying Markets (Updated Daily)".
      Sunucuda render + 30-60 dk ISR; ilk paragrafta rakamlı ve UTC tarihli özet
      cümlesi; HTML tablo, metodoloji, görünür "Last updated", 4-6 soruluk SSS;
      FAQPage + Dataset + BreadcrumbList schema, `dateModified`. Bayat veride
      açık uyarı; eksik değer asla 0 gösterilmez (Polymarket outcome fiyatındaki
      `'0'` fallback'i önce düzeltilir). Ürün metinleri İngilizce.
    - **Öncelik 2 — Genişlet:** "How Polymarket liquidity rewards work" (resmi
      dokümana atıflı kalıcı anlatım), "Best Polymarket markets for market makers"
      (spread/derinlik, SSR), "Polymarket vs Kalshi liquidity" (Kalshi teşvik
      iddiaları doğrulanmadan yok); `/liquidity` üstüne SSR özet blok + iç linkler.
    - **Öncelik 3 — Ölç ve dağıt (sürekli):** Vercel Analytics'te chatgpt.com /
      perplexity.ai / claude.ai referrer'ları; ayda bir sabit 10 soruyu üç
      asistana sorup kaydet; cevap sayfasını X, Reddit, Polymarket toplulukları,
      GitHub/API dokümanında paylaş (asistanlar site dışı bahsedilmelere de bakar).

## Diğer bölümlerin eksikleri (LP dışı, fırsat sırasıyla)

- **Markets:** detay sayfası yok (Faz 2/5 kapatıyor) — explorer polymarket'e link veriyor.
- **Watchlist:** sadece cüzdan; farm/market watchlist yok → Farm Δ + alarmlarla birleşince anlamlanır.
- **Compare:** LP metrikleri yok (maker volume, LP karnesi karşılaştırması eklenebilir).
- **Insights:** Faz 2 (trend timeline, smart money consensus) diğer session'da ilerliyor — çakışmamak için dokunulmuyor.
- **Activity:** maker/taker ayrımı gösterilmiyor; "büyük maker fill'leri" filtresi ucuz ve LP hikâyesine bağlanır.

## Sıralama gerekçesi

Alışkanlık (Δ feed + alarm) → karar (wizard + karne) → dağıtım (API/embed/SEO/GEO).
Önce geri gelme sebebi, sonra para kararı verdiren araç, en son herkese duyuran katman.
