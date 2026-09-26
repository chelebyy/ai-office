# AI Office

**Codex oturumlarını ve ajanlarını aynı sanal ofiste izle.**

AI Office, bilgisayarındaki **OpenAI Codex** oturumlarını masaüstü tarayıcında sabit kameralı bir ofis olarak gösterir. Her ana oturumun ayrı odası vardır; bağlı ajanları kendi masalarında görünür.

[English](README.md) · [MIT lisansı](LICENSE) · [Katkı rehberi](CONTRIBUTING.md)

[![CI](https://github.com/chelebyy/ai-office/actions/workflows/ci.yml/badge.svg)](https://github.com/chelebyy/ai-office/actions/workflows/ci.yml)

![AI Office: sanal ofis, dört ekip üyesi, canlı etkinlik akışı ve proje odaları](docs/images/ai-office-preview.webp)

*Örnek oturumlarla masaüstü arayüzü. Görselde özel konuşma veya gerçek proje verisi bulunmaz.*

## Ne işe yarar?

Birden fazla projede Codex ile çalışırken sürekli konuşmalar arasında dolaşmadan hangi oturumun çalıştığını, hangisinin yanıtını beklediğini ve en son ne yaptığını görmeni sağlar.

- Projelerin altından oturumları seçebilir, odalar arasında geçebilir ve etkinliklerini izleyebilirsin.
- Ana karakter ve üç robot masası, bağlı oturumların çalışma/bekleme durumunu yansıtır. Daha büyük ekiplerin bilgileri oturum ve olay görünümünde kalır.
- Duvar ekranı ve büyütülebilir akış, gözlenen araç etkinliklerini ve görünür asistan mesajlarını gösterir.
- Küçük monitörlerdeki kod/terminal içerikleri etkinliğe bağlı dekoratif animasyonlardır; gerçek editör veya terminalin birebir görüntüsü değildir.
- Gündüz/gece, isteğe bağlı konum ve hava durumu, hareket ayarları ve Türkçe/İngilizce arayüz kullanılabilir.

Bu bir **izleme arayüzüdür**. Codex'e komut göndermez; soru ve yanıtlarını Codex'teki asıl konuşmada sürdürürsün. Güç menüsü Codex görevlerini değil, yerel gözlemciyi yönetir. Ofis etkinliğini oluşturmak için LLM çağrısı yapmaz ve Codex aboneliği sağlamaz.

## Uyumluluk

| Ortam | Durum |
| --- | --- |
| Windows | Masaüstü iş akışları doğrulandı; otomatik testler ve derleme CI üzerinde çalışır. |
| Linux / WSL 2 | Masaüstü iş akışları Ubuntu / WSL 2 üzerinde doğrulandı; otomatik testler ve derleme Linux CI üzerinde çalışır. |
| macOS | Uyumluluk henüz doğrulanmadı. |

Test edilen ortamlar ve entegrasyon kapsamı için [platform rehberine](docs/PLATFORMS.md) bak.

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

## Geliştirme

```sh
npm run dev
npm run check
```

Geliştirme sırasında otomatik yenileme kapalıdır: arayüz değişikliklerinde sayfayı yenile, gözlemci değişikliklerinde uygulamayı yeniden başlat. `npm run check` depo gizlilik kontrolü, tip kontrolü, davranış testleri ve üretim derlemesini çalıştırır.

`test/` klasörü; oturum ayrıştırma, dosya izleme, yerel sunucu güvenliği, başlatıcılar ve arayüz davranışı için otomatik regresyon testlerini içerir. Test yardımcıları ve örnek kayıtlar, kişisel Codex geçmişine ihtiyaç duymadan bu özellikleri sınar.

CI, Windows ve Linux üzerinde otomatik test ve derleme çalıştırır. Sürüm etiketleri aynı kontrollerden sonra GitHub kaynak sürümünü yayımlar; sunucuya dağıtım yapılmaz.

[Mimari](docs/ARCHITECTURE.md) · [Platformlar](docs/PLATFORMS.md) · [Gizlilik](docs/PRIVACY.md) · [Güvenlik](SECURITY.md)

## Lisans

[MIT](LICENSE): herkes kullanabilir, kopyalayabilir, değiştirebilir, dağıtabilir ve ticari/kapalı kaynak projelerine dahil edebilir. Telif ve lisans metni korunmalıdır. Garanti verilmez; üçüncü taraf bağımlılıklar kendi lisanslarına tabidir.

Yapılandırmada `AI_OFFICE_*` adları kullanılır. Eski `CHELEBY_*` değişkenleri, yeni karşılığı boş veya tanımsızsa uyumluluk için okunur.
