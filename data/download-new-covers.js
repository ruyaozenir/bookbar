// Download covers for newly added books
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const jsonFilePath = './fantasy-books.json';
const coversDir = './covers';
const DELAY_BETWEEN_REQUESTS = 500;

// Create covers directory
if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadCover(coverUrl, localPath) {
    try {
        const response = await axios.get(coverUrl, {
            responseType: 'stream',
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        throw new Error(`İndirme hatası: ${error.message}`);
    }
}

async function downloadNewCovers() {
    console.log('🚀 Yeni kitapların kapaklarını indiriyor...\n');
    
    // JSON dosyasını oku
    let jsonData;
    try {
        const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
        jsonData = JSON.parse(fileContent);
    } catch (error) {
        console.error(`❌ Could not read JSON file: ${error.message}`);
        return;
    }
    
    // Get books array
    let books = [];
    if (Array.isArray(jsonData)) {
        books = jsonData;
    } else if (jsonData.fantasy && Array.isArray(jsonData.fantasy)) {
        books = jsonData.fantasy;
    }
    
    console.log(`📚 Toplam ${books.length} kitap bulundu.\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    // Her kitap için kontrol et
    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const bookId = book.id || (i + 1);
        const title = book.title;
        
        // Sadece Open Library URL'leri olan kitapları işle
        if (!book.cover_image_url || 
            !book.cover_image_url.includes('covers.openlibrary.org') ||
            book.cover_image_url.includes('data/covers/')) {
            continue;
        }
        
        console.log(`[${i + 1}/${books.length}] "${title}"`);
        
        try {
            const localFileName = `cover_${bookId}.jpg`;
            const localPath = path.join(coversDir, localFileName);
            
            // Eğer kapak zaten varsa, atla
            if (fs.existsSync(localPath)) {
                console.log(`   ⏭️  Kapak zaten mevcut, atlanıyor.`);
                // Yine de JSON'daki URL'i güncelle
                books[i].cover_image_url = `data/covers/${localFileName}`;
                skipCount++;
                await delay(100);
                continue;
            }
            
            // Kapak görselini indir
            try {
                await downloadCover(book.cover_image_url, localPath);
                console.log(`   ✅ Kapak indirildi`);
                
                // JSON'daki URL'i yerel yol ile güncelle
                books[i].cover_image_url = `data/covers/${localFileName}`;
                
                // Metadata ekle
                if (!books[i].cover_metadata) {
                    books[i].cover_metadata = {};
                }
                books[i].cover_metadata.openlibrary_url = book.cover_image_url;
                books[i].cover_metadata.downloaded_at = new Date().toISOString();
                
                successCount++;
            } catch (downloadError) {
                console.log(`   ⚠️  İndirme başarısız: ${downloadError.message}`);
                failCount++;
            }
            
        } catch (error) {
            console.error(`   ❌ Hata: ${error.message}`);
            failCount++;
        }
        
        // Rate limiting
        await delay(DELAY_BETWEEN_REQUESTS);
    }
    
    // Güncellenmiş JSON'u kaydet
    try {
        if (Array.isArray(jsonData)) {
            jsonData = books;
        } else {
            jsonData.fantasy = books;
        }
        
        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
        console.log(`\n✅ JSON dosyası güncellendi: ${jsonFilePath}`);
    } catch (error) {
        console.error(`\n❌ JSON dosyası kaydedilemedi: ${error.message}`);
    }
    
    // Özet
    console.log('\n' + '='.repeat(60));
    console.log('📊 İşlem Özeti:');
    console.log(`   ✅ Başarılı: ${successCount}`);
    console.log(`   ⏭️  Atlanan: ${skipCount}`);
    console.log(`   ❌ Başarısız: ${failCount}`);
    console.log('='.repeat(60));
    console.log('\n✨ İşlem tamamlandı!');
}

downloadNewCovers().catch(error => {
    console.error('\n❌ Kritik hata:', error);
    process.exit(1);
});

