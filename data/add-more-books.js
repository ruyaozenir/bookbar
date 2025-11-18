// Delete books without covers and add new books from Open Library
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const jsonFilePath = './fantasy-books.json';
const DELAY_BETWEEN_REQUESTS = 500;

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Search for popular books from Open Library
async function searchPopularBooks(genre = 'fantasy', limit = 50) {
    try {
        // Search for popular books from Open Library
        const searchUrl = `https://openlibrary.org/search.json?subject=${genre}&sort=rating&limit=${limit}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        return response.data.docs || [];
    } catch (error) {
        console.error(`   ⚠️  API Hatası: ${error.message}`);
        return [];
    }
}

// Open Library'den kitap detaylarını al
async function getBookDetails(workKey) {
    try {
        const detailUrl = `https://openlibrary.org${workKey}.json`;
        const response = await axios.get(detailUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        return response.data;
    } catch (error) {
        return null;
    }
}

// Kapak URL'i al
function getCoverUrl(bookData) {
    if (bookData.cover_i) {
        return `https://covers.openlibrary.org/b/id/${bookData.cover_i}-L.jpg`;
    }
    if (bookData.isbn && bookData.isbn.length > 0) {
        return `https://covers.openlibrary.org/b/isbn/${bookData.isbn[0]}-L.jpg`;
    }
    if (bookData.isbn_13 && bookData.isbn_13.length > 0) {
        return `https://covers.openlibrary.org/b/isbn/${bookData.isbn_13[0]}-L.jpg`;
    }
    return null;
}

// Ana fonksiyon
async function addMoreBooks() {
    console.log('🚀 Kapağı olmayan kitapları silip yeni kitaplar ekleniyor...\n');
    
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
    
    console.log(`📚 Mevcut kitap sayısı: ${books.length}`);
    
    // Kapağı olmayan kitapları filtrele
    const booksWithCovers = books.filter(book => {
        return book.cover_image_url && 
               book.cover_image_url.trim() !== '' && 
               !book.cover_image_url.includes('amazon.com');
    });
    
    const removedCount = books.length - booksWithCovers.length;
    console.log(`🗑️  ${removedCount} kitap kaldırıldı (kapak yok)`);
    console.log(`✅ ${booksWithCovers.length} kitap kaldı (kapak var)\n`);
    
    // Mevcut en yüksek ID'yi bul
    let maxId = 0;
    booksWithCovers.forEach(book => {
        if (book.id && book.id > maxId) {
            maxId = book.id;
        }
    });
    
    console.log(`📖 Open Library'den yeni kitaplar aranıyor...\n`);
    
    // Farklı türlerden popüler kitaplar ara
    const genres = ['fantasy', 'mystery', 'science_fiction', 'romance', 'thriller', 'horror', 'classics'];
    const newBooks = [];
    let newId = maxId + 1;
    
    for (const genre of genres) {
        console.log(`🔍 ${genre} türünden kitaplar aranıyor...`);
        const searchResults = await searchPopularBooks(genre, 30);
        
        let addedFromGenre = 0;
        for (const bookData of searchResults) {
            // Zaten var mı kontrol et
            const exists = booksWithCovers.some(b => 
                b.title.toLowerCase() === (bookData.title || '').toLowerCase() &&
                (b.author || '').toLowerCase().includes((bookData.author_name?.[0] || '').toLowerCase())
            );
            
            if (exists) {
                continue;
            }
            
            // Kapak var mı kontrol et
            const coverUrl = getCoverUrl(bookData);
            if (!coverUrl) {
                continue;
            }
            
            // Kitap detaylarını al
            let bookDetails = null;
            if (bookData.key) {
                bookDetails = await getBookDetails(bookData.key);
                await delay(200); // Rate limiting
            }
            
            // Yeni kitap oluştur
            const author = bookData.author_name?.[0] || bookData.author_name || 'Unknown';
            const title = bookData.title || 'Untitled';
            
            // Description'ı düzgün şekilde al
            let description = '';
            if (bookDetails?.description) {
                if (typeof bookDetails.description === 'string') {
                    description = bookDetails.description;
                } else if (typeof bookDetails.description === 'object' && bookDetails.description.value) {
                    description = bookDetails.description.value;
                }
            }
            if (!description && bookData.first_sentence && bookData.first_sentence.length > 0) {
                description = bookData.first_sentence[0];
            }
            if (!description) {
                description = `A ${genre.replace('_', ' ')} book by ${author}.`;
            }
            
            // Description'ı kısalt
            const shortDescription = typeof description === 'string' ? 
                description.substring(0, 200).trim() : 
                description;
            
            // Genre'u düzelt
            let bookGenre = genre.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
            if (bookData.subject && bookData.subject.length > 0) {
                bookGenre = bookData.subject[0].replace(/\b\w/g, l => l.toUpperCase());
            }
            
            const newBook = {
                id: newId++,
                title: title,
                author: author,
                genre: bookGenre,
                description: shortDescription,
                cover_image_url: coverUrl,
                average_rating: bookData.ratings_average || (bookData.ratings_count > 0 ? 4.0 : null),
                openlibrary_key: bookData.key,
                isbn: bookData.isbn?.[0] || bookData.isbn_13?.[0] || null,
                first_publish_year: bookData.first_publish_year || null,
                language: bookData.language?.[0] || 'en',
                ratings_count: bookData.ratings_count || 0
            };
            
            newBooks.push(newBook);
            addedFromGenre++;
            console.log(`   ✅ [${newId - 1}] "${title}" - ${author}`);
            
            if (newBooks.length >= 100) { // Maksimum 100 yeni kitap
                break;
            }
        }
        
        console.log(`   📚 ${addedFromGenre} yeni kitap eklendi (${genre})\n`);
        
        if (newBooks.length >= 100) {
            break;
        }
        
        await delay(DELAY_BETWEEN_REQUESTS);
    }
    
    // Yeni kitapları mevcut kitaplara ekle
    const allBooks = [...booksWithCovers, ...newBooks];
    
    // ID'lere göre sırala
    allBooks.sort((a, b) => (a.id || 0) - (b.id || 0));
    
    // JSON'u güncelle
    if (Array.isArray(jsonData)) {
        jsonData = allBooks;
    } else {
        jsonData.fantasy = allBooks;
    }
    
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 İşlem Özeti:');
    console.log(`   🗑️  Kaldırılan: ${removedCount}`);
    console.log(`   ✅ Kalan: ${booksWithCovers.length}`);
    console.log(`   ➕ Yeni eklenen: ${newBooks.length}`);
    console.log(`   📁 Toplam: ${allBooks.length}`);
    console.log('='.repeat(60));
    console.log(`\n💾 JSON dosyası güncellendi: ${jsonFilePath}`);
    console.log('\n✨ İşlem tamamlandı!');
}

// Scripti çalıştır
addMoreBooks().catch(error => {
    console.error('\n❌ Kritik hata:', error);
    process.exit(1);
});

