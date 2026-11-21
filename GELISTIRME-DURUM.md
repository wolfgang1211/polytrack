# AlphaBoard Geliştirme Durumu

## 2026-11-20: Ortak market arayüzü, yerel teknik kabul tamamlandı; görsel kabul açık

- Polymarket ve Kalshi için ortak header/toolbar/kart/native disclosure bileşenleri eklendi. İlk ekran sadeleştirildi; Featured, teknik kotasyon ve gelişmiş filtreler açılır alanlarda. Kalshi bağlantısı Discover'a gider; raw Markets/Events rotaları korunur. Events kartları mevcut Link çerçevesini korur, ortak header/toolbar ve aynı tema dilini kullanır.
- Sayısal URL filtreleri gelişmiş alanı açık başlatır; geri/ileri filtre değişimi panel state/key üzerinden yeniden eşitlenir, kullanıcı düzenlemesi paneli zorla kapatmaz. Geçersiz link uyarısı/Reset ile gerçek örneklem zaman aralığı ve kontrat birimleri görünür kalır.
- Gerçek son doğrulama: **545/545 test**, typecheck/build/diff-check **exit0**, lint **0 hata /25 mevcut uyarı**, güncel build üzerinde **8/8 HTTP/SSR/asset kontrolü**. API/provider/cache/finansal helper kodu değişmedi; başlangıç102hash'ten94aynı,8beklenenUI/testdeğişikliği.
- Bağımsız inceleme sonrası açılır alanlara belirgin chevron, okunur temel metinler, min-w-0 ve geri/ileri panel regresyonları eklendi. Kaynak/SSR testleri gerçek mobil görünüm, ölçülmüş kontrast, native tıklama veya hydration kanıtı değildir.
- `alphaboard-audit-preview` başlangıçta yoktu; yalnız bu servis loopback3016'da güncel production build ile başlatıldı, online/HTTP readback alındı. http://127.0.0.1:3016/markets?platform=kalshi&view=discover . Diğer işler değiştirilmedi; analytics disabled. **Commit/push/deploy yok**, HEAD `736eeb4bf22b4c975445d46993edec7fe7f20808`.
- **Gerçek browser görsel/mobil/kontrast/hydration kabulü açık**; izole browser veya izin bypass'ı kullanılmadı. HEAD'de de mevcut Polymarket eksik outcome fiyatının `0` fallback'i ayrı finansal-parsing takibi olarak kaydedildi; bu UI diliminde değiştirilmedi.
- Kanıt ve worker-timeout/test-fixture ayrıntıları: `C:/Users/wolfgang/hermes_reports/alphaboard-market-ui-20261119/VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi Discover cache ve istek birleştirme, yerelde doğrulandı

- Discover'a başarılı normalized örneklem için **20 saniye strict TTL** ve tek devam eden yükleme eklendi. Süre başarılı yükleme tamamlandığında başlar; monotonic saat, tek kayıt, kaynak çıktısı ve her cevap için bağımsız derin kopya. Hatalar/bozuk çıktılar tutulmaz; süresi geçmiş veriye yenileme sırasında veya hata halinde fallback yok. `receivedAt/sourceAsOf/coverage` hit'te değiştirilmez.
- API ve SSR aynı process-global sürümlü Symbol slot'undaki getter'ı kullanır. İlk modül-local implementasyon **523/523 test GREEN** olsa da gerçek built HTTP'de SSR/API ayrılığı **5/6** ile yakalandı; iki ayrı modül grafiği RED testi eklenip gerçek runtime sorunu giderildi. Ayrı grafikten gelen KalshiError, doğrulanmış status ve sabit mesajla yerel sınıfta yeniden oluşturulur; 503/504 korunur. Birden fazla process/instance arasında dağıtık paylaşım yok.
- Discovery API success **no-store**; eski CDN `s-maxage/stale-while-revalidate` katmanı kaldırıldı. Query 400 önce, POST405 korunur. Görünür 20 saniye yeniden kullanım notu var; manuel Refresh/Retry aynı, otomatik polling/stream/timer yok. Raw provider/parser/history/quote/filter hesapları değişmedi.
- Son gate: **525/525 test**, typecheck/build/diff-check **exit0**, lint **0 hata /25 mevcut uyarı**. Yeni dosyada18test. Gerçek built HTTP **6/6 cache +13/13 regresyon =19/19** senaryo.8soğuk eşzamanlı ve TTL sonrası4eşzamanlı request kendi tam snapshot'larını paylaştı; SSR/API receivedAt aynı. Yerel3hot API ölçümünün medyanı **5.4 ms**; soğuk yükleme hâlâ upstream maliyetine tabidir. Gerçek upstream call sayısı instrument edilmedi; tek-loader sayısı fonksiyon testlerinde kanıtlandı.
- Opus5.5 uygulaması ve ilk/son gerçek Fable5.2 `critical-review-fable` Agent yürütmeleri structured outermodel kanıtıyla doğrulandı; son dar inceleme ACCEPT-LOCAL. Legacy iki test dosyasında yalnız loader yalıtımı, fresh route fixture ve yeni cache-header beklentisi uyarlandı; kalan assertion/fixture verileri korunur.
- Başlangıç100hash'ten95aynı; üç mevcut production dosyası, iki legacy test fixture'ı ve iki yeni cache/test dosyası kapsamı. Yalnız `alphaboard-audit-preview` restart/online readback; diğer9PM2 PID/status aynı. Cron/dependency/config/credential değişikliği yok; analytics disabled. **Commit/push/deploy yok**, HEAD `736eeb4bf22b4c975445d46993edec7fe7f20808`.
- Önizleme: http://127.0.0.1:3016/markets?platform=kalshi&view=discover. Gerçek browser görsel/mobil/hydration/history/sekme kabulü **açık**, izole browser yok. Whole-pipeline deadline eklenmedi; mevcut request timeout'ları aynı. Sıradaki plan dilimi gerçek browser ve mobil/görsel kabul, erişim/consent gerektiriyor. Production-ready iddiası yok.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-cache-20261119/VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi Discover filtreleri ve paylaşılabilir URL, yerelde doğrulandı

- Onaylı sıranın ikinci dilimi eklendi: örneklemde arama/kategori, maksimum spread **1/5/10/20¢**, iki tarafta minimum görünen miktar **100/1000 kontrat**, **24h/7d** içinde kapanış. Bütün koşullar aynı satırda AND; kapanış referansı sample `receivedAt`. Bilinmeyen/tek taraflı/çapraz quote sayısal filtre açıkken elenir; varsayılan görünüm korunur. Global katalog veya işlem garantisi iddiası yok.
- URL sahipliği yalnız `q/category/maxSpread/minSize/closing`; strict parser, ilk SSR'de filtreleme, geçersiz/tekrarlı değerlerde görünür engel ve sıfır sonuç. Native push/replace ve popstate/cleanup handler kanıtı var; filtre değişimleri veri çekmez. Bilinmeyen query/hash korunur. Kontrollü aramanın sondaki boşluğu korunur, URL q trim edilir; yapıştırılan kontrol karakterleri görünür boşluğa dönüşür.
- Pending Refresh en güncel filtreleri kullanır. Kaybolan kategori temizlenirken yalnız category URL anahtarı silinir; diğer geçersiz değerleri silip reload'da sessiz genişleme önlenir. Sunucu navigasyonu parsed filtre kimliğine göre client key değiştirir. 12 grup/4 satır progressive disclosure ve eşleşen/örneklenen sayıları korunur. Paylaşılan URL filtreleri paylaşır, veri örneklemini dondurmaz.
- Claude Code Opus5.5 uygulama ve gerçek `critical-review-fable` Agent/Fable5.2 salt-okunur incelemesi yapılandırılmış kanıtla doğrulandı. İnceleme ACCEPT-LOCAL; son iki gözlem ayrı geçerli RED-GREEN regresyonlarıyla kapatıldı. Yeni dosyada **26 test**, tüm suite **507/507**. Typecheck/build/diff-check **exit0**, lint **0 hata /25 mevcut uyarı**. Gerçek capture ile bağımsız Decimal/datetime referansı **10 filtre kombinasyonu,0 uyuşmazlık**; güncel build gerçek HTTP **13/13** ve served client chunk doğrulandı.
- 98 başlangıç hash'inden yalnız iki mevcut production dosyası değişti; **96 hash aynı**. Yeni helper/test dışında backend/provider/history/quote/Polymarket değişikliği yok. Yalnız `alphaboard-audit-preview` restart edildi, online readback alındı; diğer3 ARC PID/status aynı, cron değişmedi. Analytics disabled. **Commit/push/deploy yok**, HEAD `736eeb4bf22b4c975445d46993edec7fe7f20808`.
- Önizleme: http://127.0.0.1:3016/markets?platform=kalshi&view=discover. Gerçek browser görsel/mobil/hydration/native geri-ileri/sekme kabulü **açık**; izole browser açılmadı. Polling/stream yok; kontrollü yenileme/cache/request dedup ve pipeline deadline sonraki ayrı dilim. Production-ready iddiası yok.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-filters-20261119/VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi fiyat grafikleri ve son işlemler, yerelde doğrulandı

- Onaylı iyileştirme planının ilk dilimi tamamlandı. Market detayında **1h /24h /7d** Yes işlem-kapanış fiyat grafiği, erişilebilir veri tablosu ve son public işlemler var. 1h dakika,24h/7d saat mumları; varsayılan24h sunucuda render edilir. Refresh/Retry ve aralık değiştirme var; otomatik polling/canlı stream henüz yok.
- Yeni yalnız-GET `/api/kalshi/markets/[ticker]/history?range=...`; metadata doğrulaması ardından gerçek event'ten series bağlama, aynı ticker/pencere kontrolü,200 mum/50 işlem üst sınırı işleme öncesi uygulanır. Book ve history paralel, grafik/işlem hataları bağımsız. Mevcut public transport/parser değişmedi, dependency/auth/işlem gönderimi yok.
- Grafik yalnız yayımlanmış `price.close_dollars` kullanır; null/eksik close ve eksik periyotlarda çizgi kırılır, önceki fiyat/bid/ask ile doldurulmaz. Gerçek sıfır korunur, tarihsel6-ondalık dolar hassasiyeti desteklenir. UTC zaman ekseni,0–100¢ fiyat ekseni, periyot ve retrieval/source zaman ayrımı açık.
- İşlemlerde yayımlanmış Yes/No fiyatları, kesirli kontrat miktarı, taker outcome ve block/orderbook etiketi korunur; taker yönüne göre fiyat takası veya Buy/Sell varsayımı yok. Seçilen pencerede tek50-kayıt sayfası, daha fazla veri varsa açık uyarı; tam pencere hacmi iddiası yok.
- Claude Code Opus5.5 implementasyonu, gerçek `critical-review-fable` Agent ve yapılandırılmış Fable5.2 yürütme kanıtı doğrulandı; bağımsız inceleme ACCEPT-LOCAL, blocker yok. Başlangıç39 RED sonrası479 test geçti; type narrowing hataları ve iki ek RED (abort sonrası geç başarılı yanıt, ticker kimliğine göre state reset) düzeltildi. Eski book testlerinin filtreleri yalnız beklenen iki yeni fixture yoluna daraltıldı; metadata/book beklentileri korunur.
- Son gate **481/481 test**, typecheck/build/diff-check **exit0**, lint **0 hata /25 mevcut uyarı**.23 gerçek mum ve50 işlem Python Decimal ile alan bazında eşleşti;22 gerçek fiyat noktası18 ve4 noktalı iki çizgi grubu, boşluk üzerinden bağlama yok. Güncel build gerçek HTTP **15/15**;1h/24h/7d API bölümleri başarılı, gerçek SSR grafik/işlemler ve served client chunk doğrulandı.
- Önizleme: http://127.0.0.1:3016/markets/kalshi/KXFEDDECISION-26DEC-H0. Yalnız `alphaboard-audit-preview` restart edildi ve online/HTTP readback alındı; diğer3 ARC PID/status ve24korunan hash değişmedi. HEAD `736eeb4bf22b4c975445d46993edec7fe7f20808`, **commit/push/deploy yok**.
- Gerçek browser görsel/mobil/hydration/yerel etkileşim kabulü **açık**, izole browser açılmadı. Arşiv endpoint fallback yok; kaynak boş/eksik hata verisi düz çizgiyle uydurulmaz. Fan-out/whole-pipeline timeout/cache iyileştirmesi sonraki performans diliminde. Sırada discovery filtreleri/URL state, kontrollü yenileme ve gerçek tarayıcı kabulü var.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-history-20261119/VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi spread ve görünen kotasyon miktarları, yerelde doğrulandı

- Markets, event alt-market listesi, Discover ve market detayına ortak quote özeti eklendi: spread (cent), bid/ask fiyat seviyesindeki kontrat miktarı; wide spread, small displayed size, tek taraflı/eksik/çapraz kotasyon uyarıları. Miktarlar volume/open interest'ten türetilmez, kesirli miktarlar korunur.
- `10¢ ve üzeri` geniş spread ve `100 kontrat altı` küçük görünen miktar eşikleri yalnız AlphaBoard UI heuristikleridir, Kalshi kuralı veya işlem yapılabilirlik/likidite skoru değildir. Görünür açıklama her yüzeyde bir kez, link dışında gösterilir; kaynak freshness'i bilinmiyor, tüm depth veya execution garantisi yok.
- Detaydaki iki taraf aynı normalize orderbook'tan alınır; metadata ile karışmaz. No bid → Yes ask kökeni korunur. Partial book yalnız görülen seviyeleri özetler; başarısız/desteklenmeyen book'ta metadata fallback yok. Eksik/çapraz quote spread'i sıfır değil unavailable; gerçek locked spread sıfırdır. Ham API şeması genişletilmedi, satır başına yeni fetch yok.
- Claude Code implementasyonu Opus5.5; gerçek `critical-review-fable` Agent çağrısı ve Fable5.2 outer modelUsage bağımsız doğrulandı. Dokunmatik görünür eşik açıklaması eklendi. Küçük pozitif miktarın `0 contracts` olması gerçek SSR RED ile üretildi ve düzeltildi. Eski handler harness'ine relative import desteği eklendi; yeni kaynak-regex testi default+named import'u doğru tanıyacak şekilde düzeltildi, üretim guard'ı gevşetilmedi.
- Son gate: **440/440 test**, typecheck/build/diff-check **exit0**, lint **0 hata /25 mevcut uyarı**. Bağımsız Decimal/int kontrolünde **7592 fiyat çifti ve9999 spread biçimi**, ayrıca gerçek public Fed book fiyat/miktar/provenance eşlemesi hatasız. Güncel build'de gerçek HTTP **10/10**; dört yüzeyde quote özetleri ve görünür policy'nin link dışında tek oluşu, güncel served client chunk, Polymarket/compare, analytics-disabled doğrulandı.
- Yalnız `alphaboard-audit-preview` güncel build ile restart edildi, online ve HTTP readback alındı. Diğer3 ARC servis PID'si ve21korunan hash değişmedi. Önizleme: http://127.0.0.1:3016/markets?platform=kalshi&view=discover.
- **Commit/push/deploy yok.** HEAD `736eeb4bf22b4c975445d46993edec7fe7f20808`; bütün Kalshi çalışması local/uncommitted. Browser görsel/responsive/hydration/gerçek etkileşim kabulü **açık**, izole browser açılmadı. Önceki discovery pipeline performans çekincesi devam ediyor. Sonraki dilim: fiyat grafikleri ve son işlemler.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-quotes-20261119/VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi Discover, aktif örneklem ve event gruplama

- Kullanıcının onayladığı sıranın ilk dilimi tamamlandı: aktif keşif + event altında marketler + kategori. Spread/derinlik geliştirmeleri ve grafikler sonraki dilimler. Yerel, read-only; yayın yok.
- Resmi `/markets` listesi newest-first, global volume sort sunmuyor. İlk100 kaydı büyütüp “en hacimliler” diye sunmak yerine son public trade örnekleminden literal ticker whitelist'i ile açık binary $1 marketler yükleniyor. Sabit pencere ve3x1000 trade sayfası,80ticker,40'lık market batch'leri ve en fazla20 event metadata isteği var. Eksik/bozuk zorunlu sayfa hata; yalnız metadata hatasında bilinen marketler açık unavailable etiketiyle kalır.
- Yeni `/api/kalshi/discovery` ve http://127.0.0.1:3016/markets?platform=kalshi&view=discover. Gerçek event başlıkları/kategorileri, sample içi arama/kategori, ilk12 event ve aç/kapat, her event'te ilk4 market ve aç/kapat, Yes bid/ask ve kontrat hacmi. Gerçek örneklem zaman aralığı görünür; global katalog/24h tam tarama iddiası yok. Eski raw market URL'si newest-listings açıklaması ve Discover bağlantısıyla korundu; Events/Polymarket/compare değişmedi.
- Claude Code implementasyonu exact Opus5.5 ile doğrulandı. Gerçek Fable5.2 bağımsız incelemesindeki pending-refresh kategori yarışı ve kaynak sayfa satır sınırı eksikleri önce ayrı RED regresyonlarıyla yeniden üretildi, sonra düzeltildi. Ek compact-view RED'i ve yeni lint uyarıları da giderildi.
- Son bağımsız gate: **414/414 test**, typecheck/build/diff-check **exit0**, lint **0 hata /25 mevcut uyarı**, güncel build ile gerçek HTTP **10/10**. Son API örneği3000trade →80seçilmiş ticker →76market/55event; bu değişken ve açıkça partial bir örneklem. SSR'de12 görünür event ve güncel served client chunk doğrulandı.
- Yalnız `alphaboard-audit-preview` restart edildi; diğer3ARC servis PID'si ve21korunan hash değişmedi. Browser görsel/responsive/hydration/gerçek etkileşim kabulü **açık**, izole browser yok. SSR bounded upstream fan-out ve whole-pipeline deadline/cache eksikliği yayın öncesi performans çekincesi olarak kayıtlı.
- **Commit/push/deploy yapılmadı.** Dependency/config/credential, hesap/order/signing/para hareketi yok. Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-discovery-20261119/VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi event gezinmesi, yerelde doğrulandı

- Kullanıcının “entegre etmeye devam, şimdi yayınlama” kapsamı korundu. Claude Code event adaptörünü, `/api/kalshi/events` ve `/api/kalshi/events/[eventTicker]` GET uçlarını, Markets / Events seçimini, event listesi ve event detayını ekledi. Event → bağlı açık binary $1 marketler, market → parent event ve seri → event listesi gezinmesi var. Polymarket varsayılanı ve wallet compare korundu.
- Arama/kategori filtresi yüklenen event sayfalarında; seri filtresi literal doğrulanmış ticker ile upstream'e gider. Pagination 20 sayfayla sınırlı; Load more, Retry, Refresh, dedupe, repeated-cursor stop ve geç yanıt reddi var. Event/series binding her sayfada korunur. Bilinmeyen metadata sıfıra/false'a dönüştürülmez; retrieval time kaynak freshness'i değildir.
- Ham upstream `cursor: ""` → normalize `nextCursor: null`. İki yeni test fixture'ındaki ham/normalize cursor karışıklığı yalnız testte düzeltildi; üretim guard'ları gevşetilmedi, bozuk normalize boş cursor için ek regresyon yazıldı.
- Hermes bağımsız son gate: **372/372 test**, typecheck/build **exit 0**, lint **0 hata / 25 mevcut uyarı**, diff-check **exit 0**. Gerçek `critical-review-fable` Agent ve `claude-fable-5-2` modelUsage doğrulandı; salt-okunur inceleme blocker bulmadı, test/browser kapsam sınırları raporda açık.
- Güncel build üzerinde gerçek HTTP **21/21**: event listesi/seri/metadata, event'e bağlı marketler, her iki ileri cursor, invalid/repeated query 400, unknown API/page 404, POST 405, event canonical'ı ve parent linki; mevcut Polymarket/Kalshi/compare ve analytics-disabled guard. Event SSR'de 50 farklı detay linki ve güncel served client chunk doğrulandı.
- Önizleme: http://127.0.0.1:3016/markets?platform=kalshi&view=events. Yalnız `alphaboard-audit-preview` restart edildi ve online/HTTP readback alındı; diğer üç ARC servisinin PID'leri değişmedi. 21 korunan dosya hash'i değişmedi. Browser görsel/hydration/gerçek etkileşim kabulü **açık**; izole tarayıcı başlatılmadı.
- **Commit/push/deploy yapılmadı.** Yeni dependency, provider credential, hesap, emir, signing veya para hareketi yok. Cross-market eşleştirme sonraki faz; insan yerel incelemesi ve ayrıca yayın onayı bekleniyor.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-integration-20261119/EVENTS-VERIFIED-LOCAL.md`.

## 2026-11-19: Kalshi veri entegrasyonu, yerelde hazır

- Kullanıcı kapsamı netleştirdi: önce Kalshi bağımsız veri sağlayıcısı olarak platforma eklenecek; cross-market eşleşme araştırması entegrasyonun ön koşulu değil. Önceki araştırma dosyaları korunuyor, production manifesti olarak kullanılmıyor.
- Claude Code implementasyonu: `src/lib/kalshi.ts`, yalnız GET sunan `/api/kalshi/markets`, `/api/kalshi/markets/[ticker]`, `/api/kalshi/markets/[ticker]/orderbook`; Markets ekranında Polymarket / Kalshi seçimi; Kalshi listesi ve `/markets/kalshi/[ticker]` detay ekranı. Polymarket varsayılanı ve wallet `/compare` korundu. Yeni dependency yok.
- Kalshi listesinde yüklenen marketlerde arama, quoted filtresi, sıralama, cursor ile Load more ve refresh/retry var. Sayılar global katalog toplamı olarak sunulmuyor; volume/open interest kontrat adedi, fiyat USD/kontrat. İlk sürüm açık binary $1 marketleri listeliyor; desteklenmeyen tipte binary book gösterilmiyor.
- Eksik/geçersiz değerler sıfıra çevrilmiyor; ticker bağlaması doğrulanıyor, hatalar no-store ve sanitize ediliyor, bozuk cursor son sayfa sayılmıyor. Orderbook tarafları zorunlu dizi; türetilen ask fiyatlarının kaynak tarafı ve miktarı korunuyor. Kaynak quote timestamp'i bilinmiyor; retrieval time freshness garantisi olarak sunulmuyor.
- Bağımsız incelemede bulunan cursor/book eksikleri önce gerçek modül üzerinde yeniden üretildi; 22 RED regresyonu yazılıp düzeltildi. Son test: **319/319**, build ve typecheck **exit 0**, lint **0 hata / 25 mevcut uyarı**, diff-check **exit 0**. Component-handler testleri load-more/dedupe, tekrar cursor, Retry, refresh/race ve filtre/sıralamayı çalıştırıyor; bunlar gerçek tarayıcı kanıtı değil.
- Production build üzerinde gerçek yerel HTTP **16/16**: liste, ileri cursor, metadata/book, Kalshi listesi (100 detay linki), market detay canonical'ı, invalid parametreler, bilinmeyen market 404, POST 405; ana sayfa, Polymarket, compare ve analytics disabled guard. Yakalanmış 200 gerçek upstream satırında 600 kontrat metriği eşlemesi ve book fiyat/miktar/provenance dönüşümleri bağımsız doğrulandı. Güncel client JS chunk'ı HTTP üzerinden okundu.
- Önizleme: http://127.0.0.1:3016/markets?platform=kalshi. Yalnız `alphaboard-audit-preview` PM2 süreci durdurulup güncel build ile restart edildi, online readback alındı. Diğer üç AlphaBoard/ARC PM2 servisinin PID'leri değişmedi. Browser penceresi bulunamadığından görsel/gerçek browser etkileşim kabulü **açık**; izole tarayıcı başlatılmadı.
- **Commit/push/deploy yapılmadı.** Kullanıcı yerel incelemesi ve ayrıca yayın onayı bekleniyor. Wallet, signing, emir, fon hareketi, provider auth/credential yok. Analytics production guard değiştirilmedi. `.hermes/`, `DESIGN_AUDIT_TR.md`, AGENTS ve önceki araştırma dosyalarının 21 hash'i değişmedi.
- Kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-kalshi-integration-20261119/VERIFIED-LOCAL.md`.


## 2026-11-15: Dark / Light / System, yerelde hazır

- Son kullanıcı düzeltmesi: sürekli görünen üst çubuk seçimi kaldırıldı. Masaüstünde More > Appearance, mobilde menü > Appearance altında; menü kapalıyken picker DOM'da render edilmez. Mobil panel kapalıyken inert, açıkken viewport ile sınırlı kaydırılabilir. Yerel tam gate 166/166 test, build/typecheck exit 0; menü aç/kapa yerleşim regresyonları gerçek Navbar renderer'ında geçti. Browser görsel/klavye kabulü ayrıca açık; yayın yok.

- Üst menüye Dark / Light / System (Auto) seçimi eklendi. Varsayılan System; açık seçim `alphaboard-theme` ile best-effort saklanır. Storage engelliyken de tema uygulanır.
- İlk boya öncesi head script'i, OS/sekme değişimleri ve explicit temayla açılıp System'e geçiş test edildi. Site geneli nötr metin/yüzeyler light tokenlarına uyarlandı; semantik veri renk envanterinde drift yok. Logo şekli korunur, light'ta yalnız logo siyaha çevrilir.
- Yerel gate: 163/163 test; build/typecheck/diff-check exit 0; lint 0 hata / 25 uyarı. Aynı build üzerinde 15/15 HTTP sayfasında üçlü kontrol/erken script ve derlenmiş light/ink/logo selector doğrulandı.
- Önizleme: http://127.0.0.1:3016/; yalnız mevcut alphaboard-audit-preview PM2 süreci restart edildi. Diğer işler değiştirilmedi.
- Gerçek otomatik browser görsel/klavye kabulü mevcut Brave consent engeli nedeniyle açık; izole browser açılmadı. Kullanıcı yerelde menü içindeki son sürümü görsel olarak onayladı ve "tamamdır güzel olmuş yolla" diyerek GitHub/yayın izni verdi. Son yayın öncesi kontrol 166/166 test; push/deployment doğrulaması yayın raporunda ayrıca tutulacak.
- Kanıt: C:/Users/wolfgang/hermes_reports/alphaboard-theme-switch/VERIFIED-LOCAL.md.

## 2026-11-15: Siyah-beyaz kurumsal tema, yayınlandı

- Kullanıcı siyah-beyaz tasarım önerisini onayladı; finansal veriden gelen orijinal kırmızı/yeşil ve diğer semantik renklerin korunmasını istedi.
- Kullanıcı gerçek yerel UI'yi inceleyip yayın onayı verdi. Tasarım commit'i `2aa9bc8d171164cf3d4ae0ff16f8614acc40303e`, GitHub `main` ve Vercel Production deployment `7804628249` üzerinden yayımlandı. Canonical domain smoke **14/14** geçti; canlı logo/ikon/OG byte hash'leri yeni kaynaklarla eşleşti.
- Kömür siyahı `#111111`, kırık beyaz `#f2f0e9`, nötr gri yüzeyler; mor utility/inline renkler ve eski `--vi-*` tokenları aktif kaynaklardan kaldırıldı. Kâr/zarar ve BUY/SELL renkleri korunuyor; UI'ye grayscale filtresi uygulanmadı.
- Onaylı editoryal hero, nötr navigasyon, sade yüzeyler ve daha keskin köşeler uygulandı. Logo geometrisi korunup beyaz varyant eklendi; orijinal artwork dosyaları değişmedi. Favicon, uygulama ikonları, manifest ve OG kartı da nötrleştirildi.
- Son gate: **144/144 test**, build ve typecheck exit **0**, lint **0 hata / 25 uyarı**, gerçek yerel HTTP **43/43**. Veri adaptörleri ve finansal API davranışı değiştirilmedi. Mor renk, nötr kontrast ve semantik renk koruması için regresyon testleri eklendi.
- Önizleme: `http://127.0.0.1:3016/`, mevcut PM2 `alphaboard-audit-preview` ile çalışıyor. Analytics hâlâ yalnız açık yerel opt-in ile erişilebilir.
- Kullanıcı görsel kabulü alındı. Otomatik gerçek tarayıcı responsive/klavye gate'i **açık**; ekran görüntüsü veya tam otomatik tarayıcı kabulü iddia edilmiyor. X banner/PFP taslakları ayrıca hazırlandı, hesaba henüz yüklenmedi; profil yazması için görsel onay ve mevcut tarayıcı erişimi gerekli.
- Kanıtlar ve orijinal ikon yedekleri: `C:/Users/wolfgang/hermes_reports/alphaboard-monochrome-implementation/`.


Kaynaklar:

- `GELISTIRME-RAPORU-2026-07-13.md`, ürün, büyüme ve hacim raporu
- `LP-ROADMAP.md`, LP ve maker ürün yol haritası
- `docs/project-history/SESSION-NOTU-2026-07-10.md`, tarihsel LP geliştirme notu

Canonical repository: `C:\Users\wolfgang\polytrack`

Kuzey yıldızı: haftalık Builder-attributed matched volume. Native order gönderimi başlayana kadar `outbound_trade_click` yalnız işlem niyeti proxy'sidir.

## Sprint 1: Funnel'ı kanıtla

- [x] Mobil overflow, kesilen hero ve mobil navigasyon düzeltmeleri (`457722d`)
- [x] Homepage hero CTA'ları, Explore Markets ve Analyze a Wallet (`25615e5`)
- [x] Market kartlarında açık Trade on Polymarket aksiyonları (`9a84f8d`)
- [ ] Minimum event şeması ve günlük funnel görünümü (local-only QA /analytics, kalıcı aggregate ve clicks/100 observed views doğrulandı; production ölçümü ve browser kabulü açık)
- [x] Outbound linklerde ref ve campaign context korunması (`2cf89d6`)
- [ ] Veri kaynağı, freshness ve metrik tanımı tooltip'leri
- [x] Dört blog yazısının içerik ve 404 davranışı denetimi (yerel test/build/HTTP; henüz commit yok)
- [x] FAQ, watchlist ve alerts metinlerinin gerçek davranışla hizalanması (yerel kaynak ve regresyon testleri; henüz commit yok)
- [x] OG ve Twitter image uçlarının doğrulanması (yerel PNG/HTTP ve hata senaryoları; henüz commit yok)
- [x] Compare sayfası H1 ve accessibility düzeltmeleri (label/ARIA kaynak testleri; gerçek tarayıcı/klavye kabulü bekliyor)

## Sprint 2: Landing page'i sahiplen

- [ ] Tekrar kullanılabilir `/market/[slug]` karar sayfası
- [ ] Public trader profil sayfaları
- [ ] X kartları ve alert'lerden AlphaBoard içi karar sayfalarına yönlendirme
- [ ] Track Trader, Watch Market ve kişisel alert akışları
- [ ] Yüksek talepli topic sayfaları
- [ ] Sayfa türü bazlı outbound CTR ölçümü (local QA clicks/100 observed views mevcut; unique CTR veya production trafik kanıtı değil)
- [ ] Niyet kanıtlanırsa builderCode içeren dar non-custodial emir bileti pilotu
- [ ] Liquidity Hub vaka çalışması, alert ve maker-order döngüsü

## Sprint 3: Dağıtımı bileşik hale getir

- [x] World Cup Hub tamamlandı ve etkinlik bittikten sonra ürün yüzeyinden kaldırıldı (`bf7a53c`)
- [ ] Gelecek yüksek talepli etkinlikler için genel event-hub şablonu
- [ ] @alphaboardxyz için insan onaylı veri-content döngüsü
- [ ] Campaign attribution ile creator ve community ortaklıkları
- [ ] AlphaBoard Pro waitlist veya paywall deneyi
- [ ] Dar emir pilotu başarılıysa Replicate Trade akışı
- [ ] Verified Builder süreci

## LP ve maker dikeyi

- [x] Farm Delta feed, `/api/liquidity/changes` ve Liquidity Hub bileşeni (`230b9fd`)
- [ ] Vacancy ve Farm Telegram alarmları
- [ ] Validate UI açıklaması ve matchedVolumePct vurgusu
- [ ] LP Deploy Wizard
- [ ] Market detay sayfasında LP zaman serileri
- [ ] Cüzdan LP karnesi
- [ ] Public data API ve embed kartları
- [ ] Farm geçmişi arşivi
- [ ] Reward model v2

## Yapılmayacaklar

- Outbound funnel ve Builder pilotu doğrulanmadan tam trading terminal
- Net sonraki aksiyonu olmayan bağımsız dashboard'lar
- Şeffaf metodoloji olmadan AI trade sinyalleri
- Binlerce thin SEO sayfası
- İlk sürüm için gereksiz pahalı indexer
- Attribution doğrulanmadan geniş affiliate programı
- Ürün döngüsüne bağlanmayan genel blog fabrikası

## İlerleme kaydı

| Tarih | Değişiklik | Commit | Durum |
|---|---|---|---|
| 2026-07-13 | Farm Delta feed geliştirildi | `393030e`, canonical karşılığı `230b9fd` | Tamamlandı |
| 2026-07-16 | Homepage dönüşüm CTA'ları | `25615e5` | Tamamlandı |
| 2026-07-16 | Açık Polymarket trade aksiyonları | `9a84f8d` | Tamamlandı |
| 2026-07-16 | Outbound campaign context koruması | `2cf89d6` | Tamamlandı |
| 2026-07-28 | World Cup özel bölümü kaldırıldı | `bf7a53c` | Tamamlandı |

## 2026-11-14: Veri güvenilirliği, yerel düzeltme paketi 1

- Dal: `fix/data-api-v2-wallet`. Henüz commit/push/deploy yok; aşağıdaki kayıt canlı yayın kabulü değildir.
- Wallet temel API'si `/v2/positions` ve `/v2/value` sözleşmesine geçirildi. OPEN, REDEEMABLE_LOST ve CLOSED ayrı cursor akışlarıyla okunuyor; yaşam döngüsü başına en fazla 1.000 satır, toplamda dedup öncesi en fazla 3.000 satır. Kalan geçmiş `truncated=true`.
- Upstream hata, hatalı şema, bozuk cursor veya eksik finansal alanlar başarılı boş/sıfır portföye çevrilmiyor; 502/503. Geçersiz adres 400, gerçek boş cüzdan 200. Hata cevapları cache'lenmiyor.
- V2 lifecycle bilgisi ortak `isPositionOpen` üzerinden wallet, compare, kartlar ve grafiklere taşındı; sıfır-marklı ama elde tutulan kayıp pozisyonlar unrealized P&L'den düşmüyor.
- Bağımlılık eklenmeden Node test runner ve wallet regresyonları eklendi; `npm test` tanımlandı. Ham doğrulama kayıtları: `C:/Users/wolfgang/hermes_reports/alphaboard-wallet-v2-20261114/`.
- Bu ilk checkpoint sırasında kalan kritik kapsam diğer Data API çağrıları ve trust/SEO işleriydi; aşağıdaki ikinci checkpoint bunların yerel kod/runtime sonucunu kaydeder.

## 2026-11-14: Veri güvenilirliği, yerel düzeltme paketi 2

- Aynı dalda, commit/push/deploy yapılmadan: leaderboard, rising traders, recent trades, activity, hot markets, overview, wallet trades/activity, timeline, sparklines, OG ve maker-fill kaynakları doğrulanmış v2 adaptörlerine taşındı.
- Timeline resmi cumulative `trade_pnl` serisidir; pozisyon örneklemi P&L'si veya caller-supplied anchor ile kaydırılmaz. Paylaşılan kart örneklem kesilmişse açıkça sample position P&L olarak etiketlenir.
- Finansal şema, wallet/window/source binding, tekrarlanan cursor, eksik rol snapshot'ı ve gelecek timestamp durumlarında fail-closed davranış korundu. Leaderboard volume shares, trade notional USDC (`size * price`), efficiency P&L/share olarak ayrıldı.
- Kısa/opaque upstream market kimlikleri değiştirilmeden `sourceConditionId` olarak korunur; doğrulanmış CTF `conditionId` üretilmez. Metadata yokluğu geçerli finansal satırları sıfıra indirmez; CTF/maker tüketicileri doğrulanmış kimlik ister.
- v2 trades tarafında `filter_amount=0` minimumu kaldırmadığından wallet/rol snapshot'larında açık TOKENS/micro-share filtresi kullanılır. Maker ve taker snapshot'ları aynı wallet, pencere ve filtrelerle tamamlanmadan rol tahmini yapılmaz.
- Güncel maker kaynağı yoksa eski Graph geçmişi tek başına sağlıklı LP kazancı olarak sunulmaz. Model-validation arızası 200/sıfır yerine sanitized 503 döner; LP bileşeni hata/retry gösterir.
- Blog dört geçerli slug için 200; bilinmeyen, `__proto__` ve `constructor` slug'ları gerçek 404. PNG metadata, FAQ/Smart Score vaatleri ve compare label/ARIA bağları düzeltildi.
- Outbound telemetry yalnız allowlisted event/kind/placement kaydeder; wallet, tam URL, referral, kullanıcı kimliği ve tutar kaydetmez. Backend click log'u HTTP ile okunarak doğrulandı. Günlük funnel görünümü, gerçek conversion/Builder matched-volume attribution ve CTR henüz tamamlanmış sayılmaz.
- Son kod gate'i: 108/108 test, typecheck exit 0, lint exit 0 (0 hata/25 uyarı), production build exit 0. Built HTTP: 33/33 live sayfa/API, 16/16 kontrollü arıza/boş/rate-limit, 4/4 telemetry; OG/model/LP ek hata kontrolleri ayrı kanıt dosyalarındadır.
- Görsel/etkileşim kabulü BLOKE: mevcut Brave profiline read-only bağlanma `browser_consent_required` ile reddedildi. İzole tarayıcı açılmadı, profil/policy/grant değiştirilmedi. OG PNG dosyası ayrıca görsel olarak incelendi; bu gerçek sayfa/browser kabulünün yerine geçmez.
- Kanıt dizini: `C:/Users/wolfgang/hermes_reports/alphaboard-completion-20261114/`. Bu kayıt public release veya tüm ürün yol haritasının tamamlandığı anlamına gelmez.

### Gecikmeli bağımsız review sonrası ek doğrulama

- Graph history içinde başarısız/malformed sayfa artık sessiz atlanmıyor; partial taban yerine tam v2 fallback veya unavailable sonucu kullanılıyor.
- Liquidity trader board volume shares olarak biçimleniyor. Wallet sidebar yanlış `openValue + realized` equity hesabı yerine cash hariç `Position Value` gösteriyor; sample kapsamı açıklanıyor.
- Maker/taker için all ve taker snapshot'ları iki tur exact multiset ile karşılaştırılıyor; gözlenen indeksleme değişimi unavailable yapıyor. Roller açıkça `inferred-stable-snapshots`; bu atomik/on-chain attestation garantisi değildir. Aynı kalan upstream eksiklik residual riski belgelenmiştir.
- Son test114/114, typecheck/lint/build exit0, lint0hata25uyarı. Aynı build üzerinde61/61 HTTP senaryosu; Graph sayfa boşluğundan tam fallback ile20USDC fixture P&L'si ve role-indexing race için503 ayrıca doğrulandı. Finansal fixture değerleri gerçek kullanıcı ölçümü değildir.
- Güncel kanıt: `C:/Users/wolfgang/hermes_reports/alphaboard-completion-20261114/claude-review/POST-REVIEW-CHECKPOINT.md` ve source/build hash manifesti. Browser gate halen bloke; public yayın yok, görev-owned PM2 süreçleri ve3016/3017 tekrar kapalı.

## 2026-11-15: Yerel günlük ölçüm ve receipt prototipi

- `/analytics` yerel operatör ekranı: UTC günlük trend, allowlisted sayfa kategorileri ve placement click kırılımı. Privacy-safe SQLite yalnız aggregate sayaçlar ve collection-start metadata tutar; cookie, kullanıcı kimliği, wallet, tam URL veya referral değeri saklamaz.
- Collector yalnız açık local opt-in ve izinli loopback portlarında kalıcı sayar. Disabled/corrupt storage 503; gerçek boş gözlem başarılı sıfırdır. Önceki ölçülmemiş günler null/unknown; sıfır görüntülemede oran unavailable. Oran clicks/100 observed views, unique CTR veya conversion değildir; placement impressions ölçülmediğinden placement CTR verilmez. DNT/GPC opt-out desteklenir.
- Ayrı gerçek OS süreçleriyle concurrent increment ve fresh-process readback geçti. Gerçek PM2 restart sonrasında summary birebir korundu. Built HTTP kontrolü 35/35; sayfa/JS kayıtları, privacy/origin/body sınırları ve kesin event delta readback dahil. Bu yerel HTTP QA trafiğidir, gerçek ziyaretçi verisi değildir.
- Read-only V2 receipt prototipi finansal UI/API'ye entegre edilmedi. Parent resmi Events.sol içindeki aynı `p` ile üretilen taker olaylarını doğruladı; gerçekçi taker fixture, paired-event bağları, BUY shares/collateral ayrımı, canonical block quantity ve numeric-coercion korumaları RED/GREEN geçti. Topic hashleri `cast keccak` ile bağımsız doğrulandı. RPC401 nedeniyle gerçek zincir receipt/finality kabulü halen yok; mevcut LP rolleri inferred olarak kalır.
- Resmi Builder araştırması: dış event/profile click attribution değildir. Signed order builder alanı ve ayrı matched-trade readback gereklidir. Kaynaklı rapor `C:/Users/wolfgang/hermes_reports/alphaboard-funnel-followup/BUILDER-ATTRIBUTION-VERIFIED.md`; gerçek AlphaBoard matched execution/fee/finality kanıtlanmadı.
- Son parent gate: 137/137 test, 0 failed/skip; typecheck/build exit0; lint exit0, 0 hata/25 mevcut uyarı; git diff --check exit0. Yeni scoped analytics paketi 26/26; receipt paketi 6/6. Önceki 61/61 HTTP checkpoint ayrı tarihsel kanıttır, bu yeni 35/35'e eklenerek tek güncel toplam gibi sunulmaz.
- Brave görsel/klavye kabulü startup consent nedeniyle açık. Parent mevcut profil iznini aşmadı; HTTP/hook/renderer testleri browser kabulü sayılmadı. Görev-owned preview tekrar stopped,3016/3017 kapalı. Commit/push/deploy, fon/wallet işlemi, public mesaj ve kalıcı silme yok.
- Güncel kanıt dizini: `C:/Users/wolfgang/hermes_reports/alphaboard-funnel-followup/`.

## 2026-11-15: Kullanıcı onaylı yayın paketi

- Kullanıcı yerel sürümü görsel olarak onayladı, son kontrol, GitHub push ve canlı yayına açık izin verdi.
- Kaynak commit: `a45781c12a4a105783b2eb1eb442990a8cd50f46` (`fix(data): migrate Polymarket APIs and harden financial analytics`).
- Yayın öncesi son gate: 140/140 test, 0 failed/skipped; production build/typecheck exit 0; lint 0 hata/25 mevcut uyarı; staged diff ve yüksek-sinyalli secret kontrolü temiz.
- Local-QA `/analytics` açık opt-in olmadan gerçek 404 döner; production sayacı/SQLite açılmaz. Test yolları geliştirici home dizinine bağımlı değildir. Production-shaped localhost kontrolünde ana sayfa/leaderboard/liquidity/compare/FAQ ve gerçek v2 leaderboard 200, geçersiz wallet 400, bilinmeyen blog ve analytics 404, disabled summary 503 doğrulandı.
- GitHub/Vercel production entegrasyonu doğrulandı; bu kayıt canlı yayın başarı iddiası değildir, kesin deployment ve public readback kanıtı yayın raporuna yazılır.
- `.hermes/` ve `DESIGN_AUDIT_TR.md` yayın dışında korundu. Eski boş Git index kilidi silinmeden kanıt dizinine taşındı; auth/secret dosyaları okunmadı.
- Yayın kanıtları: `C:/Users/wolfgang/hermes_reports/alphaboard-release-current/`.
