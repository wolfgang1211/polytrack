# K0 Fizibilite Checkpoint — 2026-11-18 (ilk yürütülen araştırma checkpoint'i)

## Faz durumu

**K0 kabulü KARŞILANMADI.** Qualified çift: 0. Somut keşfedilmiş çift: 4 (C1–C4, hepsi `pending`). Reddedilen fikir: 1 (C5).

| Boyut | Durum |
|---|---|
| Semantik karşılaştırma adaylığı | C1 incelemeye hazır; C2, C3, C4 bloklu (aşağıda) |
| İnsan (Yusuf) onayı | Hiçbir aday için yok. Agent onayı eşleşmeyi onaylamaz |
| Ücret desteği | Yok. Kalshi formülü alınamadı (429); Poly per-market V2 `fd` ve kategori gözlenmedi. Net hesap tüm adaylarda kapalı |
| Tazelik desteği | Kısmi. Poly book'ta `timestamp` var (birim doğrulanmadı); Kalshi book'ta kaynak zaman damgası yok |
| Şartlar / yeniden gösterim (data reuse) | Kontrol edilmedi |

Bu not ürün manifesti değildir. Makine okunur envanter: `docs/cross-market/candidate-pairs.json` (yalnız araştırma amaçlı).

DÜZELTME: önceki sürümdeki "Kalshi market/book çekilmedi" ve "Poly book/fee-rate çekilmedi" ifadeleri artık geçersiz. Aşağıdaki kanıtlar Hermes'in gerçek public GET'leridir.

## Kanıt dizini

E = `hermes_reports/alphaboard-cross-market-k0-20261118`

| Kanıt | Yer |
|---|---|
| KXFEDDECISION seri metadata: fee_type `quadratic_with_maker_fees`, settlement source Federal Reserve, contract_terms_url | `E/kalshi-series-fed-decision.json:1` |
| KXFEDDECISION open marketleri: 50 satır, `cursor: ""` (tam liste) | `E/source-manifest-2.json:15-27` |
| KXFED open marketleri: 100 satır, cursor dolu → **KISMİ** | `E/source-manifest-2.json:29-41` |
| Seçilen 4 Kalshi market satırı (gerçek satırlardan filtrelendi, tahmin değil) | `E/kalshi-selected-markets.json:1-206` |
| 4 Kalshi orderbook (200) | `E/source-manifest-3.json:2-69` |
| Resmi FEDDECISION sözleşme metni (Hermes çıkarımı) | `E/kalshi-feddecision-contract-extracted.md:5-20` |
| Poly book 3215007 YES ve 3215006 YES (200) | `E/poly-book-3215007-yes.json`, `E/poly-book-3215006-yes.json` |
| Poly legacy `/fee-rate` → `{"base_fee":1000}`. V2 oranı olarak yorumlanmaz | `E/poly-fee-rate-3215007-yes.json:1` |
| Poly fee formülü, 2026-11-20 23:59 UTC geçişi, Economics katsayısı 0.05 → 0.01 | `E/poly-current-fees.md:11,29,48`, `E/poly-upcoming-fees.md:11,20,41` |
| Poly V2: fee per-market dinamik, `fd {r,e,to}`; collateral pUSD (USDC destekli) | `E/poly-v2-migration.md:29,79,84,335,347` |
| Kalshi fee schedule PDF → HTTP 429; yeniden denenmedi | `E/source-manifest-4.json:23-27` |

## Ortak kural farkları (C1–C4 hepsi KXFEDDECISION ailesi)

| # | Fark | Kaynak | Etki |
|---|---|---|---|
| R1 | Ölçü: Poly = toplantı öncesine göre **üst sınır** değişimi; Kalshi = FOMC'nin hedef **aralık** üzerindeki "action"ı. Asimetrik aralık hareketinde ayrışabilir (hipotez) | `E/candidate-inventory.json:599`; contract `:7,10` | gösterilir; insan kabul etmeli |
| R2 | Yuvarlama: Poly 25'e olmayan hareketi yukarı yuvarlar (12.5 → 25 kovası). Kalshi "at most one can resolve to Yes": 12.5 bp'de tüm Kalshi marketleri No olabilir (hipotez) | `candidate-inventory.json:599`; `kalshi-selected-markets.json:87` | C2/C3 için blok |
| R3 | Fallback: Kalshi = toplantı iptal ve planlanan tarihte yapılmazsa "maintains" Yes. Poly = sonraki planlı toplantının sonuna kadar açıklama yoksa "No change". Salt iptalde ikisi aynı yöne; **erteleme** halinde ayrışabilir (Kalshi metni tarihe bağlı) | contract `:12`; `kalshi-selected-markets.json:86-87`; `candidate-inventory.json:599` | gösterilir |
| R4 | Ham kural metninde eksik karşılaştırıcı: C26 `rules_primary` "Cut of   25bps"; dört marketin `rules_secondary` örneği "Hike   25 bps". Onarılmadı/normalize edilmedi | `kalshi-selected-markets.json:36,87,137,138,189` | C3 için blok |
| R5 | İşlem kapanışı ≠ gözlem hedefi: Kalshi `close_time` 18:59Z, sözleşme "Last Trading Time 1:55 PM ET" diyor (uyumsuzluk, işaretlendi); `expected_expiration_time` 19:05Z = sözleşme 2:05 PM ET; `latest_expiration_time` +3 ay. Poly `endDate` 23:59Z. Hedef olay aynı FOMC kararı → kapanış farkı tek başına blok değil | `kalshi-selected-markets.json:55,62,66`; contract `:14,16,17`; `candidate-inventory.json:608` | gösterilir |
| R6 | Çözüm otoritesi: Kalshi takdirle Market Outcome Review başlatabilir; bitiş sonrası revizyon sayılmaz. Poly çözüm mekanizması kanıtta yok | contract `:7,20` | gösterilir |
| R7 | Birim: Kalshi Settlement Value $1.00 (USD), `notional_value_dollars` "1.0000". Poly collateral pUSD (USDC destekli); mevcut fee sayfası USDC diyor. Aynı birim sayılmaz, peg varsayılmaz | contract `:18`; `kalshi-selected-markets.json:71`; `poly-v2-migration.md:29,84`; `poly-current-fees.md:57` | gösterilir |
| R8 | Tick: Kalshi `linear_cent` 0.01; Poly `tick_size` 0.001, `min_order_size` 5, `neg_risk` true. Kalshi `can_close_early` true | `kalshi-selected-markets.json:26-33,54`; Poly book JSON sonu | gösterilir |
| R9 | H0 etiketi: `yes_sub_title` ve `no_sub_title` ikisi de "Fed maintains rate"; kural "Hike of 0bps" | `kalshi-selected-markets.json:51,70,102` | gösterilir |

## Aday kartları

Fiyat erişilebilirliği yalnız ham gözlemdir; spread/advantage/net hesaplanmadı. Hesap gerekiyorsa Hermes yapar.

### C1 — Aralık 2026 değişiklik yok — `pending` (incelemeye en hazır)
- Poly: event 770450, market 3215007, conditionId `0x7238…11c0`, YES token `42865728…08601` (`candidate-inventory.json:634-647`).
- Kalshi: `KXFEDDECISION-26DEC-H0`, event `KXFEDDECISION-26DEC`, custom_strike `{"Hike":"0"}` (`kalshi-selected-markets.json:53-103`).
- Binding: Poly book `market` = conditionId ve `asset_id` = YES token (`poly-book-3215007-yes.json:1`). Yes eşlemesi Gamma `outcomes`/`clobTokenIds` dizileri değerle parse edilerek kurulur; `asset_id` tek başına Yes'i kanıtlamaz.
- Fiyat: Poly iki yönlü book. Kalshi `yes_dollars` 2 seviye, `no_dollars` 78 seviye (`source-manifest-3.json:31-34`).
- Açık: R1, R3, R5–R9; insan onayı; ücret.

### C2 — Aralık 25 bp indirim — `pending`, bloklu
- Poly 3215006, conditionId `0xf17a…10d0b8`, YES token `77367448…09019`. Kalshi `KXFEDDECISION-26DEC-C25`, custom_strike `{"Cut":"25"}`.
- Fiyat: Poly iki yönlü book. Kalshi `yes_dollars` **boş**: YES bid yok. Bu sıfır değildir ve YES ask yokluğu anlamına gelmez; NO bid'ler 29 seviye (`kalshi-book-KXFEDDECISION-26DEC-C25.json:1`). Metadata `yes_bid_dollars "0.0000"` / size `"0.00"` fiyat olarak yorumlanmaz.
- Blok: R2 (12.5 bp davranışı).

### C3 — Aralık >25 / 50+ bp indirim — `pending`, bloklu
- Poly 3215005 ("50+ bps"); Kalshi `KXFEDDECISION-26DEC-C26`, custom_strike `{"Cut":">25"}`, başlık ">25bps", ama `rules_primary` ham metni "Cut of   25bps" (R4).
- Fiyat: Kalshi `yes_dollars` 0 seviye, `no_dollars` 32 seviye. Poly 3215005 book **çekilmedi**.
- Blok: R4 belirsizliği, R2 kova sınırı, Poly book eksik.

### C4 — Ocak 2027 değişiklik yok — `pending`, bloklu
- Poly 3215012, YES token `63563009…15330`, Poly event Ocak 26-27, 2027 toplantısını hedefliyor (`candidate-inventory.json:687,722-728`). Kalshi `KXFEDDECISION-27JAN-H0`, "January 27, 2027" (`kalshi-selected-markets.json:35`).
- Zaman: Kalshi close 2027-01-27T18:59Z; Poly endDate 2027-01-28T04:59Z. İşlem penceresi farkı; hedef aynı toplantı.
- Fiyat: Kalshi book 31 YES / 34 NO seviye (`source-manifest-3.json:14-17`). Poly 3215012 book **çekilmedi**.

### C5 — Poly Aralık kovaları ↔ KXFED seviye ailesi — `rejected` (eşlenmedi)
- Seviye ≠ değişim; KXFED listesi kısmi (cursor dolu). Tekil ticker eşlemesi yapılmadı, uydurulmadı. İleride en fazla `related` olarak farklar açıkça gösterilerek sunulabilir; eşdeğere terfi edilemez.

## Tazelik

- `received_at` ve HTTP `Date` kaynak zamanı (`sourceAsOf`) değildir.
- Kalshi book'ta kaynak zaman damgası yok. Kalshi metadata 19:42Z (manifest-2), book'lar 19:46Z (manifest-3): eşzamanlı çift değil. H0'da en iyi fiyatlar aynı, büyüklükler farklı (`kalshi-selected-markets.json:101` vs `kalshi-book-KXFEDDECISION-26DEC-H0.json:1`).
- Poly book `timestamp` 13 haneli string; UTC'ye çevrimi Hermes yapmalı.

## Ücret

- Poly: `fee = C × feeRate × p × (1−p)`; Economics katsayısı geçişte 0.05 → 0.01 (2026-11-20 23:59 UTC). Bu marketlerin kategorisi gözlenmedi; V2 per-market `fd.e` üssünün formüle etkisi belgede yok. Legacy `base_fee=1000` V2 oranı değildir.
- Kalshi: yalnız `fee_type quadratic_with_maker_fees`, `fee_multiplier 1`; formül/yuvarlama kanıtsız (PDF 429; arama snippet'leri yeterli değil).
- Sonuç: bilinmeyen ücret sıfır sayılmaz; net hesap kapalı. Ücret bilinmezliği outcome'ların farklı olduğuna kanıt olarak kullanılmaz; kural eşdeğerliği incelemesini değil, net hesabı ve qualified etiketini bloklar.

## K0 kabulü için eksikler

1. En az bir çift için Yusuf onayı (C1 önerilen ilk aday).
2. Kalshi ücret formülü ve yuvarlama (resmi kaynak).
3. Poly per-market `fd` ve kategori.
4. Poly 3215005 ve 3215012 book'ları; eşzamanlı, zaman damgası birimi doğrulanmış book çifti.
5. Kalshi C26 için temiz resmi kural metni.
6. Public yeniden gösterim / şartlar kontrolü.
