# AlphaBoard Analytics | DURUM

- Güncelleme: 2026-11-22T21:45+03:00
- Proje klasörü: `C:/Users/wolfgang/polytrack`
- Son oturum: Cowork (Claude Opus 5.5), Hermes'ten devir. Yusuf bu turda commit, `cowork/kalshi` branch'ine push ve Vercel preview deploy'una açıkça izin verdi; production, main'e merge ve dosya silme hâlâ onaya bağlı.
- Çalışma sırası: **ONAY BEKLİYOR** (GEO Öncelik 1 `cowork/geo-p1` preview'da; Yusuf onaylamadan yayın yok. Hydration incelemesi beklemede).

## Şu anki aşama
main canlıda: Kalshi + ortak market arayüzü, Vercel Analytics, Microsoft Clarity, GEO Öncelik 0 (robots AI botları, sitemap tarihleri, llms.txt). Yerel klasör main'den temiz kopya.

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

## Sıradaki görevler | Yusuf onayı bekleniyor
1. **Hydration incelemesi** (React #418, beklemede): Yusuf başlat diyene kadar sırada.
2. **Dilim dışı erişilebilirlik**: global Breadcrumb, TopMarkets etiketleri, PolymarketTradeLink notu kontrastı; Polymarket CTA 44px; açık tema ölçümü.
3. **GEO Öncelik 1 yayını**: Yusuf preview'u onaylayınca `cowork/geo-p1` → main.

## Bloklayan şeyler
Yok. Not: yerel 3016 önizlemesi kapalı; kabul Vercel preview'unda yapıldı.

## Yusuf'tan beklenen onaylar
Main'e merge / production yayını; Clarity proje ID'si.

## İlerleme kaydı
Bu dosya tek güncel durum kaydıdır. Eski dosyalar delil olarak korunur; buradaki tarih, aşama, kanıt ve sonraki adım her onaylı tur sonunda güncellenir.

Kurulum kanıtı: yalnız salt-okunur oturum açılış kontrolü; ürün görevi, test suite, cron veya sürekli worker başlatılmadı.
