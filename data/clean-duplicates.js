// Clean duplicate books
const fs = require('fs');

const jsonFilePath = './fantasy-books.json';

console.log('🔧 Cleaning duplicate books...\n');

try {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    let jsonData = JSON.parse(fileContent);
    
    let books = [];
    if (Array.isArray(jsonData)) {
        books = jsonData;
    } else if (jsonData.fantasy && Array.isArray(jsonData.fantasy)) {
        books = jsonData.fantasy;
    }
    
    console.log(`📚 Total books: ${books.length}`);
    
    // Find duplicate books (by title and author)
    const seen = new Map();
    const uniqueBooks = [];
    let duplicateCount = 0;
    
    books.forEach(book => {
        const key = `${book.title.toLowerCase()}_${(book.author || '').toLowerCase()}`;
        
        if (!seen.has(key)) {
            seen.set(key, true);
            uniqueBooks.push(book);
        } else {
            duplicateCount++;
            console.log(`   🗑️  Tekrar: "${book.title}" - ${book.author}`);
        }
    });
    
    // ID'leri yeniden düzenle
    uniqueBooks.forEach((book, index) => {
        book.id = index + 1;
    });
    
    // JSON'u güncelle
    if (Array.isArray(jsonData)) {
        jsonData = uniqueBooks;
    } else {
        jsonData.fantasy = uniqueBooks;
    }
    
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    console.log(`\n✅ ${duplicateCount} tekrar kaldırıldı`);
    console.log(`📁 Toplam: ${uniqueBooks.length} kitap`);
    console.log(`💾 JSON dosyası güncellendi\n`);
    
} catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
}

