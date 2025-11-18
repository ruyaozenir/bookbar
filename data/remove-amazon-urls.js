// Script to remove all Amazon URLs
const fs = require('fs');
const path = require('path');

const jsonFilePath = './fantasy-books.json';

console.log('🔧 Removing Amazon URLs...');

try {
    // Read JSON file
    let fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    let jsonData = JSON.parse(fileContent);
    
    // Get books array
    let books = [];
    if (Array.isArray(jsonData)) {
        books = jsonData;
    } else if (jsonData.fantasy && Array.isArray(jsonData.fantasy)) {
        books = jsonData.fantasy;
    } else {
        console.error('❌ JSON dosyasında kitap array\'i bulunamadı!');
        process.exit(1);
    }
    
    let removedCount = 0;
    let localFoundCount = 0;
    
    // Her kitap için kontrol et
    books.forEach((book, index) => {
        const bookId = book.id || (index + 1);
        
        if (book.cover_image_url) {
            // Amazon URL'lerini kontrol et
            if (book.cover_image_url.includes('amazon.com') || 
                book.cover_image_url.includes('amazon')) {
                
                // Yerel kapak dosyası var mı kontrol et
                const localCoverPath = path.join(__dirname, 'covers', `cover_${bookId}.jpg`);
                
                if (fs.existsSync(localCoverPath)) {
                    // Yerel kapak varsa, path'i güncelle
                    book.cover_image_url = `data/covers/cover_${bookId}.jpg`;
                    localFoundCount++;
                } else {
                    // Yerel kapak yoksa, boş string kullan
                    book.cover_image_url = '';
                    removedCount++;
                }
            }
        }
    });
    
    // Güncellenmiş JSON'u kaydet
    if (Array.isArray(jsonData)) {
        jsonData = books;
    } else {
        jsonData.fantasy = books;
    }
    
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    console.log(`\n✅ ${localFoundCount} kitap için yerel kapak path'i güncellendi`);
    console.log(`⚠️  ${removedCount} Amazon URL'si kaldırıldı (placeholder kullanılacak)`);
    console.log(`💾 JSON dosyası güncellendi: ${jsonFilePath}`);
    
} catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
}

