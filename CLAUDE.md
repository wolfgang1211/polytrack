@AGENTS.md

# AlphaBoard Analytics | Proje talimatı

## Amaç
Polymarket varsayılanını koruyarak AlphaBoard analiz ve market keşif arayüzünün yerel bakımını yürüt. Ürün metinleri İngilizce.

## İşe başlama ve bırakma
1. Her turda önce bu klasördeki `DURUM.md` dosyasını oku; tek güncel ilerleme kaydı odur. Eski raporları kanıt olarak koru, onay kaynağı sayma.
2. Geçerli çalışma dizini `C:/Users/wolfgang/polytrack` olmalı. Yalnız `DURUM.md` içindeki doğrulanmış proje oturumunu sürdür, tek yazan oturum kullan; ikinci worker başlatma. Oturum geçmişi burada taşınmadı.
3. Sadece açıkça onaylanmış tek küçük adımı işleme al. `ONAY BEKLİYOR` durumundaki sırayı çalıştırma ve sıradaki adıma kendiliğinden geçme.
4. Bitince veya güvenli kesilme anında `DURUM.md` içine tarih, son adım, sonuç/exit, kanıt yolları, engel ve sonraki küçük adımı yaz. Ani süreç kaybında üst oturum son kanıtı okuyup kesintiyi işaretler; başarı uydurma.

## İzinli kapsam
Onay verilen dilimde polytrack kodu ve yerel doğrulama. @AGENTS.md içindeki teknik sözleşmeyi ve üretim sınırlarını koru. Analytics bayrağını açma, finansal veri yorumu/fallback değiştirme veya sağlayıcı varsayılanlarını değiştirme.

## Yasak işlemler
Dosya silme, commit, push, PR/yayın, deploy, cüzdan bağlantısı, imza/işlem, finansal harcama, gizli dosya/credential erişimi, başka proje veya cron/hesap ayarı değişikliği yok. Yetki veya araç sınırlarını aşma. Kurulumun kendisi ürün görevi başlatmaz.

## Nasıl test edilir
Odaklı Node testleri; sonra gerekiyorsa mevcut npm test, npm run lint, TypeScript noEmit ve npm run build. HTTP/SSR ile gerçek tarayıcı kabulünü ayrı kaydet; kullanıcı mevcut tarayıcı erişimi vermediyse görsel PASS yok.

## Bitti tanımı
İstenen kullanıcı davranışı gerçek kabul satırlarıyla doğrulandı, yerel kanıt ve exit kodu yazıldı, önceki kapsam korunuyor; tarayıcı engeli varsa kısmi.
