# AlphaBoard Tasarım Audit Raporu

Tarih: 2026-06-06
Kapsam: Renkler, logo, tema, tipografi, layout, UI tutarlılığı, sayfa/component incelemesi.

## Kısa karar

AlphaBoard tasarım olarak iyi bir temele sahip. Dark fintech / crypto analytics hissi net: siyah zemin, violet accent, glassmorphism kartlar, veri odaklı tablolar ve terminal benzeri küçük label dili tutarlı. Genel skor: **7.6 / 10**.

Site şu an “çalışır ve şık” seviyesinde. Ancak “premium product / yatırımcıya güven veren analytics platformu” seviyesine çıkması için bazı görsel kararları sadeleştirmek ve sistemleştirmek gerekiyor.

## Skorlar

| Alan | Skor | Not |
|---|---:|---|
| Genel görsel kalite | 8/10 | Dark + violet identity güçlü. |
| Renk sistemi | 7.5/10 | Violet iyi, fakat yeşil/sarı/emoji accent’ler biraz dağınık. |
| Logo/brand | 7/10 | Asset kalitesi iyi; navbar’da logo kullanımı sade ama wordmark potansiyeli kullanılmıyor. |
| Tipografi | 7/10 | Inter/JetBrains/Syne/Playfair var; hero’da serif güzel ama site genelinde font rolleri tam netleşmemiş. |
| Layout/spacing | 8/10 | Max-width, grid, card rhythm iyi. Bazı legal/content sayfaları ana dashboard kadar premium değil. |
| Dashboard UI | 8/10 | Glass cards, tables, charts dili tutarlı. |
| Mobile/nav | 7.5/10 | Responsive nav iyi; nav link sayısı artınca ürün hiyerarşisi biraz kalabalık. |
| Premium/güven hissi | 7/10 | Legal/footer var; fakat social/contact placeholder ve bazı external handle’lar marka güvenini zayıflatabilir. |
| Accessibility | 6.8/10 | Düşük opacity text yoğun; bazı metinler white/20-white/30 seviyesinde okunurluk riski taşıyor. |
| Genel UX | 7.5/10 | Veri platformu hissi güçlü; ama PnL metrik ayrımları görsel olarak daha net anlatılmalı. |

## Güçlü taraflar

1. **Net dark identity:** `#030507` arka plan, violet token sistemi ve glass component’ler AlphaBoard’u fintech/crypto analytics alanına iyi oturtuyor.
2. **Tutarlı violet marka dili:** `--vi-*` token’ları iyi başlangıç. Navbar, kartlar, aktif nav, gradient borders aynı ailede.
3. **Veri ürünü hissi:** Monospace küçük label’lar, tabular numbers, leaderboard/table yapısı ve sparkline kullanımı doğru.
4. **Logo asset seti hazır:** `alphaboard-logo`, mark, purple mark, wordmark, 192/512 varyasyonları mevcut.
5. **Footer/legal mevcut:** Finans/crypto ürünü için disclaimer/footer bulunması önemli artı.
6. **Modern component dokusu:** Glass, subtle glow, gradient border ve dark cards genel olarak kaliteli duruyor.

## Ana sorunlar

### 1. Renk sistemi biraz fazla “accent-heavy”

Violet ana renk iyi. Fakat site genelinde:

- violet/purple
- green
- yellow
- amber
- rose
- emoji badge’ler
- gold/silver/bronze gradients

çok sık karışıyor. Bu analytics platformunda normal ama şu risk var: ekran premium/product hissinden biraz “gaming dashboard” hissine kayabilir.

Öneri:

- Violet = marka/primary action
- Emerald = sadece profit/success
- Rose = sadece loss/error
- Amber = sadece warning/disclaimer
- Yellow/star = mümkünse azaltılmalı veya daha nötr hale getirilmeli

### 2. Logo potansiyeli tam kullanılmıyor

Navbar’da sadece logo mark + text kullanılıyor. Dosyada `alphaboard-logo-wordmark.png` var ama kullanılmıyor. Şu an yazı CSS ile basılıyor:

```tsx
AlphaBoard
Analytics
```

Bu temiz ama marka karakteri biraz zayıf kalıyor.

Öneri:

- Desktop navbar’da wordmark varyasyonu denenebilir.
- Mobile’da sadece mark kalabilir.
- Footer’da da wordmark kullanılabilir.
- Favicon/manifest tarafında purple mark doğru tercih.

### 3. Tipografi rolleri netleşmeli

Şu fontlar var:

- Inter: gövde
- JetBrains Mono: numeric/terminal
- Syne: display token olarak tanımlı
- Playfair Display: hero serif

Ama ana hero `Playfair` kullanıyor, `Syne` pek görünür kullanılmıyor. Bu kötü değil, fakat tasarım sistemi açısından karar netleşmeli:

Seçenek A — Premium editorial fintech:
- Hero: Playfair
- UI/body: Inter
- Numbers/code: JetBrains Mono

Seçenek B — Modern SaaS/dashboard:
- Hero: Syne
- UI/body: Inter
- Numbers/code: JetBrains Mono

Bence AlphaBoard için **Seçenek B daha iyi** olabilir. Çünkü ürün veri/analytics ürünü; Playfair biraz “editorial/blog” hissi katıyor.

### 4. Düşük opacity metinler okunurluk riski taşıyor

Çok fazla `text-white/20`, `text-white/25`, `text-white/30`, `rgba(255,255,255,.22)` var. Dark UI’da estetik görünür ama kullanıcı uzun süre veri okuyacaksa yorabilir.

Öneri minimum text seviyeleri:

- Ana metin: `text-white/75` veya üstü
- Secondary: `text-white/50`
- Tertiary/label: `text-white/35`
- Dekoratif: `text-white/20`

Şu an bazı gerçek bilgiler `white/25-30` seviyesinde.

### 5. Nav biraz kalabalık

Navbar linkleri:

- Wallet Checker
- Leaderboard
- Markets
- Activity
- Liquidity
- Insights
- FAQ

Ürün büyüdükçe iyi ama ilk kullanıcı için seçenek çok. En kritik aksiyonlar daha önde olmalı.

Öneri:

Desktop:
- Leaderboard
- Wallet Checker
- Markets
- Activity
- Insights
- More dropdown: Liquidity, FAQ, Blog, API Docs

CTA:
- “Track Wallet” veya “Search Wallet” daha güçlü olabilir.
- “Get Alerts” yeşil Telegram butonu görsel olarak markadan kopuyor; violet/neutral yapılabilir, sadece icon Telegram rengi kalabilir.

### 6. Content/legal sayfaları dashboard kadar premium değil

`about`, `api-docs`, `privacy`, `terms`, `disclaimer` sayfaları doğru ama dashboard sayfalarındaki zengin hero/card sistemi kadar premium görünmeyebilir.

Öneri:

- Tüm content sayfaları için ortak `PageHero` component’i.
- Ortak `ContentCard` / `LegalNoticeCard` component’i.
- Aynı section heading sistemi: `[01]`, terminal label, gradient line.

### 7. PnL metrikleri görsel olarak ayrılaştırılmalı

Bu tasarımdan çok ürün güveni konusu. Ama UI’da çok önemli.

Öneri:

- `Polymarket P&L` ve `Net PnL Estimate` farklı renk/tooltip sistemiyle ayrı gösterilmeli.
- Kartlarda source badge olmalı:
  - `Official Polymarket`
  - `Predicts-compatible estimate`
  - `Position-capped`
- Eğer data capped ise kartın köşesinde küçük warning icon/badge.

## Önerilen tasarım yönü

AlphaBoard için en uygun referans kombinasyonu:

1. **Linear / Vercel** — minimal, keskin, premium dark SaaS.
2. **Kraken / Coinbase** — fintech güveni, daha az oyunlaştırma.
3. **Sentry** — data-dense dashboard, status colors kontrollü.

Yani hedef:

```txt
Dark premium analytics dashboard
violet primary identity
minimal glow
less emoji
strong data hierarchy
```

## Öncelikli iyileştirme planı

### Phase 1 — Hızlı tasarım temizlikleri, 0.5-1 gün

1. Renk token sistemini genişlet:
   - `--color-success`
   - `--color-danger`
   - `--color-warning`
   - `--surface-1/2/3`
   - `--border-subtle/default/strong`
2. Düşük opacity metinleri normalize et.
3. Telegram `Get Alerts` butonunu markaya daha uyumlu yap.
4. Watchlist yıldız/emojisini daha premium icon ile değiştir veya sadeleştir.
5. Footer social linklerini gerçek planned handle ile uyumlu hale getir; şu an `alphaboard`, planlanan handle `AlphaBoardXYZ` olabilir.

### Phase 2 — Brand polish, 1-2 gün

1. Navbar’da wordmark varyasyonu dene.
2. Logo hover glow’u biraz azalt.
3. Hero typography kararını netleştir: Syne mı Playfair mı?
4. Ortak `PageHero` ve `SectionHeader` component’leri çıkar.
5. Legal/about/api-docs sayfalarını ortak premium layout’a geçir.

### Phase 3 — Data trust UI, 1-2 gün

1. PnL source badge sistemi.
2. Tooltip/help text standardı.
3. `capped`, `official`, `estimated`, `fallback` state’leri için görsel sistem.
4. Wallet sayfasında metriklerin hiyerarşisini yeniden düzenle:
   - Polymarket P&L
   - Net PnL Estimate
   - Portfolio Equity
   - Position Value

### Phase 4 — Full visual refresh, 3-5 gün

1. Dashboard ve wallet sayfasında daha rafine chart/card layout.
2. Table density modes: compact / comfortable.
3. Light microinteractions azalt/sadeleştir.
4. Blog ve marketing tarafına daha premium landing feel.

## Tasarım karar önerim

Şu an komple redesign gerekmiyor. Mevcut tasarım iyi. En doğru yol:

```txt
Redesign değil, design-system polish.
```

Yani:

- Mevcut dark/violet tema korunmalı.
- Renkler sadeleştirilmeli.
- Logo/wordmark daha iyi kullanılmalı.
- Typography rolleri netleşmeli.
- Veri güveni için badge/tooltip sistemi kurulmalı.
- Content sayfaları dashboard seviyesine çekilmeli.

## Final değerlendirme

AlphaBoard tasarım olarak pazara çıkabilecek seviyeye yakın. Büyük eksik “güzel görünmüyor” değil; daha çok:

1. Fazla accent/emoji kullanımı
2. Bazı düşük kontrast metinler
3. Logo/brand potansiyelinin az kullanılması
4. Content sayfalarının dashboard kadar premium olmaması
5. Veri kaynağı/metrik güveninin UI’da yeterince anlatılmaması

Bunları düzeltirsek site 7.6’dan rahatlıkla **8.7-9.0** seviyesine çıkar.
