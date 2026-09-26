# AI Office

A desktop-browser office for watching your **OpenAI Codex** sessions and agents work in real time.

**Compatibility:** Built for and tested with Codex only. Other LLMs, assistants, and agent tools have not been tested; compatibility is not claimed. AI Office is an independent community project, not an official OpenAI product. Earlier development notes use the former name **Cheleby Home**.

**License:** [MIT](LICENSE). You may use, copy, modify, redistribute, and sell this project, including in commercial and closed-source projects, as long as you retain the copyright and license notice. No warranty is provided. Third-party dependencies retain their own licenses.

## Quick start

Install Node.js 24.13 or later within the 24.x line, and use Codex locally so there are sessions to observe.

```sh
git clone https://github.com/chelebyy/ai-office.git
cd ai-office
npm ci
npm run build
npm start
```

Open the local URL printed in the terminal (normally http://127.0.0.1:4317). The observer reads local Codex session records; it does not provide a model subscription or run another LLM. The office may display session messages and tool activity, so review what is visible before sharing screenshots or a screen recording.

## Türkçe

**Uyumluluk:** Yalnızca Codex için geliştirildi ve Codex ile denendi. Diğer LLM ve ajan araçlarıyla denenmedi; uyumluluk garantisi verilmez. Bağımsız bir topluluk projesidir.

**Lisans:** MIT lisansı ile herkes kullanabilir, değiştirebilir, paylaşabilir ve ticari projelerine dahil edebilir. Telif ve lisans metni korunmalıdır. Garanti verilmez; üçüncü taraf bağımlılıklar kendi lisanslarına tabidir.

## Geliştirme notları

Codex oturumlarını, kullanıcının seçtiği ofis görüntüsünde **sabit bir kamera açısından** izleme projesi. Güncel yön: referans görselden hazırlanan ofis katmanları, Cheleby'nin masada oturan ofis sürümü, ayrı robotlar, hareketli ekran içerikleri ve gerçek React bilgi panelleri. Serbest gezinme yok; bu aşamada masaüstü hedefleniyor.

**B2 sabit ofis, B3 hareketler ve r11 küçük ve yuvarlak robot başları ile canlı Cheleby/robot bağlantısı hazır.** Kaynak ofis, perspektif ekranlar ve gerçek React panelleri mevcut yerel gözlemciyle çalışıyor. `/?view=office&motion=preview` veya Ayarlar → Cheleby hareket önizlemesi ile bekleme/yazma seçilebilir. Her iki poz gözlüksüzdür; beklerken bize, yazarken laptopa bakar. Yazarken eller sırayla kalkıp klavyeye basar; iki durum aynı referans ölçeğine hizalanır. Yazmada sandalye/gövde sabit, el/önkol katmanı hareketlidir. Büyük duvar gerçek araç olaylarını ve görünür mesajı gösterir; küçük monitörler ve laptop masanın gerçek çalışma durumuna bağlı dekoratif kod/terminal akışı kullanır. Ajan adları metadata üzerinden gelir. Normal ofiste Bekleme/Yazma artık ana oturumun taze durumundan otomatik seçilir. Kesinti, eskime ve eksik veride son poz donarak korunur; tur bitişi veya girdi bekleme kullanıcıya dönük pozu seçer. Mavi, yeşil ve mor robotlar kendi alt ajanlarının taze durumuna göre bağımsız Bekleme/Yazma hareketi seçer; baş ve önkol hareket ederken gövde ve sandalye sabit kalır. R9'da pembe el maskesine karışan masa parçası ayrıldı; üç robot daha küçük, hızlı ve aralıklı tuş basışlarına geçti. R10 başları büyük bulunduğu için kullanıcı tarafından reddedildi. R11, pembe robotun yuvarlak biçimini örnek alan yeni mavi/yeşil başları yaklaşık %20 daha dar yerleştirir ve görüntü oranını esnetmez. Pembe robot, R9 el ritimleri ve R10 sabit çene düzeltmesi korunur. Manuel önizlemeler ayrı kalır: `/?view=office&robotMotion=preview` veya Ayarlar → Robot hareket önizlemesi. Yeşil robotun boyun/sandalye birleşimi kullanıcı isteğiyle ertelendi. C'de gerçek CLI tamamlama/devam, Desktop alt ajanı yeniden görevlendirme/kesme, ekran tutarlılığı, eskime ve kesinti toparlanması doğrulandı. Gözlem zamanı düzeltmesiyle 55 test, TypeScript ve derleme geçti; Gerçek engelleyici girdi bekleme açık. [C canlı kabul raporu](docs/C_LIVE_OFFICE_ACCEPTANCE_2026-09-13.md). [B2 kaydı](docs/B2_FIXED_OFFICE_WEB_2026-09-12.md) · [B3 kapsamı ve doğrulama](docs/B3_CHELEBY_MOTION_PREVIEW_2026-09-12.md).

[Güncel görsel karar](docs/FIXED_CAMERA_OFFICE_DECISION_2026-09-12.md) · [Ürün planı](docs/CHELEBY_HOME_PLAN.md) · [Yol haritası](docs/CHELEBY_HOME_ROADMAP.md) · [Bağlantı kabulü](docs/CONNECTION_ACCEPTANCE_2026-09-11.md) · [3D ofis kabulü](docs/OFFICE_PROTOTYPE_2026-09-11.md) · [Performans ve Blender](docs/PERFORMANCE_AND_BLENDER_2026-09-12.md)

**D1 r2 canlı Odalar hazır:** Alt panelde proje başlıklarının altında gerçek oturum adları görünür. Gözlenen çalışan/cevap bekleyen odalar ve seçili oda listelenir; seçili oda iş bitince pasif kalır, diğer bitenler gizlenir. Başlık ışığı çalışma varsa yeşildir. Tam arşiv yüklenmez; seçim yenilemede korunur. 66 test, tip kontrolü, derleme ve tarayıcı kontrolleri geçti. [Güncel Odalar kaydı](docs/D1_LIVE_ROOMS_2026-09-13.md).

**Canlı oda keşfi tamamlandı:** Eski tarihli bir oturum yeniden çalışınca, arşiv içerikleri topluca yüklenmeden bulunur. Gerçek Desktop ve CLI aynı anda, oda/ekip ayrımı ve tek oturumun tamamlanmasıyla doğrulandı; 69 test geçti. [Keşif ve gerçek oda kabulü](docs/D_LIVE_DISCOVERY_2026-09-13.md).


**Küçük ekranlar:** 14 farklı kod/terminal/dosya görünümü, doğal yazma araları ve masaya bağlı hareket hazır. Duvar canlı akış olarak korunup renklendirildi. [Karar ve doğrulama](docs/MONITOR_ARTWORK_2026-09-13.md).

**Canlı ekran ve Odalar güncellemesi:** Sıralı mesaj/işlem akışı ve büyütme penceresi, cevap gelene kadar kullanıcıya dönük Cheleby ve soru kartı, Türkçe etkinlikler, düzeltilmiş ekran hizası ve kalıcı sürükle-bırak oda sırası hazır. Eski sorular canlı oda sayılmaz. Tarama yayını ve takılan kaynak okumaları için koruma eklendi. [Davranış, sınırlar ve doğrulama](docs/LIVE_FEED_AND_QUESTIONS_2026-09-13.md).

## Güncel görsel karar ve sıradaki teslim

[Seçilen ofis görseli](docs/concepts/office-concept-v3-mascot.png) ana referanstır. B2'de görüntünün sabit bölümleri korundu; karakter/sandalye kesitleri, ekranlar ve ön örtücü parçalar ayrı katmanlarda çalışıyor. Kurulu Cheleby peti kimlik kaynağıdır ve değiştirilmez.

**B1 v2** [Cheleby masa pozu](docs/concepts/cheleby-office-b1-v2.png) B2'nin kaynak karesidir. Kullanıcı B2'ye geçilmesini istedi. Tam sayfa yerleşimi kullanıcı tarafından kabul edildi. B3'te gözlüksüz iki poz ve titreşim düzeltmesi hazır; kullanıcı r5 için “şimdi daha iyi” dedi. R6 canlı laptop ve ajan adları Chrome'da doğrulandı; kapsamlı son görsel kabul iddia edilmez. [İlk görsel kayıt](docs/B1_CHELEBY_OFFICE_STILL_2026-09-12.md), [güncel karar](docs/FIXED_CAMERA_OFFICE_DECISION_2026-09-12.md).

`/` ve `/?view=office` yeni sabit ofisi açar. Karaktere tıkla; gerçek oturum ve son görünür asistan mesajı açılır. Sol alttan oturum seçilebilir. Ayarlardan TR/EN/otomatik dil, etiketler, ekranlar ve karakter katmanı değiştirilebilir. Bağlı alt ajanı olmayan masa açıkça atanmadı olarak gösterilir. `/?view=events` gözlemci geçmişi, `/?view=legacy` önceki WebGL ofis, `/?view=blender` ise gösterim hareketleri içeren GLB pilotudur.

Son devam noktası: [kapsamlı oturum devir belgesi](.claude/handoffs/2026-09-12-235834-cheleby-office-motion-live-screens.md).

## Başlatma

**Windows'ta tek tık:** masaüstündeki **Cheleby Home** kısayolunu veya proje klasöründeki `Ofisi Ac.cmd` dosyasını aç. Ofis kapalıysa hazırlanıp başlatılır; çalışıyorsa aynı sunucu kullanılır. Terminal penceresi gerekmez. Kısayolu yeniden kurmak için `scripts/install-office-shortcut.ps1` kullanılır. [Davranış, günlükler ve kabul](docs/E1_WINDOWS_LAUNCHER_2026-09-14.md).

Tarayıcıyı kapatmak gözlemciyi durdurmaz; tekrar açılış varsayılan tarayıcıda yeni sekme oluşturabilir. Aşağıdaki komutlar terminalden elle başlatma içindir.

**Tarayıcıdan kontrol:** sağ üstteki güç menüsünden bütün odaların canlı takibini başlatabilir, durdurabilir veya yeniden başlatabilirsin. Durdurduğunda sayfa açık kalır; diğer sekmeler de aynı durumu görür. [Davranış ve kabul](docs/E2_BROWSER_CONTROLS_2026-09-14.md).

**Kapatma ve toparlanma:** `Ofisi Kapat.cmd` veya **Cheleby Home - Kapat** masaüstü kısayolu sunucuyu ve yeniden denemeleri kapatır. Kapatma kısayolu `scripts/install-office-shortcut.ps1 -Stop` ile kurulur. Beklenmedik sunucu kapanışında en fazla üç otomatik deneme yapılır. Tarayıcı sekmesini kapatmak sunucuyu durdurmaz. [E2 davranışı ve sınırlar](docs/E2_RECOVERY_2026-09-14.md).

Gereksinim: Node.js **24.13 veya daha yeni bir 24.x** sürümü ve npm. Bağımlılıklar kilit dosyasında sabittir. Windows ve Ubuntu/WSL üzerinde ölçülen çalışma kabulü yapıldı; diğer Linux ortamları açık, macOS ertelendi.

Proje klasöründe:

```sh
npm ci
npm run build
npm start
```

Tarayıcıda **http://127.0.0.1:4317/** adresini aç. Durdurmak için sunucuyu başlattığın terminalde `Ctrl+C` kullan. Şimdilik derlemede ve başlatmada geliştirme bağımlılıkları da gereklidir; `--omit=dev` kullanma.

Geliştirme sırasında `npm run dev` kullanılabilir. Bu modda kaynaklar Vite üzerinden sunulur; otomatik sıcak yenileme kapalıdır. Web değişikliklerinde sayfayı yenile, gözlemci değişikliklerinde süreci yeniden başlat. Normal `npm start` kullanımında web değişikliklerinden sonra yeniden derle.

## Linux / WSL

**Ubuntu 26.04 / WSL 2 üzerinde ölçülen kapsam doğrulandı.** Yalıtılmış Linux Node 24.13 ortamında 100 test, tip kontrolü, derleme ve Windows Chrome’dan 7 canlı tarayıcı kontrolü geçti. Linux dosya sistemindeki temsili kayıtlar ve Windows’taki gerçek Desktop kaydının WSL’den güncellenerek okunması doğrulandı. Ubuntu’ya global Node/Codex kurulmadı; Linux Codex CLI’nin kendi gerçek oturumu ve diğer dağıtımlar açık, macOS cihaz olmadığı için ertelendi. [Kabul, kanıt ve sınırlar](docs/F2_WSL_ACCEPTANCE_2026-09-17.md).

Linux içinde Node.js 24.13+ (24.x) ve `npm ci` ile kurulmuş ayrı Linux bağımlılıkları gerekir. Windows `node_modules` klasörünü kullanma. Linux proje kopyasını Linux dosya sisteminde tutmak tercih edilir. [WSL dosya sistemi rehberi](https://learn.microsoft.com/en-us/windows/wsl/filesystems).

Linux proje klasöründe, gereksinimler kurulduktan sonra:

```sh
sh scripts/start-office.sh --port 4327
sh scripts/start-office.sh --action status --port 4327
sh scripts/stop-office.sh --port 4327
```

Başlatıcı JSON yanıtındaki URL’yi Windows tarayıcısında aç; örnekte `http://127.0.0.1:4327/`. 4327, Windows ofisinin 4317 portundan ayrı test içindir. Betikler tarayıcı açmaz ve paket kurmaz. [Windows’tan WSL uygulamasına localhost erişimi](https://learn.microsoft.com/en-us/windows/wsl/networking#accessing-linux-networking-apps-from-windows-localhost).

Varsayılan kaynak Linux kullanıcısının `CODEX_HOME` / `~/.codex` dizinidir. Windows ve Linux kayıtları otomatik birleştirilmez. Windows kaynağını WSL’den salt okunur izlemek için, yalnızca bu kaynağı istediğinde:

```sh
CHELEBY_CODEX_HOME='/mnt/c/Users/muham/.codex' sh scripts/start-office.sh --port 4327
```

Çalışan sunucu tekrar kullanılır; kaynak değişikliği için önce aynı portu durdurup yeni değişkenle aç. Linux başlatıcı testleri `test/launcher.linux.test.ts` içindedir; Windows’ta bu test açıkça atlanır. Bu test grubu Ubuntu/WSL’de geçti; diğer Linux ortamları için ayrıca gerçek kabul gerekir. Linux denetim kanalı kullanıcıya özel anahtarla doğrulanan soyut Unix soketidir; normal kapanışta veya süreç kaybında eski soket dosyası bırakmaz.

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

Gözlemci yalnızca kayıt okur, Codex'e komut göndermez. Web sunucusu `127.0.0.1` adresine bağlanır; yerel oturum çerezi ve kaynak kontrolü kullanır. Ham kullanıcı mesajı, modelin iç muhakemesi, talimatlar ve ham araç girdisi/çıktısı tarayıcıya aktarılmaz. Görünür soru metinleri ile izin verilen komut/dosya alanlarının sınırlı önizlemeleri canlı ekrana taşınır; dosya değiştirme gövdeleri ve tam araç çıktıları gösterilmez. Görünür asistan mesajlarında sık rastlanan erişim bilgisi kalıpları maskelenir; bu tam anonimleştirme değildir.

Sayaçlar **okunan kayıt aralığını** temsil eder. Başlangıçta büyük dosyanın metadata satırı ve son 2 MiB'ı okunur; kesilen geçmiş işaretlenir. Oturum başına en çok 120 yakın olay tutulur. Yeni keşif son 7 oluşturulma günüyle sınırlıdır; önceden izlenen daha eski dosyalar süreç içinde izlenmeye devam eder. Daha eski, hâlâ kullanılan bir oturum görünmüyorsa gün sınırını artır.

`Tur bitti`, oturumun kapandığı anlamına gelmez. Eski bir kayıttaki `Çalışıyor` etiketi de sürecin hâlâ çalıştığının kanıtı değildir; güncellik uyarısı bu ayrımı gösterir. Araç sonucunun başarı/hata içeriği, test toplamı, maliyet ve ilerleme yüzdesi çıkarılmaz. Sarmalanmış çağrılarda statik olarak okunabilen araç ve dosya/komut özetleri gösterilir; dinamik veya desteklenmeyen içerikte genel etkinlik etiketi kalır.

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
