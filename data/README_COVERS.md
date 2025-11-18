# Kitap Kapakları İndirme ve Güncelleme Scripti

Bu script, Open Library API'den kitap kapaklarını toplu olarak indirir ve JSON dosyasındaki URL'leri yerel yollarla günceller.

## Özellikler

- ✅ Open Library API'den otomatik kitap araması
- ✅ En yüksek çözünürlüklü kapak indirme (Large size)
- ✅ JSON dosyasındaki URL'leri yerel yollarla güncelleme
- ✅ Otomatik yedekleme (JSON dosyası yedeklenir)
- ✅ Rate limiting (API'ye nazik davranır)
- ✅ Mevcut kapakları atlama (yeniden indirme yapmaz)
- ✅ Detaylı loglama ve hata yönetimi
- ✅ Başarısız indirmelerde remote URL kullanma (fallback)

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Script'i çalıştırın:
```bash
# npm script ile
npm run download:covers

# veya direkt olarak
node data/downloadCovers.js
```

## Kullanım

Script `data/` klasöründe çalıştırılmalıdır. Script şunları yapacak:

1. **Yedekleme**: `fantasy-books.json` dosyası `fantasy-books.json.backup` olarak yedeklenir
2. **Kapak İndirme**: Her kitap için Open Library API'den kapak aranır ve indirilir
3. **JSON Güncelleme**: Başarılı indirmelerde JSON'daki `cover_image_url` alanı yerel yol ile güncellenir
4. **Metadata Ekleme**: Her kitap için Open Library URL'i ve indirme tarihi metadata olarak eklenir

## Çıktı

- **Kapaklar**: `data/covers/` klasöründe `cover_1.jpg`, `cover_2.jpg`, ... formatında saklanır
- **Güncellenmiş JSON**: `data/fantasy-books.json` dosyası güncellenir
- **Yedek**: `data/fantasy-books.json.backup` dosyası oluşturulur

## Örnek Çıktı

```
🚀 Kitap kapaklarını indirme ve JSON güncelleme işlemi başlatılıyor...

✅ JSON dosyası yedeklendi: ./fantasy-books.json.backup
📚 Toplam 179 kitap bulundu.

[1/179] "Alchemy of Secrets" - Stephanie Garber
   ✅ Kapak indirildi: https://covers.openlibrary.org/b/id/12345678-L.jpg
[2/179] "Bonds of Hercules" - Jasmine Mas
   ✅ Kapak indirildi: https://covers.openlibrary.org/b/id/87654321-L.jpg
...

📊 İşlem Özeti:
   ✅ Başarılı: 150
   ⚠️  Atlanan: 20
   ❌ Başarısız: 9
   📁 Toplam: 179
```

## Ayarlar

Script içindeki ayarlar:

- `DELAY_BETWEEN_REQUESTS`: API istekleri arasındaki gecikme (ms) - varsayılan: 500ms
- `jsonFilePath`: JSON dosyası yolu - varsayılan: `./fantasy-books.json`
- `coversDir`: Kapaklar klasörü - varsayılan: `./covers`

## Notlar

- Script, mevcut kapakları atlar (yeniden indirme yapmaz)
- Başarısız indirmelerde remote URL kullanılır (fallback)
- Open Library API'den kapak bulunamazsa, kitap atlanır
- Rate limiting sayesinde API'ye nazik davranılır
- Her kitap için en iyi eşleşme bulunmaya çalışılır (title ve author bazlı)

## Sorun Giderme

### Kapak bulunamıyor
- Open Library'de kitap olmayabilir
- Kitap adı veya yazar adı farklı yazılmış olabilir
- Script loglarını kontrol edin

### İndirme başarısız
- İnternet bağlantınızı kontrol edin
- Open Library API erişilebilir mi kontrol edin
- Timeout süresini artırabilirsiniz (script içinde)

### JSON güncellenmiyor
- Dosya izinlerini kontrol edin
- Yedek dosyayı kontrol edin
- Script loglarını inceleyin

## Yedekten Geri Yükleme

Eğer bir sorun olursa, yedek dosyadan geri yükleyebilirsiniz:

```bash
cp data/fantasy-books.json.backup data/fantasy-books.json
```

