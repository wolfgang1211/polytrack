# AlphaBoard Geliştirme Durumu

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
