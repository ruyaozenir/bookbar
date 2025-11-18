// Script to fix paths in JSON file
const fs = require('fs');
const path = require('path');

const jsonFilePath = './fantasy-books.json';

console.log('🔧 Fixing path formats...');

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
    
    // Her kitap için path'i düzelt
    books.forEach((book, index) => {
        if (book.cover_image_url) {
            // ./covers/ veya ./covers/ ile başlayan path'leri düzelt
            if (book.cover_image_url.startsWith('./covers/')) {
                book.cover_image_url = book.cover_image_url.replace('./covers/', 'data/covers/');
                fixedCount++;
            }
            // covers/ ile başlayan (./ olmadan) path'leri de düzelt
            else if (book.cover_image_url.startsWith('covers/') && !book.cover_image_url.startsWith('data/')) {
                book.cover_image_url = 'data/' + book.cover_image_url;
                fixedCount++;
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
    
    console.log(`✅ ${fixedCount} kitabın path'i düzeltildi`);
    console.log(`📁 Path formatı: data/covers/cover_X.jpg`);
    console.log(`💾 JSON dosyası güncellendi: ${jsonFilePath}`);
    
} catch (error) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
}

