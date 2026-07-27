# AlphaBoard Ürün, Büyüme ve Hacim Raporu

**Site:** https://www.alphaboard.xyz/  
**Kapsam:** Ürün/UX, mobil deneyim, SEO, kullanıcı edinimi, aktivasyon, işlem dönüşümü, kullanıcı tutma ve gelir modeli.  
**Çalışma biçimi:** Yalnızca inceleme ve planlama yapıldı; canlı üründe değişiklik yapılmadı.

## 1. Yönetici özeti

AlphaBoard genel bir kripto panelinden ziyade ciddi bir veri ürünü görünümünde. Görsel kimliği güçlü, veri kapsamı geniş, yasal sayfaları mevcut ve Polymarket’e giden bağlantılar `ref` parametresi taşıyor. Ancak bu `ref`, Builder emir atfı değil; uygun yeni kullanıcı kayıtları için referral mekanizmasıdır. En önemli büyüme darboğazı özellik eksikliği değil, **analiz ile AlphaBoard’a atfedilen eşleşmiş emir arasındaki köprünün eksik olmasıdır**.

Ürün bugün marketleri, trader’ları ve işlemleri iyi gösteriyor; fakat şu soruları tutarlı biçimde cevaplamıyor:

> “Şimdi neyi incelemeliyim, bu neden önemli ve nereden işlem yapmalıyım?”

Ana sayfadaki “Discover, follow and copy…” vaadi, görünür dönüşüm akışından daha güçlü. Hero bölümünde birincil CTA bulunmuyor, leaderboard satırlarında sonraki aksiyon açık değil ve market kartları kullanıcıyı AlphaBoard’a ait bir karar sayfası göstermeden dışarı gönderiyor.

Önerilen konumlandırma:

> **AlphaBoard, Polymarket’in smart-money karar katmanıdır: sinyali keşfet, doğrula ve işleme geç.**

Yakın vadede tam kapsamlı bir uygulama içi borsa kurulmamalı. Önce şu akış kanıtlanmalı:

**X / arama / paylaşım kartı → AlphaBoard market veya trader sayfası → kanıt ve bağlam → açık işlem CTA’sı → ölçülen outbound referral → daha sonra `builderCode` kullanan dar kapsamlı emir akışı → Builder-attributed matched volume.**

## 2. Canlı siteden elde edilen bulgular

### Güçlü taraflar

- Güçlü ve ayırt edilebilir terminal temalı marka dili.
- World Cup, Leaderboard, Wallet Checker, Markets, Activity, Liquidity ve Insights gibi net ürün yüzeyleri.
- Kategori filtreleri ve 24 saatlik hacim, toplam hacim, likidite, kapanış zamanı ve yenilik sıralamaları.
- Market kartlarında outcome fiyatı, hacim, likidite ve kalan süre bilgileri.
- Leaderboard’da P&L, hacim ve Smart Score verileri.
- World Cup Hub; paylaşım bağlantıları, görsel kartlar ve canlı market bağlamıyla event-specific acquisition için güçlü bir örnek.
- Privacy, Terms ve Disclaimer sayfaları mevcut.
- `robots.txt`, canonical URL’ler ve sitemap mevcut.
- Market outbound bağlantıları AlphaBoard `ref` değerini taşıyor.
- Tekil ağ testinde ana sayfa yaklaşık 0,26 saniyede yanıt verdi. Bu ölçüm gerçek kullanıcı performans izlemesinin yerine geçmez.

## 3. P0 — Hemen düzeltilmesi gereken sorunlar

### 3.1 Mobil görünüm belirgin biçimde bozuk

390×844 ekran görüntüsünde:

- Hero başlığı ve destekleyici metin yatay olarak kesiliyor.
- Masaüstü genişliğindeki paneller viewport dışına taşıyor.
- Smart Money ve platform istatistikleri ekran genişliğini aşıyor.
- Yatay taşma/scroll oluşuyor.
- Mobil header’da ana navigasyon görünmüyor.
- Büyük boş veya loading alanları ilk ekranın önemli kısmını kaplıyor.
- `overflow-x-hidden`, temel layout sorununu çözmek yerine taşan içeriği gizliyor.

Bu hem büyüme hem gelir problemidir. X ve Telegram’dan gelen trafiğin büyük kısmı mobildir; kullanıcı market veya işlem bağlantısına ulaşmadan kaybedilebilir.

### 3.2 Ölçülebilir analiz → işlem akışı yok

- Homepage hero’da görünür bir birincil CTA bulunmuyor.
- “Get Alerts” öne çıkıyor; fakat “Explore Markets”, “Analyze a Wallet” veya “See Smart Money” gibi ilk aksiyonlar yok.
- Market kartları dışarı bağlanıyor; ancak açık ve güven verici bir “Trade on Polymarket” aksiyonu görünmüyor.
- Kullanıcı, önce AlphaBoard karar sayfası görmeden yoğun bir listeden doğrudan Polymarket’e gönderiliyor.
- Leaderboard keşif için güçlü; fakat satır seviyesinde “View Positions”, “Track Trader” veya “Markets They Trade” gibi sonraki aksiyonlar görünür değil.

### 3.3 Referral ve Builder attribution aynı şey değil

Polymarket’in resmi dokümantasyonu şu ayrımı doğruluyor:

- `ref=` bağlantıları uygun yeni kullanıcı kayıtlarını ve referral ödüllerini atfeder.
- `builderCode`, AlphaBoard üzerinden gönderilen emre eklenmelidir. Eşleşen emir hacmi daha sonra Builder profiline yazılır.
- Outbound bağlantı tıklaması veya kullanıcının daha sonra Polymarket üzerinde işlem yapması, tek başına Builder-attributed volume anlamına gelmez.

**Aşama 1:** Sayfa/sinyal → market → outcome → outbound tıklama → kaynak/kampanya akışını ölç.

**Aşama 2:** En yüksek işlem niyetli birkaç yüzeyde dar kapsamlı ve non-custodial emir bileti test et. Emirlerde `builderCode` kullan; matched-order, slippage ve hata telemetrisi ekle.

Nihai north star, referral tıklaması değil **Builder-attributed matched volume** olmalıdır.

### 3.4 Blog içerikleri soft-404

`/blog` altındaki dört yazı kartı HTTP 200 dönmesine rağmen `Post Not Found` gösteriyor, `<h1>Post Not Found</h1>` içeriyor ve canonical olarak `/blog` kullanıyor:

- `/blog/polymarket-lp-guide`
- `/blog/smart-score-explained`
- `/blog/detecting-whale-activity`
- `/blog/market-microstructure`

Bu durum iç link değerini boşa harcar, kullanıcı güvenini zedeler ve arama motorlarına soft-404 sinyali verir. Yazılar geri getirilmeli veya kartlar kaldırılmalı; içerik yoksa gerçek 404/410 dönülmelidir.

### 3.5 Alerts/Watchlist vaadi ürünle uyuşmuyor

FAQ, hesapların watchlist ve custom alert için kullanıldığını söylüyor. Canlı üründe ise watchlist `localStorage` üzerinde tutuluyor. “Get Alerts” kullanıcıyı genel bir Telegram kanalına yönlendiriyor ve kişisel wallet alert’lerinin yakında geleceğini belirtiyor.

Metinler ve mevcut fonksiyon aynı gerçeği anlatmalı. Finansal analiz ürününde çalışmayan veya henüz mevcut olmayan kişiselleştirme vaadi güven kaybı yaratır.

## 4. P1 — Yüksek öncelikli ürün bulguları

- Homepage “follow and copy” diyor; fakat ilk ekranda bunun nasıl çalıştığı gösterilmiyor.
- Smart Score önemli bir farklılaştırıcı, ancak metodoloji ve veri güncelliği kullanım noktasında açıklanmıyor.
- Büyük P&L ve hacim değerlerinde veri kaynağı, dönem ve realized/unrealized ayrımı görünür olmalı.
- Çok sayıda ürün yüzeyi var; ancak ana job-to-be-done yeterince net değil. Yeni ziyaretçi ürünü bağlantısız dashboard koleksiyonu olarak algılayabilir.
- “Trades (1h)” metriği belirsiz: toplam Polymarket işlemi mi, izlenen feed mi, yoksa AlphaBoard kaynaklı işlem mi?
- Doğrudan Polymarket event bağlantıları dönüşüm için yararlı olsa da AlphaBoard SEO’su ve retention için zayıf; kullanıcı eşsiz AlphaBoard içeriğini tüketmeden ayrılıyor.
- Watchlist yalnızca aynı tarayıcıda tutulduğu için cihazlar arası devamlılık yok.
- Genel Telegram kanalı, kişiselleştirilmiş retention mekanizmasının yerini tutmuyor.

## 5. SEO ve teknik bulgular

### Mevcut güçlü taraflar

- İncelenen temel rotalar HTTP 200 döndü.
- Ana sayfalarda farklı title, description, canonical ve `index, follow` metadata mevcut.
- Sitemap ve robots dosyaları çalışıyor.
- HSTS, `X-Content-Type-Options`, `X-Frame-Options`, referrer policy ve permissions policy header’ları mevcut.
- `/watchlist` index dışı bırakılmış.

### 5.1 Programatik SEO yüzeyi küçük

Sitemap yalnızca 16 üst seviye URL içeriyor. Şunlar bulunmuyor:

- çalışan bireysel blog yazıları
- bireysel market/event sayfaları
- public trader profil sayfaları
- public wallet analiz sayfaları
- kategori ve konu landing page’leri

Bu durum long-tail arama talebinin Polymarket veya diğer analiz araçlarına gitmesine neden oluyor.

Önerilen indexlenebilir sayfa türleri:

- `/market/[event-slug]`
- `/trader/[wallet-or-username]`
- `/wallet/[address]`
- `/topics/politics`
- `/topics/crypto`
- `/topics/sports`
- tekrar kullanılabilir event hub’ları
- stable canonical URL’ye sahip seçilmiş public wallet raporları

Her filtre kombinasyonu indexlenmemeli. Yalnızca eşsiz veri/bağlam taşıyan ve istikrarlı talebi olan sayfalar indexlenmelidir.

### 5.2 Sosyal paylaşım görselleri eksik veya hatalı

Homepage ve World Cup Hub OG görseli sunuyor; fakat incelenen ürün sayfalarının çoğunda sayfaya özel `og:image` bulunmuyor. Homepage `twitter:image` hedefi olan `/opengraph-image` canlı denetimde 404 döndü.

Her market, trader, wallet ve insight sayfası test edilmiş, veri destekli sosyal karta sahip olmalıdır.

### 5.3 Structured data kapsamı yetersiz

Ana ürün sayfalarında JSON-LD tespit edilmedi. Yalnızca sayfayla gerçekten eşleşen schema’lar kullanılmalı:

- `WebApplication`
- `BreadcrumbList`
- `FAQPage`
- çalışan editoryal sayfalarda `Article`

Soft-404 blog sayfalarındaki schema geçerli içerik olarak değerlendirilmemelidir.

### 5.4 Sitemap kalitesi

Tüm sitemap kayıtları aynı `lastmod` zamanını kullanıyor ve değişim sıklıkları geniş biçimde tanımlanmış. Gerçek değişiklik zamanları üretilmeli. Blog yazıları yalnızca çalışır hâle getirildikten sonra sitemap’e eklenmelidir.

### 5.5 Accessibility

- Markets arama alanında server HTML içinde `aria-label` tespit edilmedi.
- Market görsellerinin çoğunda alt metin boş veya eksik. Dekoratif görseller `alt=""` kullanabilir; anlamlı takım/market görselleri etiketlenmelidir.
- `/compare` server HTML içinde H1 göstermiyor.
- Ortak page shell içinde accessible name’i olmayan boş bir button bulunuyor.
- Mobilde bölüm etiketleri ve ikincil metinlerin kontrastı/okunabilirliği zayıf.

### 5.6 Performans riski

Yaklaşık server HTML boyutları:

- Homepage: ~50 KB
- Markets: ~349 KB
- World Cup Hub: ~1,03 MB

World Cup Hub güçlü bir acquisition varlığıdır; ancak 1 MB server HTML açık bir optimizasyon hedefidir. İlk yüklenen veri azaltılmalı, ikincil modüller ertelenmeli ve gerekirse pagination/virtualization kullanılmalıdır.

Tam Lighthouse denemesi yerel browser/runtime hatası nedeniyle tamamlanamadı; public PageSpeed endpoint’i de rate limit’e takıldı. Bu nedenle Core Web Vitals tahmin edilmemeli, gerçek kullanıcı ölçümü kurulmalıdır.

### 5.7 Güvenlik sertleştirmesi

Homepage yanıtında Content Security Policy bulunmadı. Büyüme açısından ilk öncelik değildir; sonraki security pass içinde ele alınmalıdır.

## 6. Ürün stratejisi: AlphaBoard’u karar motoruna dönüştürmek

### Birincil kullanıcı

Önce prediction market mantığını bilen ve daha hızlı, daha bilinçli karar vermek isteyen aktif Polymarket trader’ına odaklanılmalı. Ürün aynı anda yeni başlayanlar, profesyonel market maker’lar ve casual spor kullanıcıları için optimize edilmemelidir.

### Temel ürün döngüsü

1. **Keşfet:** Olağandışı odds hareketi, whale işlemi, güçlü trader pozisyonu veya event hub.
2. **Doğrula:** Likidite/spread, trader geçmişi, position concentration, recent flow ve veri güncelliği.
3. **Harekete geç:** Açık Yes/No veya “Trade on Polymarket” CTA’sı. AlphaBoard `builderCode` içeren ve eşleşen emir göndermediği sürece bunu Builder volume değil referral/outbound intent olarak değerlendir.
4. **Takip et:** Marketi kaydet, trader’ı takip et veya alert oluştur.
5. **Geri dön:** Kişiselleştirilmiş watchlist/digest yeni hareketleri gösterir.
6. **Paylaş:** Veri destekli kart AlphaBoard karar sayfasına bağlanır.

## 7. Önceliklendirilecek ürün sayfaları

### A. Market karar sayfası

Her market/event sayfasında şunlar bulunmalı:

- canlı outcome fiyatları ve değişimler
- 24 saatlik hacim, likidite ve spread
- smart-money aktivitesi
- pozisyon taşıyan güvenilir/kârlı trader’lar
- whale alış/satışları ve son para akışı
- resolution tarihi/kaynağı
- veri güncelleme zamanı
- kısa risk ve bağlam notu
- açık işlem CTA’sı
- watch, alert ve share aksiyonları

Bu sayfa X postlarının, SEO sayfalarının, alert’lerin ve market kartlarının hedefi olmalıdır.

### B. Trader profil sayfası

Her public trader sayfasında:

- P&L metriğinin tanımı ve kaynağı
- dönem filtreleri
- açık ve kapanmış pozisyonlar
- kategori uzmanlığı
- ortalama giriş, concentration ve son değişimler
- Smart Score metodoloji tooltip’i
- “Track Trader” ve “View Markets They Trade” aksiyonları

Ürün kör copy-trading olarak konumlandırılmamalı. Daha güvenli ve değerli vaat:

> “Başarılı trader’ların ne yaptığını incele ve doğrula.”

### C. Event hub şablonu

World Cup sayfası tekrar kullanılabilir bir şablona çevrilmeli:

- seçimler ve tartışmalar
- Fed/CPI kararları
- kripto fiyat hedefleri
- büyük spor turnuvaları ve finaller
- yüksek hacimli breaking-news kümeleri

Her etkinlik için manuel bir sayfa yazılmamalı. Bir kez yapılandırılabilir template hazırlanmalı ve yalnızca gerçek talep olan event’lerde açılmalıdır.

## 8. Görünürlük ve dağıtım planı

### X’i yalnız sosyal kanal değil, ürün kanalı olarak kullan

Yalnızca AlphaBoard verisinden üretilebilecek içerikler paylaşılmalı:

- son saatin en büyük smart-money hareketi
- hacim ve likidite bağlamıyla en büyük odds değişimi
- yüksek Smart Score’lu wallet’ın pozisyon değişimi
- “market aktif görünüyor ama likidite zayıf” uyarısı
- büyük event öncesi event-hub özeti
- resolution sonrası trader doğruluk analizi
- LP Vacancy Radar ve reward/crowding değişimi

Her post doğrudan Polymarket’e değil ilgili AlphaBoard market/trader/LP sayfasına bağlanmalı. AlphaBoard bu sayfada bağlamı, retention aksiyonunu ve referral dönüşümünü sahiplenmelidir.

Önerilen @alphaboardxyz ritmi:

- günde 1 yüksek sinyalli canlı veri postu
- anlamlı hareket olduğunda 2–3 event-driven post
- haftada 1 leaderboard veya performans özeti

Genel “bugünün top marketleri” listeleri, non-obvious insight taşımıyorsa yayınlanmamalıdır.

### SEO ve içerik

Büyük, genel bir blog yerine canlı ve kendini güncelleyen utility page’ler önceliklendirilmeli. Blog içerikleri ürün döngüsünü desteklemeli:

- Smart Score nasıl hesaplanır → leaderboard/trader sayfaları
- Polymarket likiditesi nasıl değerlendirilir → Liquidity Hub/market sayfaları
- market-specific açıklamalar → event sayfası
- trader vaka çalışmaları → public trader profili
- LP crowding/vacancy vaka çalışmaları → alert ve maker akışı

AlphaBoard’un daha savunulabilir içerik alanı genel “Polymarket nedir?” yazıları değil, Liquidity Hub verileridir:

- liquidity rewards
- max incentive spread
- min incentive size
- LP reward calculator
- maker vs taker
- reward crowding ve vacancy

### Ortaklıklar

Ölçülebilir dağıtım ortaklarıyla başlanmalı:

- Polymarket odaklı creator ve newsletter’lar
- event-specific topluluklar
- trading/analytics Discord’ları
- wallet ve portfolio araçları
- whale/wallet analistleri
- market-maker ve LP toplulukları

Her ortağa özel campaign/ref source ve co-branded landing page verilmeli. Impression yerine qualified visit, activation ve gerçekleşen hacim ölçülmelidir.

Ekosistem dizinleri:

- Awesome Prediction Market Tools
- pm.wiki
- Prediction market proje dizinleri
- Polymarket Builder Leaderboard
- ilgili GitHub awesome listeleri

Listeleme mesajı genel “analytics” yerine farklılaşmış olmalı:

> **Real reward-pool LP analytics + smart-money wallet tracking for Polymarket.**

## 9. Retention planı

“Get Alerts” ana retention mekanizmasına dönüşebilir; ancak alert’ler kişiselleştirilmiş ve aksiyona dönük olmalıdır.

İlk alert tipleri:

- takip edilen trader pozisyon açtı, kapattı veya önemli ölçüde değiştirdi
- yapılandırılabilir eşik üzerindeki whale trade
- minimum hacim/likidite koşuluyla X puandan büyük odds değişimi
- spread veya likidite hedefe ulaştı
- LP vacancy oluştu
- reward/crowding oranı iyileşti
- market kapanışına veya resolution’a yaklaştı

Kanal sırası:

1. Telegram
2. Email digest
3. Daha sonra browser notification

Her alert ilgili AlphaBoard karar sayfasına deep-link vermelidir. Kullanıcı doğrudan AlphaBoard dışına gönderilmemelidir.

Önerilen günlük kişisel özet:

- takip edilen wallet işlemleri
- market/pozisyon fiyat değişimleri
- kaçırılan büyük hareketler
- iki seçilmiş market veya LP fırsatı
- her satırda tek aksiyon

## 10. Gelir modeli sırası

1. **Referral geliri ve Builder-attributed matched volume:** Ayrı mekanizmalar olarak yönetilmeli. Referral link’leri uygun yeni kullanıcı signup’larını monetize eder; Builder volume, AlphaBoard’un `builderCode` taşıyan emir göndermesini gerektirir.
2. **AlphaBoard Pro:** Gelişmiş alert’ler, daha fazla takip edilen trader/market, daha uzun geçmiş, export ve power filter’lar.
3. **API planları:** Yalnızca gerçek dış talep ve destek/rate-limit ihtiyacı kanıtlandıktan sonra.
4. **Sponsorlu alanlar:** Açıkça etiketlenmeli; ranking veya Smart Score’u asla etkilememeli.

Şimdilik tam kapsamlı trading terminal yapılmamalı. Outbound işlem niyeti ölçüldükten sonra whale activity ve LP opportunity gibi bir veya iki yüksek niyetli yüzeyde dar kapsamlı non-custodial ticket test edilmelidir.

İleride test edilebilecek fiyatlandırma:

- manuel market/limit order: 0 bps
- replicate/copy kolaylığı: düşük ve açık ücret
- maker/LP emirleri: likidite büyümesi için başlangıçta sıfır veya çok düşük ücret
- Pro alert: wallet/alert sayısı, anlık bildirim, webhook ve export üzerinden değer merdiveni

## 11. Ölçüm çerçevesi

### Nihai north star

**Haftalık AlphaBoard Builder-attributed matched volume.**

AlphaBoard `builderCode` ile emir göndermeye başlayana kadar `outbound_trade_click` ve uygun referral dönüşümleri ara proxy olarak kullanılmalı; bunlar Builder volume olarak adlandırılmamalıdır.

### Destekleyici funnel metrikleri

- qualified landing visit
- market/trader detail view oranı
- outbound trade click-through rate
- outcome selection oranı
- alert activation oranı
- D1/D7/D30 returning-user oranı
- qualified visitor başına intent/hacim
- sayfa türü, kaynak, kampanya ve kategori bazında performans
- share-card visit → trade-click dönüşümü
- Builder pilotundan sonra matched-order rate ve matched volume
- order failure ve slippage oranı

### Minimum event şeması

- `market_impression`
- `market_open`
- `trader_open`
- `outcome_selected`
- `outbound_trade_click`
- `alert_created`
- `watchlist_add`
- `share_click`
- Builder pilotundan sonra `matched_order`
- Builder pilotundan sonra `order_failed`

Event’ler sayfa, market/event, biliniyorsa outcome, kaynak, kampanya, sinyal türü ve ref varyantını taşımalıdır. Gereksiz wallet veya kullanıcı verisi toplanmamalıdır.

### Kaçınılması gereken vanity metrikler

- toplam pageview
- X impression
- toplam kayıt
- toplam wallet araması
- gönderilen alert sayısı

Bunlar ancak activation, retention veya atfedilen hacimle ilişkilendirildiğinde anlamlıdır.

## 12. Önceliklendirilmiş yol haritası

### İlk 14 gün — Funnel’ı kanıtla

1. Mobil overflow, kesilen hero, mobil navigasyon ve above-the-fold loading sorunlarını düzelt.
2. Homepage’e “Explore Markets” ve “Analyze a Wallet” CTA’larını ekle.
3. Market kartlarında açık trade aksiyonu ve üçüncü taraf/ref disclosure göster.
4. Core event’leri enstrümante et; günlük funnel dashboard’u kur.
5. Tüm outbound market bağlantılarında doğru ref ve campaign context bulunduğunu doğrula.
6. Veri kaynağı, freshness ve metric definition tooltip’leri ekle.
7. Dört soft-404 blog yazısını geri getir veya kaldır. Yalnızca çalışır durumda olduklarında sitemap’e ekle.
8. FAQ/watchlist/alerts metinlerini mevcut `localStorage` ve genel Telegram davranışıyla hizala.
9. Kırık `twitter:image` hedefini düzelt; ürün sayfalarına test edilmiş OG görselleri ekle.
10. `/compare` H1 ve accessibility sorunlarını düzelt.

### Gün 15–45 — Landing page’i sahiplen

1. İlk tekrar kullanılabilir `/market/[slug]` karar sayfasını yayınla.
2. Public trader profil sayfalarını yayınla.
3. X kartlarını, alert’leri ve market kartlarını AlphaBoard içi sayfalara yönlendir.
4. “Track Trader”, “Watch Market” ve kişiselleştirilmiş Telegram/email alert’leri ekle.
5. Binlerce thin page yerine 10–20 yüksek talep sayfası oluştur.
6. Hangi sayfa türünün en yüksek outbound CTR ve activation ürettiğini ölç.
7. İşlem niyeti kanıtlanırsa `builderCode` ve matched-order verification kullanan dar kapsamlı non-custodial emir bileti pilotu yap.
8. Liquidity Hub için vaka çalışması + alert + maker-order döngüsü test et.

### Gün 46–90 — Dağıtımı bileşik hâle getir

1. World Cup Hub’ı tekrar kullanılabilir event-hub sistemine dönüştür.
2. Yalnızca kanıtlanmış talep olan katalizörlerde hub yayınla.
3. @alphaboardxyz için insan onaylı günlük veri-content loop kur.
4. Campaign attribution ile creator/community ortaklıkları test et.
5. AlphaBoard Pro ödeme isteğini hafif waitlist/paywall deneyiyle test et.
6. Dar kapsamlı emir pilotu başarılıysa Replicate Trade akışını dene.
7. Builder profili, Leaderboard görünürlüğü ve uygunluk sağlanırsa Verified Builder sürecini değerlendir.
8. Ham trafik yerine activated user ve matched volume’a göre optimize et.

## 13. Şimdilik yapılmaması gerekenler

- Outbound funnel ve dar Builder pilotu kanıtlanmadan tam kapsamlı native trading terminal.
- Net sonraki aksiyonu olmayan yeni bağımsız dashboard’lar.
- Şeffaf metodoloji ve validasyon olmadan genel AI trade signal’ları.
- Binlerce thin SEO sayfası.
- Public data ve on-demand cache ile çözülebilecek ilk sürüm için pahalı indexer altyapısı.
- Attribution güvenilir çalışmadan geniş affiliate/creator programı.
- Genel, ürün döngüsüne bağlanmayan blog içerik fabrikası.

## 14. Son karar

İlk geliştirme sprint’i yeni bir analytics modülü değil:

> **Mobil + Ölçüm + Market CTA + Soft-404/Trust düzeltmeleri**

olmalıdır.

İlk sprint başarı kriteri:

> Mobil kullanıcı X postundan gelir, insight’ı anlar, ilgili AlphaBoard market bağlamını açar ve açıkça etiketlenmiş trade CTA’sına tıklar. AlphaBoard tüm intent yolunu kaydeder; referral tıklamasını yanlış biçimde Builder volume olarak adlandırmaz.

Orta vadeli ürün hedefi:

> **Smart-money ve LP sinyalini → alert’e → outcome seçimine → `builderCode` taşıyan eşleşmiş emre bağlayan kısa ve ölçülebilir bir döngü kurmak.**

İlk farklılaşmış hacim motoru olarak **Liquidity Hub + Vacancy Radar** güçlü bir adaydır. Daha az kalabalık bir ürün/SEO alanında yer alır, gerçek ödül havuzlarına dayanır ve doğrudan maker hacmi üretme potansiyeline sahiptir. İkinci hacim motoru, wallet/trader sayfalarından düşük sürtünmeli **Replicate Trade** akışıdır.
