# AI Office

**Codex oturumlarını ve ajanlarını aynı sanal ofiste izle.**

AI Office, bilgisayarındaki **OpenAI Codex** oturumlarını masaüstü tarayıcında sabit kameralı bir ofis olarak gösterir. Her ana oturumun ayrı odası vardır; bağlı ajanları kendi masalarında görünür.

[English](README.md) · [MIT lisansı](LICENSE) · [Katkı rehberi](CONTRIBUTING.md)

[![CI](https://github.com/chelebyy/ai-office/actions/workflows/ci.yml/badge.svg)](https://github.com/chelebyy/ai-office/actions/workflows/ci.yml)

## Ne işe yarar?

Birden fazla projede Codex ile çalışırken sürekli konuşmalar arasında dolaşmadan hangi oturumun çalıştığını, hangisinin yanıtını beklediğini ve en son ne yaptığını görmeni sağlar.

- Projelerin altından oturumları seçebilir, odalar arasında geçebilir ve etkinliklerini izleyebilirsin.
- Ana karakter ve üç robot masası, bağlı oturumların çalışma/bekleme durumunu yansıtır. Daha büyük ekiplerin bilgileri oturum ve olay görünümünde kalır.
- Duvar ekranı ve büyütülebilir akış, gözlenen araç etkinliklerini ve görünür asistan mesajlarını gösterir.
- Küçük monitörlerdeki kod/terminal içerikleri etkinliğe bağlı dekoratif animasyonlardır; gerçek editör veya terminalin birebir görüntüsü değildir.
- Gündüz/gece, isteğe bağlı konum ve hava durumu, hareket ayarları ve Türkçe/İngilizce arayüz kullanılabilir.

Bu bir **izleme arayüzüdür**. Codex'e komut göndermez; soru ve yanıtlarını Codex'teki asıl konuşmada sürdürürsün. Güç menüsü Codex görevlerini değil, yerel gözlemciyi yönetir. Ofis etkinliğini oluşturmak için LLM çağrısı yapmaz ve Codex aboneliği sağlamaz.

## Nerede denendi?

| Ortam | Durum |
| --- | --- |
| Windows | Yerel gözlemci, başlatıcılar, tarayıcı kontrolleri ve masaüstü arayüzü kontrol edildi. |
| Linux | Ubuntu 26.04 / WSL 2 içinde gerçek Linux Node.js ile test, derleme, dosya izleme ve Windows Chrome üzerinden canlı arayüz kontrolleri yapıldı. |
| macOS | Cihaz olmadığı için denenmedi. |

Linux kabulünde Linux dosya sistemindeki temsili oturum kayıtları ve WSL'den okunan gerçek Windows Codex Desktop kaydı kullanıldı. Yerel Linux Codex CLI'nin kendi gerçek oturum yaşam döngüsü, diğer dağıtımlar ve yerel Linux masaüstü tarayıcısı bu kabulün dışında kaldı. [Doğrulama kapsamı](docs/PLATFORMS.md).

**Yalnızca Codex için geliştirildi ve Codex ile denendi.** Diğer LLM ve ajan araçlarıyla denenmedi. Masaüstü tarayıcı hedeflenir; telefon kullanımı desteklenen hedef değildir. OpenAI'ın resmî ürünü olmayan bağımsız bir topluluk projesidir.

## Kurulum

Git, Node.js **24.13 veya daha yeni bir 24.x sürümü**, npm ve yerel Codex kayıtları gerekir.

```sh
git clone https://github.com/chelebyy/ai-office.git
cd ai-office
npm ci
npm run build
npm start
```

Terminalde yazan adresi aç: varsayılan **http://127.0.0.1:4317/**. Elle başlatılan sunucuyu `Ctrl+C` ile durdur. Geliştirme bağımlılıkları da gereklidir; `--omit=dev` kullanma.

**Windows:** Hazırlık sonrası `Ofisi Ac.cmd` ile aç, `Ofisi Kapat.cmd` ile yönetilen sunucuyu kapat. Tarayıcı sekmesini kapatmak sunucuyu durdurmaz. `scripts/install-office-shortcut.ps1` ve aynı betiğin `-Stop` seçeneği isteğe bağlı masaüstü kısayollarını kurar.

**Linux / WSL:** Linux içinde ayrı Node ve bağımlılıklar kullan; Windows `node_modules` klasörünü paylaşma.

```sh
sh scripts/start-office.sh --port 4327
sh scripts/start-office.sh --action status --port 4327
sh scripts/stop-office.sh --port 4327
```

JSON yanıtındaki adresi tarayıcıda aç. Betikler paket kurmaz veya tarayıcı açmaz. Profil seçimi ve tüm ortam değişkenleri için [yapılandırma rehberine](README.md#configuration) bak. Windows ve Linux profilleri otomatik birleştirilmez.

## Veri ve sınırlar

Oturum kayıtları yerel gözlemci ve tarayıcı arasında işlenir; sunucu `127.0.0.1` üzerinde çalışır. İsteğe bağlı şehir araması ve hava durumu Open-Meteo'ya arama metni veya seçili koordinatları gönderir; oturum kayıtlarını göndermez.

Ham kullanıcı mesajları, iç muhakeme ve tam araç girdisi/çıktısı tarayıcıya aktarılmaz. Görünür sorular, asistan mesajları ve sınırlı etkinlik önizlemeleri özel bilgi içerebilir. Maskeleme tam anonimleştirme değildir; ekran görüntüsü paylaşmadan önce içeriği kontrol et.

Geçmiş sınırlı bir kayıt penceresinden okunur ve yeniden başlatmada tekrar oluşturulur. Bir turun bitmesi oturumun kapanması değildir. Maliyet, test başarısı veya tamamlanma yüzdesi tahmin edilmez. Codex kayıt biçiminin değişmesi uyumluluğu etkileyebilir.

## Doğrulamalar

`npm run check` depo gizlilik kontrolü, tip kontrolü, davranış testleri ve üretim derlemesini çalıştırır.

- **26 Eylül 2026 Windows:** 128 test geçti, hata yok, Linux'a özel 1 grup atlandı; tip kontrolü ve derleme geçti.
- **17 Eylül 2026 Ubuntu/WSL:** 100 test, tip kontrolü, derleme ve 7 canlı tarayıcı kontrolü geçti. Windows'a özel grup burada atlandı.
- Bu sayılar ayrı tarihlerdeki koşulara aittir. Son Windows koşusunda Linux grubunun atlanması, Linux'un hiç denenmediği anlamına gelmez; son commitin Linux'ta yeniden çalıştırıldığı da iddia edilmez.

CI, Windows ve Linux üzerinde otomatik test ve derleme çalıştırır. Sürüm etiketleri aynı kontrollerden sonra GitHub kaynak sürümünü yayımlar; sunucuya dağıtım yapılmaz.

[Mimari](docs/ARCHITECTURE.md) · [Platformlar](docs/PLATFORMS.md) · [Gizlilik](docs/PRIVACY.md) · [Güvenlik](SECURITY.md)

## Lisans

[MIT](LICENSE): herkes kullanabilir, kopyalayabilir, değiştirebilir, dağıtabilir ve ticari/kapalı kaynak projelerine dahil edebilir. Telif ve lisans metni korunmalıdır. Garanti verilmez; üçüncü taraf bağımlılıklar kendi lisanslarına tabidir.

Yapılandırmada `AI_OFFICE_*` adları kullanılır. Eski `CHELEBY_*` değişkenleri, yeni karşılığı boş veya tanımsızsa uyumluluk için okunur.
