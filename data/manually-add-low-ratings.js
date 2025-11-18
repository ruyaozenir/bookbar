// Manually assign low ratings to some existing books
const fs = require('fs');

const jsonFilePath = './fantasy-books.json';

console.log('🚀 Assigning low ratings to existing books...\n');

// Read JSON file
let jsonData;
try {
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    jsonData = JSON.parse(fileContent);
} catch (error) {
    console.error(`❌ Could not read JSON file: ${error.message}`);
    process.exit(1);
}

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

console.log(`📚 Toplam kitap: ${books.length}\n`);

// Rating'i olmayan veya yüksek rating'li kitaplardan bazılarını seç
// Rastgele seçim için ID'ye göre filtreleme yapalım
let updatedCount = 0;
let oneStarCount = 0;
let twoStarCount = 0;

// Önce tüm kitapları filtrele - sadece rating'i olmayan veya yüksek olanları seç
const eligibleBooks = books
    .map((book, index) => ({ book, index }))
    .filter(({ book }) => {
        const currentRating = book.average_rating;
        return !currentRating || currentRating >= 3.0;
    });

console.log(`📋 Uygun kitap sayısı: ${eligibleBooks.length}\n`);

// 1 yıldızlı kitaplar - 15 kitap (rastgele seç)
const oneStarIndices = new Set();
while (oneStarIndices.size < 15 && oneStarIndices.size < eligibleBooks.length) {
    const randomIndex = Math.floor(Math.random() * eligibleBooks.length);
    oneStarIndices.add(randomIndex);
}

// 2 yıldızlı kitaplar - 15 kitap (1 yıldızlılardan farklı)
const twoStarIndices = new Set();
while (twoStarIndices.size < 15 && (twoStarIndices.size + oneStarIndices.size) < eligibleBooks.length) {
    const randomIndex = Math.floor(Math.random() * eligibleBooks.length);
    if (!oneStarIndices.has(randomIndex)) {
        twoStarIndices.add(randomIndex);
    }
}

// 1 yıldızlı kitapları güncelle
oneStarIndices.forEach(idx => {
    const { book } = eligibleBooks[idx];
    book.average_rating = 1.0 + Math.random() * 0.5; // 1.0 - 1.5 arası
    oneStarCount++;
    updatedCount++;
    console.log(`   ⭐ [${book.id}] "${book.title}" - Rating: ${book.average_rating.toFixed(1)}`);
});

// 2 yıldızlı kitapları güncelle
twoStarIndices.forEach(idx => {
    const { book } = eligibleBooks[idx];
    book.average_rating = 2.0 + Math.random() * 0.5; // 2.0 - 2.5 arası
    twoStarCount++;
    updatedCount++;
    console.log(`   ⭐⭐ [${book.id}] "${book.title}" - Rating: ${book.average_rating.toFixed(1)}`);
});

// JSON'u güncelle
if (Array.isArray(jsonData)) {
    jsonData = books;
} else {
    jsonData.fantasy = books;
}

fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');

console.log('\n' + '='.repeat(60));
console.log('📊 İşlem Özeti:');
console.log(`   ⭐ 1 yıldızlı: ${oneStarCount} kitap`);
console.log(`   ⭐⭐ 2 yıldızlı: ${twoStarCount} kitap`);
console.log(`   ✅ Toplam güncellenen: ${updatedCount} kitap`);
console.log('='.repeat(60));
console.log(`\n💾 JSON dosyası güncellendi: ${jsonFilePath}`);
console.log('\n✨ İşlem tamamlandı!');

