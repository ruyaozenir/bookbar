// Script to fix missing covers - Remove Amazon URLs and add placeholder
const fs = require('fs');
const path = require('path');

const jsonFilePath = './fantasy-books.json';

console.log('🔧 Fixing missing covers...');

try {
    // Read JSON file
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
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
    
    let fixedCount = 0;
    let placeholderCount = 0;
    
    // Her kitap için kontrol et
    books.forEach((book, index) => {
        const bookId = book.id || (index + 1);
        
        // Amazon URL'lerini kontrol et ve değiştir
        if (book.cover_image_url && 
            (book.cover_image_url.includes('m.media-amazon.com') || 
             book.cover_image_url.includes('images-na.ssl-images-amazon.com'))) {
            
            // Yerel kapak dosyası var mı kontrol et
            const localCoverPath = path.join(__dirname, 'covers', `cover_${bookId}.jpg`);
            
            if (fs.existsSync(localCoverPath)) {
                // Yerel kapak varsa, path'i güncelle
                book.cover_image_url = `data/covers/cover_${bookId}.jpg`;
                fixedCount++;
                console.log(`✅ [${bookId}] "${book.title}" - Yerel kapak bulundu`);
            } else {
                // Yerel kapak yoksa, boş string kullan (placeholder gösterilecek)
                book.cover_image_url = '';
                placeholderCount++;
                console.log(`⚠️  [${bookId}] "${book.title}" - Placeholder kullanılacak`);
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
    
    console.log(`\n✅ ${fixedCount} kitabın kapak path'i düzeltildi`);
    console.log(`⚠️  ${placeholderCount} kitap için placeholder kullanılacak`);
    console.log(`💾 JSON dosyası güncellendi: ${jsonFilePath}`);
    
} catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
}

