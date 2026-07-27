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
- [ ] Minimum event şeması ve günlük funnel görünümü
- [x] Outbound linklerde ref ve campaign context korunması (`2cf89d6`)
- [ ] Veri kaynağı, freshness ve metrik tanımı tooltip'leri
- [ ] Dört blog yazısının içerik ve 404 davranışı denetimi
- [ ] FAQ, watchlist ve alerts metinlerinin gerçek davranışla hizalanması
- [ ] OG ve Twitter image uçlarının doğrulanması
- [ ] Compare sayfası H1 ve accessibility düzeltmeleri

## Sprint 2: Landing page'i sahiplen

- [ ] Tekrar kullanılabilir `/market/[slug]` karar sayfası
- [ ] Public trader profil sayfaları
- [ ] X kartları ve alert'lerden AlphaBoard içi karar sayfalarına yönlendirme
- [ ] Track Trader, Watch Market ve kişisel alert akışları
- [ ] Yüksek talepli topic sayfaları
- [ ] Sayfa türü bazlı outbound CTR ölçümü
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
