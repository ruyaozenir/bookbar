// File Name: downloadCovers.js
// Bulk fetch book covers from Open Library API and fix URLs in JSON file with local paths
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// File paths
const jsonFilePath = './fantasy-books.json';
const coversDir = './covers';
const backupFilePath = './fantasy-books.json.backup';

// Delay for rate limiting (milliseconds)
const DELAY_BETWEEN_REQUESTS = 500;

// 1. Create covers directory
if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
}

// 2. Backup JSON file
function backupJsonFile() {
    if (fs.existsSync(jsonFilePath)) {
        fs.copyFileSync(jsonFilePath, backupFilePath);
        console.log(`✅ JSON file backed up: ${backupFilePath}`);
    }
}

// 3. Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 4. Search books from Open Library API and get cover URL
async function getCoverUrlFromOpenLibrary(title, author) {
    try {
        const query = encodeURIComponent(`${title} ${author}`);
        const searchUrl = `https://openlibrary.org/search.json?q=${query}&limit=5`;
        
        const response = await axios.get(searchUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const docs = response.data.docs;
        
        if (!docs || docs.length === 0) {
            return null;
        }
        
        // En iyi eşleşmeyi bul (title ve author'ın tam eşleşmesi)
        let bestMatch = null;
        let bestScore = 0;
        
        for (const doc of docs) {
            let score = 0;
            const docTitle = (doc.title || '').toLowerCase();
            const docAuthor = (doc.author_name || []).join(' ').toLowerCase();
            const searchTitle = title.toLowerCase();
            const searchAuthor = author.toLowerCase();
            
            // Title eşleşmesi kontrolü
            if (docTitle.includes(searchTitle) || searchTitle.includes(docTitle)) {
                score += 10;
            }
            
            // Author eşleşmesi kontrolü
            if (docAuthor.includes(searchAuthor) || searchAuthor.includes(docAuthor)) {
                score += 5;
            }
            
            // Cover ID varsa bonus
            if (doc.cover_i) {
                score += 2;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestMatch = doc;
            }
        }
        
        if (bestMatch && bestMatch.cover_i) {
            // En yüksek çözünürlüklü kapak URL'i (L = Large, en büyük boyut)
            const coverId = bestMatch.cover_i;
            return {
                coverId: coverId,
                coverUrl: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
                // Alternatif olarak ISBN ile de deneyebiliriz
                isbn: bestMatch.isbn?.[0] || bestMatch.isbn_13?.[0] || bestMatch.isbn_10?.[0]
            };
        }
        
        // Cover ID yoksa ISBN ile deneyelim
        if (bestMatch) {
            const isbn = bestMatch.isbn?.[0] || bestMatch.isbn_13?.[0] || bestMatch.isbn_10?.[0];
            if (isbn) {
                return {
                    coverId: null,
                    coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
                    isbn: isbn
                };
            }
        }
        
        return null;
    } catch (error) {
        console.error(`   ⚠️  API Hatası: ${error.message}`);
        return null;
    }
}

// 5. Kapak görselini indirme
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

// 6. Ana fonksiyon
async function downloadCoversAndUpdateJson() {
    console.log('🚀 Kitap kapaklarını indirme ve JSON güncelleme işlemi başlatılıyor...\n');
    
    // JSON dosyasını yedekle
    backupJsonFile();
    
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
    } else {
        console.error('❌ JSON dosyasında kitap array\'i bulunamadı!');
        return;
    }
    
    console.log(`📚 Toplam ${books.length} kitap bulundu.\n`);
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    // Her kitap için işlem yap
    for (let i = 0; i < books.length; i++) {
        const book = books[i];
        const bookId = book.id || (i + 1);
        const title = book.title;
        const author = book.author;
        
        console.log(`[${i + 1}/${books.length}] "${title}" - ${author}`);
        
        try {
            // Open Library API'den kapak URL'i al
            const coverInfo = await getCoverUrlFromOpenLibrary(title, author);
            
            if (!coverInfo || !coverInfo.coverUrl) {
                console.log(`   ⚠️  Kapak bulunamadı.`);
                failCount++;
                await delay(DELAY_BETWEEN_REQUESTS);
                continue;
            }
            
            // Yerel dosya yolu
            const localFileName = `cover_${bookId}.jpg`;
            const localPath = path.join(coversDir, localFileName);
            
            // Eğer kapak zaten varsa, atla
            if (fs.existsSync(localPath)) {
                console.log(`   ⏭️  Kapak zaten mevcut, atlanıyor.`);
                // Yine de JSON'daki URL'i güncelle
                const relativePath = `./covers/${localFileName}`;
                books[i].cover_image_url = relativePath;
                skipCount++;
                await delay(100); // Kısa bir delay
                continue;
            }
            
            // Kapak görselini indir
            try {
                await downloadCover(coverInfo.coverUrl, localPath);
                console.log(`   ✅ Kapak indirildi: ${coverInfo.coverUrl}`);
            } catch (downloadError) {
                // İndirme başarısız olursa, remote URL'i kullan (fallback)
                console.log(`   ⚠️  İndirme başarısız, remote URL kullanılıyor: ${downloadError.message}`);
                books[i].cover_image_url = coverInfo.coverUrl;
                // Metadata ekle
                if (!books[i].cover_metadata) {
                    books[i].cover_metadata = {};
                }
                books[i].cover_metadata.openlibrary_url = coverInfo.coverUrl;
                books[i].cover_metadata.download_failed = true;
                skipCount++;
                await delay(DELAY_BETWEEN_REQUESTS);
                continue;
            }
            
            // JSON'daki URL'i yerel yol ile güncelle
            // Web'de kullanmak için relative path
            const relativePath = `./covers/${localFileName}`;
            books[i].cover_image_url = relativePath;
            
            // Open Library URL'ini de metadata olarak ekleyebiliriz (opsiyonel)
            if (!books[i].cover_metadata) {
                books[i].cover_metadata = {};
            }
            books[i].cover_metadata.openlibrary_url = coverInfo.coverUrl;
            books[i].cover_metadata.downloaded_at = new Date().toISOString();
            
            successCount++;
            
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
    console.log(`   ⚠️  Atlanan: ${skipCount}`);
    console.log(`   ❌ Başarısız: ${failCount}`);
    console.log(`   📁 Toplam: ${books.length}`);
    console.log('='.repeat(60));
    console.log(`\n💾 Yedek dosya: ${backupFilePath}`);
    console.log(`📁 Kapaklar: ${coversDir}/`);
    console.log('\n✨ İşlem tamamlandı!');
}

// Scripti çalıştır
downloadCoversAndUpdateJson().catch(error => {
    console.error('\n❌ Kritik hata:', error);
    process.exit(1);
});
