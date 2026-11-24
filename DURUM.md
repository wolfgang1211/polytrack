# AlphaBoard Analytics | DURUM

- Güncelleme: 2026-11-23T11:50+03:00
- Proje klasörü: `C:/Users/wolfgang/polytrack`
- Son oturum: Cowork (Claude Opus 5.5), Hermes'ten devir. Yusuf bu turda commit, `cowork/kalshi` branch'ine push ve Vercel preview deploy'una açıkça izin verdi; production, main'e merge ve dosya silme hâlâ onaya bağlı.
- Çalışma sırası: **ONAY BEKLİYOR** (açık iş yok).

## Şu anki aşama
main `c9f99ce` canlıda: önceki yayınlar + site geneli kontrast düzeltmeleri (iki temada da Markets sayfasında WCAG AA altı metin yok).

## Son yapılan iş ve kanıt (2026-11-21)
- Yerel 3016 kapalıydı, bu oturumdan Windows'ta süreç başlatılamadı. Yerel 45 dosya birebir (SHA1 eşleşmesi) `cowork/kalshi` → commit `b2aabee`, Vercel preview READY.
- Gerçek tarayıcı (Claude masaüstü yerleşik tarayıcı) sonuçları:
  - Hydration: **GEÇTİ** (konsol hatası 0, native details ve filtreler istemci tarafında çalışıyor).
  - Geri-ileri: **GEÇTİ** (URL, select değerleri, sonuç sayısı, More filters açık/kapalı her adımda eşleşti; sayfa yeniden yüklenmedi).
  - Mobil 375px taşma: **GEÇTİ** (Polymarket, Discover, Kalshi detay; scrollWidth = 375).
  - Kontrast: ilk ölçüm **KALDI** (Kalshi quote etiketleri 2.5–3.0:1) → commit `9464e80` ile düzeltildi; tekrar ölçümde Kalshi alanında AA altı öğe kalmadı.
  - Dokunma hedefleri: **KISMİ**, yalnız dilim dışı global header/breadcrumb/Polymarket CTA 32–42px.
- Test: 545/545, tsc exit 0, lint 0 hata/25 uyarı, diff-check exit 0, Vercel build READY.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-market-ui-20261119/BROWSER-ACCEPTANCE-20261121.md`
- Preview: https://polytrack-git-cowork-kalshi-wolfgang37s-projects.vercel.app/markets?platform=kalshi&view=discover (Vercel korumalı; Yusuf'un Vercel oturumuyla açılır).
- Yerel çalışma kopyası düzeltmeyle güncellendi; yerel main'e commit atılmadı.

## Ziyaretçi analitiği (2026-11-21, branch `cowork/analytics`, main tabanlı)
- Commit `9f593f0`: `@vercel/analytics` 2.0.1 + kök layout'ta `<Analytics />`; `ClarityScript` yalnız production build'de ve `NEXT_PUBLIC_CLARITY_ID` geçerliyse yüklenir, ID koda yazılmadı. Do Not Track / GPC açıksa Clarity yüklenmez. Unmask/identify/custom tag yok, Clarity'nin varsayılan metin girişi maskelemesi açık kalır. Gizlilik sayfasına iki araç ve maskeleme eklendi.
- Test: yeni `tests/visitor-analytics.test.cjs` önce RED (5 fail), sonra tüm suite 172/172 (main tabanı). tsc exit 0, lint 0 hata/25 uyarı, diff-check exit 0, Vercel build READY. package-lock yalnız yeni paket girdisiyle güncellendi (`npm ci` geçti).
- Preview: https://polytrack-git-cowork-analytics-wolfgang37s-projects.vercel.app — gerçek tarayıcıda Vercel Analytics script'i 200, `/view` beacon 200 (Web Analytics projede açık görünüyor). Clarity yüklenmedi: beklenen, çünkü ID henüz yok.
- Yerel Windows kopyasına uygulanmadı (yerel main + Kalshi değişiklikleri ayrı; yeni paket yerelde kurulu değil).

## Yayın 2 (2026-11-22, Yusuf onayıyla) ve GEO Öncelik 0
- `cowork/kalshi` main'e merge edildi (`5a0bbc5`), ardından `994245f`: LP-ROADMAP.md'ye madde 10 "Yapay zekâ arama optimizasyonu (GEO)" eklendi; gizlilik metninde Clarity "etkinleştirilirse" diye düzeltildi (Clarity çalışmıyor). 551/551 test, tsc/lint/diff-check temiz. Production `dpl_4YxbRHbUJMDiM2wr6kA7Zke3FRcN` READY.
- Canlı doğrulama: www.alphaboard.xyz/markets?platform=kalshi&view=discover açılıyor (12 event kartı), Polymarket varsayılanı korunuyor, Vercel Analytics script/view 200, Clarity yok.
- React #418: konsol aracı aynı hatayı her sayfada tek kayıt olarak gösteriyor; /privacy'de sunucu HTML'i ile canlı DOM metni birebir aynı çıktı. Kayıt bayat olabilir; önceki production'da da vardı. Ayrı, kısa bir inceleme işi olarak açık.
- GEO Öncelik 0 (`cowork/geo-p0`): robots'ta 8 AI tarayıcısına açık izin (/api/ ve /watchlist yine kapalı), sitemap'te canlı sayfalar "şimdi", editoryal sayfalar sabit gerçek tarih (git geçmişine karşı test), blog yazıları eklendi, `public/llms.txt`. Önce RED (5 fail), sonra 556/556; tsc/lint/diff-check temiz.
- Yerel Windows kopyası: main artık Kalshi+analytics içeriyor; yerel çalışma kopyası eski main üzerinde, aynı Kalshi dosyaları commit'siz duruyor. Yerelde `git pull` öncesi bu değişikliklerin temizlenmesi gerekecek (dosya silme onayı gerektirir).

## Yayın 3 ve yerel klasör (2026-11-22, Yusuf onayıyla)
- GEO Öncelik 0 main'e fast-forward (`994245f` → `c4fa7f7`), production `dpl_6rg1957JR8xmNZERmS4PABSdKHVu` READY. Canlı kontrol: robots.txt 8 AI tarayıcısına izinli ve `/api/` iki grupta da kapalı; sitemap.xml 19 adres (4 blog); llms.txt 200.
- Yerel klasör: silme yapılmadı. Eski `C:/Users/wolfgang/polytrack` → `C:/Users/wolfgang/polytrack-eski` olarak yeniden adlandırıldı (içerik, `.env.local`, `.hermes/`, `node_modules`, `.next` orada duruyor). Yeni `C:/Users/wolfgang/polytrack` GitHub main'den temiz kopya.
- Yeni klasörde yerel çalıştırma için Yusuf'un yapacakları: eski klasörden `.env.local` dosyasını kopyalamak (gizli bilgi içerdiği için Claude dokunmadı) ve `npm install` çalıştırmak. Gerekirse `.hermes/` da eski klasörden alınabilir.

## Clarity açıldı (2026-11-22, Yusuf onayıyla)
- Yusuf Vercel'e `NEXT_PUBLIC_CLARITY_ID` (Production + Preview) ekledi; Claude'un Vercel bağlantısının env ekleme/okuma yetkisi yok (403).
- Preview (`cowork/clarity-check`, boş commit `7333cea`) ve production yeniden derlemesi (`0b7940f`, `dpl_DbocfVBLsnVU5FRTmanNK5hXK6pW`) sonrası canlı kontrol: www.alphaboard.xyz/markets'te Clarity tag'i (`zhqjwr7lqg`) yüklü, çalışma zamanı aktif, `data-clarity-unmask` yok; Vercel Analytics `/view` devam ediyor.
- Gizlilik sayfası Clarity'yi kullanılan araç olarak anlatacak şekilde güncellendi (maskeleme ve DNT/GPC notu korunuyor).
- Clarity panelinde Masking "Balanced/Strict" kalmalı (Yusuf). AB ziyaretçileri için çerez onayı banner'ı yok; gerekirse ayrı iş.

## GEO Öncelik 1 — cevap sayfası (2026-11-22, branch `cowork/geo-p1`, preview)
- `b82979f`: Polymarket kartlarında eksik/boş/sayısal olmayan outcome fiyatı artık "—"; gerçek 0 hâlâ 0¢ (`parseFloat(prices[i] ?? '0')` hatası). Önce RED test.
- `7cbe39f` + `7da7e6d` + `ed6832e`: `/polymarket-lp-rewards` sunucuda render (ISR 15 dk). Polymarket'in yayımladığı günlük ödül havuzu, max spread, min size; ilk paragrafta rakamlı ve UTC tarihli özet; görünür "Last updated"; yöntem (tarama kapsamı, maç/3 gün filtresi, <1$/gün havuzlar hariç) açık; 6 soruluk SSS (Polymarket dokümanıyla kontrol); FAQPage + Dataset + BreadcrumbList JSON-LD; veri gelmezse "temporarily unavailable", asla sıfır; 60 dk'dan eski önbellekte istemci uyarısı. Sitemap, llms.txt, breadcrumb, sayfa grubu ve `lp_rewards_page` outbound yerleşimi bağlandı.
- Gerçek preview verisinde bulunan iki sorun düzeltildi: 1$ altı "dust" havuzlar "$0.00" görünüyordu (artık listelenmiyor), Polymarket'in süresiz havuz tarihi 2500-12-31 artık "No end date".
- Doğrulama: 564/564 test, tsc exit 0, lint 0 hata/25 uyarı, diff-check temiz, Vercel preview READY. Preview'da JS'siz HTML'de özet + 11 satırlık tablo + 6 SSS + 3 JSON-LD; konsol hatası yok; 375px'te taşma yok, kontrast eşiği altında metin yok.
- Preview: https://polytrack-git-cowork-geo-p1-wolfgang37s-projects.vercel.app/polymarket-lp-rewards

## Yayın 4 ve ödül sayfası tam kapsam (2026-11-22)
- Yusuf onayıyla `cowork/geo-p1` main'e (`5943cbb`), production `dpl_4RyPniYvD3QefW8k2sYRfNB3XgdT` READY; canlıda sayfa açılıyor, sitemap'te.
- `cowork/lp-rewards-all` (`8390566`, `db6196c`), preview: kaynak artık Polymarket CLOB `rewards/markets/current` (tüm ödüllü piyasalar, 500/sayfa, sayfa başına 3 deneme + 10 sn zaman aşımı; eksik sayfa = "Partial data", ilk sayfa yok = "temporarily unavailable"). Maç/kısa vade filtresi bu sayfada yok. İlk 50 satır için Gamma meta tek istekte. "Closes / starts" sütunu: maçlarda başlama saati ("Starts in 2h" / "Game started"; Polymarket'in maç endDate'i başlama saati), diğerlerinde "in 5h / in 3d / tarih / Awaiting resolution". Günlük ödül sponsorlu ödülleri içerir; <1$/gün havuzlar hariç.
- Ölçüm (preview, 22 Kasım ~19:20 UTC): 7.778 ödüllü piyasa, 6.609'u ≥1$/gün, toplam ≈189.800$/gün; en büyük havuz 15.771$/gün (NFL maçları). Sunucuda tam tarama 16 sayfa / 659 ms (build log, iad1); İstanbul'dan tarayıcıyla ~11 sn. Ziyaretçi: TTFB 43 ms, DOMContentLoaded 0,8 sn, load 1,1 sn, HTML 18 KB sıkıştırılmış (164 KB açık); önbellekten tekrar istek 63–115 ms. Konsol hatası yok.
- Test: 567/567, tsc exit 0, lint 0 hata/25 uyarı, diff-check temiz.
- Preview: https://polytrack-git-cowork-lp-rewards-all-wolfgang37s-projects.vercel.app/polymarket-lp-rewards

## Yayın 5 ve "Longer-term markets" (2026-11-22/23)
- Yusuf onayıyla tam kapsamlı ödül sayfası main'e (`e32ca66`), production `dpl_6cc1BVMvbJDT7aQLQAdH51mhb9eB` READY; canlıda 6.625 piyasa, 50 satır, "Closes / starts" sütunu.
- `cowork/lp-rewards-longterm` (`d9934a4`, `73a8d51`), preview: ana tablo aynen duruyor; altına "Longer-term markets" (kapanışı snapshot'tan 7 günden fazla sonra, maçlar ve tarihi bilinmeyenler hariç, günlük ödüle göre ilk 25). Meta, sıralamada aşağı doğru 50'lik gruplarla 25 uygun bulunana kadar çekiliyor (ana tablodan sonra en fazla 1.000 piyasa); not satırı kaç havuzun kontrol edildiğini yazıyor, sınıra takılırsa belirtiyor. 7 günden uzak kapanışlar artık iki tabloda da tarih olarak görünüyor ("in 7d" çelişkisi giderildi).
- Preview doğrulaması: 2 tablo (50 + 25), ikinci tabloda tüm kapanışlar 7 günden uzak tarih, ilk 100 havuz kontrolünde 25 bulundu; konsol hatası yok. 571/571 test, tsc exit 0, lint 0 hata/25 uyarı.
- Preview: https://polytrack-git-cowork-lp-rewards-longterm-wolfgang37s-projects.vercel.app/polymarket-lp-rewards

## Yayın 6 (2026-11-23, Yusuf onayıyla)
- `cowork/lp-rewards-longterm` main'e (`0964751`), production `dpl_5QbP73nKuPrxnjtMcq8PC8VavHKG` READY. Canlı kontrol: 2 tablo (50 + 25), ikinci tablo notu "Top 25 found among the 100 largest pools checked.", konsol hatası yok.

## Hydration (React 418) ve anlatım sayfası (2026-11-23, branch `cowork/hydration-geo2`, preview)
- İnceleme: önceki "her sayfada #418" görüntüsü eski konsol kaydıydı; temiz sekmede 9 sayfa + iki tema ayarı + dakika sınırına zamanlanmış 2 yükleme ile canlıda yeniden üretilemedi. Kodda kaynak: `MarketsClient` "Xm left" etiketleri ve süresi geçmiş piyasa filtresi render sırasında `Date.now()` ile hesaplanıyordu (lint de uyarıyordu). Sunucu ve tarayıcı farklı anda okuyunca dakika sınırında metin değişip 418 verir; 1 saatten kısa kalan maçlar varken aralıklı olur.
- `f942328`: sayfa render zamanını (`serverNow`) istemciye geçiriyor; `src/lib/useNow.ts` SSR ve hydration'da bu değeri, sonra dakikalık tarayıcı saatini kullanıyor. Test: istemci saati 2 ve 30 dk kaysa da aynı props aynı HTML'i veriyor (önce RED). Lint uyarısı 25 → 24. Canlıda tekrarlanamadığı için "düzeltildi" kanıtı test ve kod incelemesine dayanıyor; başka bir kaynak çıkarsa ayrıca bakılacak.
- `71a005e`: `/how-polymarket-liquidity-rewards-work` sunucuda render; ilk paragraf doğrudan cevap; uygunluk, üç parametre, puan formülü S(v,s)=((v−s)/v)²×b, iki taraflı kural (c=3, 0,10–0,90), dakikalık örnekleme → günlük ödeme (1.440 örnek, UTC gece yarısı, 1$ alt sınır), pratik sonuçlar, riskler, 5 SSS. Örnek rakamlar `src/lib/lpRewardsMath.ts` ile hesaplanıyor (0,44 / 0,11 / 30 / 60 / 0 / 5$). Polymarket dokümanına 2 atıf; `/polymarket-lp-rewards` ile çift yönlü link. Article + FAQPage + BreadcrumbList; sitemap (2026-11-23), llms.txt, breadcrumb, sayfa grubu.
- Doğrulama: 578/578 test, tsc exit 0, lint 0 hata/24 uyarı, diff-check temiz; preview'da iki sayfada konsol hatası yok, JSON-LD 3 tip, canonical doğru.
- Preview: https://polytrack-git-cowork-hydration-geo2-wolfgang37s-projects.vercel.app/how-polymarket-liquidity-rewards-work

## Yayın 7 (2026-11-23, Yusuf onayıyla)
- `cowork/hydration-geo2` main'e (`ae14861`), production `dpl_ChjjcKR7jfcE1dTBFccx8ydkYf5t` READY. Canlı kontrol: anlatım sayfası açılıyor (Article + FAQPage + BreadcrumbList, tarih 2026-11-23), sitemap ve llms.txt'de, ödül tablosundan linkli; anlatım ve /markets sayfalarında konsol hatası yok.

## Site geneli kontrast (2026-11-23, Yusuf "testler geçerse doğrudan yayına al" dedi)
- `7bb8972`: Breadcrumb (ink/30 11px → ink/55 text-xs, son öğe ink/80, 24px dokunma alanı, ayraç dekoratif), TopMarkets "YES / 24h Vol / 24h Volume" (ink/25 10px → ink/55 text-xs), "Trade on Polymarket" 32/40px → 44px ve "External link · Referral may apply" (ink/35 9–10px → ink/55 text-xs).
- Canlı ölçümde açık temada ink/55'in açık zeminde ~4,0:1 kaldığı görüldü (68 farklı metin). `79c475e`: açık temada ink/50-55-60 → %64 (~5:1); koyu tema aynı. `d5d7892` + `c9f99ce`: kategori etiketleri sabit pastel hex yerine `--cat-*` tema değişkenleri; açık temada koyu tonlar (Crypto 4,31 → 6,07).
- Son canlı ölçüm (www.alphaboard.xyz/markets, 375px, Featured açık, her tema sıfırdan yüklenerek): koyu 1.288 metin / 0 eşik altı; açık 1.288 / 0. CTA'lar 44px, yatay taşma yok. 583/583 test, tsc exit 0, lint 0 hata/24 uyarı. Yeni test: `tests/global-contrast.test.cjs`.

## Leaderboard, wallet, liquidity kontrastı (2026-11-23, Yusuf "testler geçerse yayına al" dedi)
- İlk ölçüm (375px): koyu temada leaderboard 2,0–3,5:1 (ink/25–40, 8–10px), wallet 18 grup 2,1–3,9:1, liquidity 26 grup + 90px yatay taşma; açık temada parlak yeşil/kırmızı/sarı/mavi vurgular 1,2–2,9:1, liquidity puan ipucu açık temada koyu zeminde okunmuyordu.
- Wallet 503: 0x5668…5839 tekrar denendi, 3/3 HTTP 200; geçici upstream hatasıydı, kod hatası bulunmadı.
- Commit'ler (hepsi main, production READY): `8ca5d70` (18 dosyada ink/≥55, en az 10px, soluk inline renkler, kopyala 24px, Back to Leaderboard 24px ve /leaderboard'a gider, FarmChanges mobil), `2d5d12b` (liquidity seçici çipler, trader tablosu ve select 375px'e sığar), `2bd21e9` + `de266e9` (açık temada vurgu renkleri 700–800 tonlarına, `--success/--danger/--warning/--info` açık değerleri, leaderboard istatistik renkleri tema değişkeni), `f10de89` (açık tema ipucu/grafik tooltip zemini `--surface-1`, liquidity başlığı mobil, izleme butonu), `fa54f66` (tüm liquidity bölüm başlıkları mobilde sığar, cyan açık tema). Son production: `dpl_Hd1s5j38kjVharGgggjQb7BiUQNw`.
- Son canlı ölçüm (www.alphaboard.xyz, 375px, her tema sıfırdan): leaderboard koyu 530/0, açık 530/0; wallet koyu 254/0, açık 254/0; liquidity koyu 783/0, açık 783/0 eşik altı metin; yatay taşma 0, 24px altı dokunma alanı 0.
- Testler 591/591, tsc exit 0, lint 0 hata/24 uyarı, git diff --check temiz. Yeni testler `tests/global-contrast.test.cjs` içinde.
- Not: açık tema renk eşlemesi `globals.css` içinde inline stil seçicileriyle (`[style*="color:#34d399"]`) yapılıyor; yeni bileşenlerde sabit hex yerine `var(--success)` vb. kullanmak daha sağlam.

## Kalshi tam liste + Polymarket görünümü (2026-11-24 gece, branch `cowork/kalshi-unify`, YALNIZ PREVIEW)
- Yusuf "Kalshi'yi de tamamen listeleyebiliyoruz, başla" dedi. Yayına alınmadı; onay bekliyor.
- Veri: Kalshi GET /markets hacme göre sıralamıyor. Yeni `src/lib/kalshiTop.ts` tüm açık piyasaları tarar (status=open, mve_filter=exclude, limit=1000). Etkinlikleri 24s kontrat hacmine (tüm işlem gören piyasaların toplamı) göre sıralar, ilk 60 etkinliği ve her birinin en çok işlem gören 4 sonucunu tutar. `unstable_cache` ile 15 dk önbellek (`kalshiTopCache.ts`, anahtar v3), maxDuration 120 s, tarama bütçesi 100 s; erken durursa sayfa "Partial scan" ve nedenini yazar.
- Ölçüm (preview, 2026-11-23 21:49 UTC): 176.996 açık piyasa, 177 sayfa, tam tarama ~44 s; son 24 saatte 22.403 piyasa / 5.591 etkinlik işlem görmüş; 60 kartın hepsinde kategori dolu.
- Görünüm: `/markets?platform=kalshi&view=top` (Kalshi'nin yeni varsayılanı) Polymarket ile aynı çerçeve: başlık, arama, sıralama (24h Volume / Open Interest / Closing Soon), kategori çipleri, 3 sütun kart, Yes/No fiyat kutuları (ask; ask yoksa "bid" etiketiyle bid), "contracts" birimi, kapanan etkinlik gizlenir. Kart düğmesi AlphaBoard içindeki etkinlik/piyasa sayfasına gider (kontrol: 3/3 HTTP 200). Discover, Newest (eski "Markets") ve Events sekmeleri duruyor.
- Ek: açık temada yeşil/kırmızı fiyat yazıları koyulaştırıldı (Polymarket kartları da düzelir).
- Commit'ler: 6daf45b, da0d60f, 3d2e005, ea032dc, 84fb0fa, 845e153 (yeniden build: geçici Google Fonts hatası), 446204c. Testler 607/607, tsc 0, lint 0 hata/24 uyarı, diff-check temiz. Yeni testler: `tests/kalshi-top.test.cjs`, `tests/kalshi-top-ui.test.cjs`; test yükleyicisi artık göreli TS importlarını çözüyor.
- Tarayıcı kontrolü (Chrome, masaüstü genişliği): koyu ve açık temada kart/metin kontrastı uygun, taşma yok. **375 px mobil görsel kontrol yapılamadı**: Chrome penceresi daraltılamadı, yerleşik tarayıcı preview alan adı için onay istiyor. Kısmi.
- Bilinen risk: önbellek dolarken ilk ziyaretçi ~45 s bekleyebilir (her 15 dakikada bir, arka planda yenilenir).

### Gün içi ek (2026-11-24, aynı dal, hâlâ YALNIZ PREVIEW)
- Bulgu: önbellek uzun süre ziyaretsiz kalınca ilk ziyaretçi eski listeyi görüyordu ("updated 12 h ago"). Düzeltme: liste 30 dakikadan eskiyse sayfa "refreshing…" yazar, `/api/kalshi/top`'u 20 sn arayla en fazla 4 dk sorar, yeni tarama gelince listeyi değiştirir. API CDN önbelleği 30 sn.
- Kontrast ve dokunma alanı: ana sayfa, /activity, /insights, /blog ve blog yazısı (10 dosya; ink/≥55, en az 10px, soluk inline renkler kalktı). Ek düzeltmeler: /activity ısı haritası kutuları iki temada opak koyu zemin + beyaz yazı, SELL rozeti, sıra numaraları ve ana sayfa/insights istatistik renkleri tema değişkenlerine geçti, insights "Coming Soon" kartlarındaki %50 saydamlık kaldırıldı, koyu temada kırmızı fiyat gradyanı açıldı. Sitemap `/blog` tarihi 2026-11-24.
- Son ölçüm (preview, 375 px, her tema sıfırdan): `/`, `/activity`, `/insights`, `/blog`, blog yazısı, `/markets` (Polymarket), `/markets?platform=kalshi&view=top`: koyu ve açık temada eşik altı metin 0 (yalnız dekoratif "/" ayırıcı), yatay taşma 0, 24 px altı dokunma alanı 0.
- Commit'ler: 98fe2ad, 8a39ef8, 48c36fc, 7e36fa1, 10e805e (yeniden build: Google Fonts), 5dbb52a, f810299. Testler 615/615, tsc 0, lint 0 hata/24 uyarı.
- Risk: Vercel build'i iki kez geçici Google Fonts hatasıyla düştü; production'da tekrarlarsa yeniden build yeterli.
- Sonraki adım: Yusuf "yayına al" derse dalı main'e birleştir, production'da iki temada yeniden ölç, önbelleği ilk istekle ısıt.

### Akşam öncesi ek (2026-11-24 17:30–17:55, aynı dal, YALNIZ PREVIEW)
- Yusuf: "Polymarket tarafında Top/Discover/Newest yokken Kalshi'de var, benzer olsun" ve "sort bölümleri de farklı".
- Kalshi artık tek görünüm: `/markets?platform=kalshi` (Polymarket gibi yalnız sağlayıcı seçimi). Eski `?view=discover|markets|events|top` ve `?series=` adresleri kalıcı yönlendirmeyle (308) buraya gider. Etkinlik ve piyasa detay sayfaları çalışıyor; geri linki "Back to Kalshi markets". Eski Discover/Newest/Events bileşen dosyaları silinmedi (silme onaya bağlı); yalnızca sayfadan ve testlerden çıkarıldı.
- Sıralama Polymarket ile aynı sırada: 24h Volume, Total Volume, Open Interest, Closing Soon, Newest. Kalshi likidite yayınlamadığı için Liquidity yerine Open Interest var; About kısmında yazıyor. Total Volume = etkinliğin tüm açık piyasalarının toplam hacmi; Newest = etkinlikteki en erken open_time. Kategori çipleri Polymarket sırasında ("Culture" → "Entertainment", ayrıca Economy). Önbellek anahtarı v4.
- Doğrulama (preview, 375 px, koyu tema): eski Discover adresi yönlendi; görünüm sekmesi yok; 60 kart; 5 sıralama düğmesinin hepsi listeyi değiştiriyor; yatay taşma 0. Testler 599/599 (kaldırılan görünümlerin sayfa testleri çıkarıldı, yönlendirme/sıralama testleri eklendi), tsc 0, lint 0 hata/24 uyarı. Commit 8619f5f.

### Silme (2026-11-24 17:51, Yusuf onayı: "silebilirsin discover falan")
- Silinenler (commit a4c62a7): `KalshiDiscoveryClient.tsx`, `KalshiEventsClient.tsx`, `src/lib/kalshiDiscovery.ts`, `kalshiDiscoveryCache.ts`, `kalshiDiscoveryFilters.ts`, `/api/kalshi/discovery`, `/api/kalshi/events` (liste uç noktası), `kalshiEvents.ts` içindeki kullanılmayan liste yardımcıları, görünüm seçici (`KalshiViewSelect`) ve bunların testleri (5 test dosyası + diğer dosyalardaki ilgili testler).
- Korunanlar: etkinlik ve piyasa detay sayfaları, `/api/kalshi/events/[eventTicker]`, `/api/kalshi/markets`, etkinlik sayfasının kullandığı `KalshiMarketsClient`, fiyat özeti bileşenleri.
- Doğrulama (preview dpl_2SKfVJbb9jgAiNk8EvKMQQEAepvH): `/markets?platform=kalshi&view=events` → yönlendirme → Kalshi listesi (58 kart, sekme yok); `/markets/kalshi/events/KXSB-27` HTTP 200, "Back to Kalshi markets"; `/api/kalshi/discovery` HTTP 404 (beklenen). Testler 490/490, tsc 0, lint 0 hata/24 uyarı.

## Sıradaki görevler | Yusuf onayı bekleniyor
1. **Kalshi + kontrast preview onayı**: mobil kontrol yapıldı (375 px, iki tema). Yusuf akşam bakıp onaylarsa main'e alınır.
2. **Takip**: Vercel Analytics / Clarity'de yeni sayfalara gelen trafik ve AI referrer'ları.
3. **GEO Öncelik 2 kalanlar** (market maker sayfası, /liquidity SSR özet): Yusuf bekletiyor.

## Bloklayan şeyler
Yok. Not: yerel 3016 önizlemesi kapalı; kabul Vercel preview'unda yapıldı.

## Yusuf'tan beklenen onaylar
Main'e merge / production yayını; Clarity proje ID'si.

## İlerleme kaydı
Bu dosya tek güncel durum kaydıdır. Eski dosyalar delil olarak korunur; buradaki tarih, aşama, kanıt ve sonraki adım her onaylı tur sonunda güncellenir.

Kurulum kanıtı: yalnız salt-okunur oturum açılış kontrolü; ürün görevi, test suite, cron veya sürekli worker başlatılmadı.
