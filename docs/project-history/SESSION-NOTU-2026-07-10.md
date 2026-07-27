# Polymarket LP Hub — Fable session özeti (LH-C → LH-D, 2026-07-10 devam notu)

Proje: `C:\Users\wolfgang\polymarket-project` (Next.js, Vercel'e `main`'den otomatik deploy). Vercel: team `team_ccjCsaKRIxd92oJSpT2nbozw`, proje `polytrack`, repo `github.com/wolfgang1211/polytrack`. Canlı: `www.alphaboard.xyz`.

## Bu session'da tamamlananlar (hepsi main'de, production READY = `e3a0a25`)

* **LH-C — Model Validation köprüsü** (`789da30`): `/api/liquidity/validate` + `src/app/liquidity/ModelValidation.tsx` (`[08c]`, RecorderHealth altında). Gerçek maker-fill spread P&L (LH-8 replay) ile LH-9 sim reward'u aynı pencere/aynı marketlerde yan yana koyar; matchedVolumePct, ratio, market bazlı satırlar.
* **LH-C.1 — validate fill kaynağı data-api'ye** (`5349c55`): `src/lib/dataApiFills.ts` yeni. Maker fill'ler `data-api.polymarket.com/trades` üzerinden `takerOnly=false` − `takerOnly=true` FARKI ile çıkarılıyor (API rol etiketi vermiyor). data-api conditionId/title/outcome'u fill'le birlikte veriyor → gamma eşlemesi gereksizleşti.
* **LH-D — hibrit fill kaynağı** (`0d4eaf6` + `58eda9c`): LP Earnings (`/api/wallet/[address]/lp`) ve Timeline'ın graph fallback'i artık bayat subgraph'ın bittiği yerden data-api kuyruğuyla devam ediyor. `LpResponse`'a `freshFills` + `tailTruncated` eklendi; `LpEarnings.tsx`'te "+N live fills" / "recent history partial" rozetleri. Market isimleri için data-api fill metadata'sı gamma fallback'i.
* **LP Hub polish 4'lü** (`43796fd`): (1) fırsat kartlarında derinlik artık TÜM 40 market için tek `POST {CLOB}/books` batch çağrısıyla (eskiden hacme göre ilk 15 GET → çoğu kart "orderbook n/a" idi; per-market GET fallback duruyor); (2) backtest'e CLOB title fallback; (3) `Backtester.tsx`: `APR_ABSURD=500` — ≥%500 APR'ler coverage yeterli olsa da soluk `~` tahmin olarak gösteriliyor; (4) leaderboard'da hacmi $0 olan satırlar gizlendi.
* **Backtest fallback düzeltmesi** (`e3a0a25`): gamma dalı erken `return` yaptığı için CLOB fallback hiç çalışmıyordu → Promise.all sonrası İKİNCİ tarama geçişine taşındı. Canlıda doğrulandı: isimsiz market kalmadı.

## Kritik keşifler (mimariyi etkiler)

* **Orderbook subgraph ~25 Nisan 2026'da durdu** (81Dm16… — Graph explorer'da son fill 1777374040). `graphFills.ts` tüketicileri pencereli sorgularda herkes için boş döner. LH-8/timeline bu yüzden hibritlendi.
* **data-api tavanı: offset > 3000 → HTTP 400.** Rol başına en fazla ~3.500 satır/istek penceresi. `dataApiFills.ts` MAX_PAGES=7 ve `truncated` bayrağı döndürür. Hiperaktif cüzdanlarda (Eztennis ~3.5K satır/gün) bu kayan pencere gibi davranır → LP toplamları saatler içinde değişebilir; "recent history partial" rozeti bunu söylüyor. Bilinen sınır, bug değil.
* **Timeline'ın default'u zaten taze**: Path 0 = `user-pnl-api.polymarket.com` (Polymarket'in hazır günlük PnL'i). Subgraph sadece fallback.
* **LH-C ilk bulgusu**: hacim liderleri (spor/esport MM botları) reward-farm evreninde quote etmiyor → Eztennis 0/17 eşleşme (bug değil). Ayrıca resolution'a taşıyan MM'lerde spread-replay ~$0 gösterir (P&L redemption'da, fill tape'inde değil). LH-C.2 (farm marketlerinden maker mining) bilinçli olarak YAPILMADI: data-api market feed'i maker adresi vermiyor, değeri düşük.

## Canlı durum (son kontrol, 10 Tem akşam)

Recorder: healthy, medyan 10dk, **coverage %90** (151/168h), 2 gap (en uzun 6.6h). DİKKAT: snapshot sayısı 4 saatte 583→878 fırladı ve geçmiş GERİYE genişledi — 10dk kayıtçı bunu yapamaz; muhtemelen DİĞER SESSION KV'ye backfill yaptı (teyit edilmedi, kullanıcıya soruldu). Backtest/opportunities/vacancy/validate/lp verileri tutarlılık kontrollerinden geçti (negatif yok, çapraz bid/ask yok, monotonik seriler ✓). Zamanlanmış görev `lp-hub-lhc-readiness` DEVRE DIŞI bırakıldı (LH-C manuel kuruldu).

## Tuzaklar (bu ortamda ÇOK önemli)

* **Paralel session var!** Aynı repoda başka bir session insights üzerinde çalışıyor (`src/app/insights/*`, `src/lib/insights.ts` untracked). Onun dosyalarına DOKUNMA; "bozulmuş dosya" sandığın şey onun yarı-yazımı olabilir (bu session bir kez `insights/page.tsx`'i yanlışlıkla HEAD'e geri yükledi!). `.git/index.lock` taşımadan önce kullanıcıya sor — diğer session'ın aktif commit'i olabilir. Aynı anda tek session commit atsın; sadece kendi dosyalarını `git add` et.
* Host Write/Edit araçları dosyayı diskte truncate/NUL-padding ile bozabiliyor (bu session 5+ kez). Güvenilir desen: içerikleri python ile `git show HEAD:dosya` üzerinden string-replace edip yazmak; her yazım sonrası `wc -lc` + tail + NUL kontrolü.
* Working tree'de 28 dosyada saf CRLF/LF gürültüsü var (`--ignore-all-space` ile diff boş) — bunları STAGE'leme; dokunacağın CRLF dosyayı önce LF'e çevir (Edit eşleşmesi için de şart).
* Sandbox'tan push yok (kullanıcı push eder), `web_fetch` bu ortamda timeout'lu → canlı kontroller Chrome MCP ile (API JSON'ları `javascript_tool` + `JSON.parse(document.body.innerText)` deseniyle). Vercel deploy durumu Vercel MCP'den.
* Git lock'ları EPERM ile silinemiyor → `mv` ile kenara al (ama önce yukarıdaki paralel-session uyarısı).

## Sıradaki adaylar

1. Coverage %90 olduğuna göre LH-C'yi reward-farm marketlerinde gerçekten quote eden bir cüzdanla denemek (leaderboard değil; farm marketlerinin aktif maker'ı elle bulunursa anlamlı ratio ilk kez görülür).
2. LP response'ta hâlâ 1/12 isimsiz market kalabiliyor (subgraph-base token'ları, gamma miss) — LP'ye de CLOB fallback eklenebilir (backtest'teki ikinci-geçiş deseni).
3. Kozmetik borç: `liquidity/page.tsx`'te 11 eski eslint uyarısı, LPLeaderboardSection'daki `any[]`.
4. Snapshot backfill'i teyit et (diğer session mı yaptı?); evetse RecorderHealth'in "backfilled" veriyi ayrı göstermesi düşünülebilir.
