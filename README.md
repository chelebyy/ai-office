# Cheleby Home

Codex oturumlarını, kullanıcının seçtiği ofis görüntüsünde **sabit bir kamera açısından** izleme projesi. Güncel yön: referans görselden hazırlanan ofis katmanları, Cheleby'nin masada oturan ofis sürümü, ayrı robotlar, hareketli ekran içerikleri ve gerçek React bilgi panelleri. Serbest gezinme yok; bu aşamada masaüstü hedefleniyor.

**B2 sabit ofis, B3 Cheleby hareket önizlemesi, canlı laptop ekranı ve gerçek ajan adları hazır.** Kaynak ofis, perspektif ekranlar ve gerçek React panelleri mevcut yerel gözlemciyle çalışıyor. `/?view=office&motion=preview` veya Ayarlar → Cheleby hareket önizlemesi ile bekleme/yazma seçilebilir. Her iki poz gözlüksüzdür; beklerken bize, yazarken laptopa bakar. Yazarken eller sırayla kalkıp klavyeye basar; iki durum aynı referans ölçeğine hizalanır. Yazmada sandalye/gövde sabit, el/önkol katmanı hareketlidir. Laptop gerçek araç olaylarını ve görünür mesajı gösterir; ajan adları metadata üzerinden gelir. Sıradaki adım Cheleby'nin Bekleme/Yazma durumunu gerçek taze olaylara bağlamaktır; robot hareketleri ardından gelir. [B2 kaydı](docs/B2_FIXED_OFFICE_WEB_2026-09-12.md) · [B3 kapsamı ve doğrulama](docs/B3_CHELEBY_MOTION_PREVIEW_2026-09-12.md).

[Güncel görsel karar](docs/FIXED_CAMERA_OFFICE_DECISION_2026-09-12.md) · [Ürün planı](docs/CHELEBY_HOME_PLAN.md) · [Yol haritası](docs/CHELEBY_HOME_ROADMAP.md) · [Bağlantı kabulü](docs/CONNECTION_ACCEPTANCE_2026-09-11.md) · [3D ofis kabulü](docs/OFFICE_PROTOTYPE_2026-09-11.md) · [Performans ve Blender](docs/PERFORMANCE_AND_BLENDER_2026-09-12.md)

## Güncel görsel karar ve sıradaki teslim

[Seçilen ofis görseli](docs/concepts/office-concept-v3-mascot.png) ana referanstır. B2'de görüntünün sabit bölümleri korundu; karakter/sandalye kesitleri, ekranlar ve ön örtücü parçalar ayrı katmanlarda çalışıyor. Kurulu Cheleby peti kimlik kaynağıdır ve değiştirilmez.

**B1 v2** [Cheleby masa pozu](docs/concepts/cheleby-office-b1-v2.png) B2'nin kaynak karesidir. Kullanıcı B2'ye geçilmesini istedi. Tam sayfa yerleşimi kullanıcı tarafından kabul edildi. B3'te gözlüksüz iki poz ve titreşim düzeltmesi hazır; kullanıcı r5 için “şimdi daha iyi” dedi. R6 canlı laptop ve ajan adları Chrome'da doğrulandı; kapsamlı son görsel kabul iddia edilmez. [İlk görsel kayıt](docs/B1_CHELEBY_OFFICE_STILL_2026-09-12.md), [güncel karar](docs/FIXED_CAMERA_OFFICE_DECISION_2026-09-12.md).

`/` ve `/?view=office` yeni sabit ofisi açar. Karaktere tıkla; gerçek oturum ve son görünür asistan mesajı açılır. Sol alttan oturum seçilebilir. Ayarlardan TR/EN/otomatik dil, etiketler, ekranlar ve karakter katmanı değiştirilebilir. Bağlı alt ajanı olmayan masa açıkça atanmadı olarak gösterilir. `/?view=events` gözlemci geçmişi, `/?view=legacy` önceki WebGL ofis, `/?view=blender` ise gösterim hareketleri içeren GLB pilotudur.

Son devam noktası: [kapsamlı oturum devir belgesi](.claude/handoffs/2026-09-12-235834-cheleby-office-motion-live-screens.md).

## Başlatma

Gereksinim: Node.js **24.13 veya daha yeni bir 24.x** sürümü ve npm. Bağımlılıklar kilit dosyasında sabittir. İlk doğrulama Windows üzerinde yapıldı; macOS/Linux çalışma kabulü henüz yapılmadı.

Proje klasöründe:

```sh
npm ci
npm run build
npm start
```

Tarayıcıda **http://127.0.0.1:4317/** adresini aç. Durdurmak için sunucuyu başlattığın terminalde `Ctrl+C` kullan. Şimdilik derlemede ve başlatmada geliştirme bağımlılıkları da gereklidir; `--omit=dev` kullanma.

Geliştirme sırasında `npm run dev` kullanılabilir. Bu modda kaynaklar Vite üzerinden sunulur; otomatik sıcak yenileme kapalıdır. Web değişikliklerinde sayfayı yenile, gözlemci değişikliklerinde süreci yeniden başlat. Normal `npm start` kullanımında web değişikliklerinden sonra yeniden derle.

## Yapılandırma

| Ortam değişkeni | Varsayılan | Açıklama |
| --- | --- | --- |
| `CHELEBY_CODEX_HOME` | `CODEX_HOME`, yoksa kullanıcı profilindeki `.codex` | Codex profil kökü; `sessions` alt klasörü okunur. |
| `CHELEBY_PORT` | `4317` | Yerel port; 1024–65535. |
| `CHELEBY_RECENT_DAYS` | `7` | Keşfedilecek oluşturulma günü; 1–366. |
| `CHELEBY_MAX_FILES` | `60` | Aynı anda seçilecek yakın kayıt üst sınırı; 1–250. |
| `CHELEBY_POLL_MS` | `1500` | Artımlı kontrol aralığı; 500–30000 ms. |

Örneğin PowerShell'de başka bir profili okumak için:

```powershell
$env:CHELEBY_CODEX_HOME = 'D:\CodexProfile'
npm start
```

POSIX kabuk karşılığı: `CHELEBY_CODEX_HOME=/path/to/profile npm start`. Yol taşınabilirliği tasarıma işlendi; bu komut örneği macOS/Linux kabul kanıtı değildir.

## Mevcut teknik prototiplerde görülenler

Aşağıdaki kamera, model ve dar ekran davranışları mevcut v0.2 uygulamasını anlatır; yeni sabit açılı tasarımın kabul şartları değildir.

- Gerçek 3D oda: ahşap zemin, masalar, bitkiler, dinlenme köşesi, dağ/orman manzaralı pencere ve ana oturumun son etkinliğini gösteren duvar ekranı.
- Ofis, ana masa ve üstten kamera; sürükleyerek döndürme, tekerlekle yaklaşma ve kamera sıfırlama. Dokunmatik kullanımda sürükleme ve iki parmakla yakınlaşma hedeflenir; fiziksel dokunmatik cihaz kabulü açık.
- Gözlüksüz kapüşonlu ana maskot ve üç robot modeli. Bağlı alt ajanı olmayan robotlar açıkça **model örneği** olarak etiketlenir. Yazma hareketi yalnızca taze, erişilebilir ve çalışıyor durumundaki kayıtta etkinleşir.
- Karakter seçimi, açılır ayrıntı paneli, standart/yüksek kalite ve hareket ayarı. Azaltılmış hareket tercihi ilk açılışta uygulanır; WebGL kaybında yeniden deneme veya olay ekranına geçiş sunulur.
- Görünüm ayarlarında **Dengeli (60 FPS)** ve **Tasarruf (30 FPS)** kaynak kullanımı seçimi. Tasarruf piksel yoğunluğunu 1 ile sınırlar ve yüksek kaliteyi kapatır; tercih bu tarayıcıda saklanır. Hareket gerekmeyen sahne yalnızca veri veya kamera değiştiğinde çizilir. Belge gizlendiğinde çizim ve animasyon planlaması durur. Ölçüm alanı gerçek çizilen kareleri gösterir; CPU/GPU yüzdesi değildir.
- Metadata kaynaklı ana oturum, alt ajan ve sistem yardımcısı ayrımı. Fork tek başına alt ajan sayılmaz.
- Son gözlenen tur başlangıcı/bitişi/iptali, araç çağrısı/sonucu ve görünür asistan mesajları.
- Oturum seçimi, kaynak filtresi, veri kapsamı, görünümü duraklatma ve yeniden bağlanma.
- Ekran genişliğini kullanan düzen; dar ekranda alt alta paneller.
- İlk Türkçe/İngilizce dil dosyaları. Belirgin kullanıcı mesajından dil seçimi; aksi durumda tarayıcı dili ve İngilizce yedek. Dil algılama sezgiseldir, diğer dillerin çevirisi henüz yoktur.

Üstteki **Ofis / Olaylar** düğmeleri aynı yerel gözlemcinin iki görünümünü açar. Soldan bir oturum seçildiğinde tek oda örneği o oturumun verisiyle güncellenir; henüz çok odalı bir bina gösterilmez. Sahne üç alt ajan masasını gösterebilir; ekip sayacı daha geniş ekibi sayabilir, tüm kayıtlar Olaylar görünümünden incelenir. Bu v0.2 model ve animasyonları kodla üretilmiştir. Ayrı Blender/GLB pilotu korunur. Yeni B2 görünümü yukarıda açıklanan ayrı rotadır; B1 v2 karesinin katmanlarını kullanır; isteğe bağlı B3 önizlemesinde Cheleby için ayrı bekleme/yazma atlasları vardır. Tam 3D iskelet, yürüme ve oturup kalkma güncel görsel teslimin ön koşulu değildir.

## Veri sınırları

Gözlemci yalnızca kayıt okur, Codex'e komut göndermez. Web sunucusu `127.0.0.1` adresine bağlanır; yerel oturum çerezi ve kaynak kontrolü kullanır. Ham kullanıcı mesajı, modelin iç muhakemesi, talimatlar ve araç girdisi/çıktısı tarayıcıya aktarılmaz. Görünür asistan mesajlarında sık rastlanan erişim bilgisi kalıpları maskelenir; bu tam anonimleştirme değildir.

Sayaçlar **okunan kayıt aralığını** temsil eder. Başlangıçta büyük dosyanın metadata satırı ve son 2 MiB'ı okunur; kesilen geçmiş işaretlenir. Oturum başına en çok 120 yakın olay tutulur. Yeni keşif son 7 oluşturulma günüyle sınırlıdır; önceden izlenen daha eski dosyalar süreç içinde izlenmeye devam eder. Daha eski, hâlâ kullanılan bir oturum görünmüyorsa gün sınırını artır.

`Tur bitti`, oturumun kapandığı anlamına gelmez. Eski bir kayıttaki `Çalışıyor` etiketi de sürecin hâlâ çalıştığının kanıtı değildir; güncellik uyarısı bu ayrımı gösterir. Araç sonucunun başarı/hata içeriği, test toplamı, maliyet ve ilerleme yüzdesi çıkarılmaz. Sarmalanmış çağrılarda yalnızca sarmalayıcı adı görünebilir.

Geçmiş şu an bellektedir. Gözlemci yeniden başlayınca mevcut dosya penceresinden tekrar kurulur; önceki olay sayılarının aynen korunması garanti edilmez. Kalıcı veritabanı, replay ve kaynak sürümlerini kapsayan kararlılık çalışması yol haritasındadır.

## Kontroller ve dosyalar

```sh
npm run check
```

Bu komut tip kontrolünü, 37 davranış testini ve web derlemesini çalıştırır. Testler proje içindeki geçici örneklerle çalışır; gerçek Codex kayıtlarına yazmaz. Kamera, karakter seçimi, WebGL yeniden açma ve ekran boyutları ayrıca Windows/Chromium üzerinde denendi; diğer cihaz ve tarayıcılar için sonuç çıkarılmaz.

| Konum | Sorumluluk |
| --- | --- |
| `src/observer` | Kayıt ayrıştırma, artımlı okuma, yerel HTTP/WebSocket. |
| `src/shared/contract.ts` | Gözlemci ve arayüzün sürümlü veri sözleşmesi. |
| `src/web` | React arayüzü, dil kaynakları ve bağlantı yönetimi. |
| `src/web/office` | Mevcut WebGL oda ve Blender pilotu, karakterler ve ofis arayüzü. |
| `test` | Kayıt, okuma ve yerel bağlantı davranışları. |
| `docs` | Kararlar, konseptler, yol haritası ve kabul raporu. |

`.local`, `.playwright-mcp`, `.cache`, `node_modules`, `dist` ve ortam dosyaları Git dışında tutulur. Yerel ekran kayıtları oturum bilgisi içerebilir. GitHub yayını henüz yapılmadı; paylaşım hazırlığı ayrı aşamadır.
