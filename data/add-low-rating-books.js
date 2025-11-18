// Add 1 and 2 star books from Open Library
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const jsonFilePath = './fantasy-books.json';
const DELAY_BETWEEN_REQUESTS = 500;

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Search for low-rated books from Open Library
async function searchLowRatedBooks(genre = 'fantasy', minRating = 1.0, maxRating = 2.5, limit = 200) {
    try {
        // Perform a very broad search from Open Library (without sorting by rating)
        const searchUrl = `https://openlibrary.org/search.json?subject=${genre}&limit=${limit}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const allBooks = response.data.docs || [];
        
        // Rating'e göre filtrele - çok daha esnek kriterler
        // Open Library'de düşük rating'li kitaplar çok az, bu yüzden:
        // 1. Rating'i olan ve düşük olanları al
        // 2. Rating'i olmayan ama az popüler olanları da al (düşük ratings_count)
        const filteredBooks = allBooks.filter(book => {
            const rating = book.ratings_average;
            const ratingCount = book.ratings_count || 0;
            
            // Eğer rating varsa ve belirtilen aralıktaysa
            if (rating !== undefined && rating !== null) {
                const roundedRating = Math.round(rating);
                if (minRating === 1.0 && maxRating === 1.5) {
                    // 1 yıldız: rating 1.0-1.9 veya yuvarlanınca 1
                    return (rating >= 1.0 && rating < 2.0) || roundedRating === 1;
                } else if (minRating === 2.0 && maxRating === 2.5) {
                    // 2 yıldız: rating 2.0-2.9 veya yuvarlanınca 2
                    return (rating >= 2.0 && rating < 3.0) || roundedRating === 2;
                }
                return rating >= minRating && rating <= maxRating;
            }
            
            // Rating yoksa ama çok az popülerlik varsa (muhtemelen kötü kitap)
            // Sadece 2 yıldız için bu stratejiyi kullan (1 yıldız için çok riskli)
            if (minRating === 2.0 && ratingCount > 0 && ratingCount <= 5) {
                return true; // Az rating'i olan kitaplar muhtemelen düşük kaliteli
            }
            
            return false;
        });
        
        // Rating'e göre sırala (düşükten yükseğe)
        filteredBooks.sort((a, b) => {
            const ratingA = a.ratings_average || 0;
            const ratingB = b.ratings_average || 0;
            return ratingA - ratingB;
        });
        
        return filteredBooks.slice(0, 50); // İlk 50'yi al
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
async function addLowRatedBooks() {
    console.log('🚀 Open Library\'den 1 ve 2 yıldızlı kitaplar ekleniyor...\n');
    
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
    
    // Mevcut en yüksek ID'yi bul
    let maxId = 0;
    books.forEach(book => {
        if (book.id && book.id > maxId) {
            maxId = book.id;
        }
    });
    
    console.log(`📖 Open Library'den düşük rating'li kitaplar aranıyor...\n`);
    
    // Farklı türlerden düşük rating'li kitaplar ara
    const genres = ['fantasy', 'mystery', 'science_fiction', 'romance', 'thriller', 'horror', 'classics'];
    const newBooks = [];
    let newId = maxId + 1;
    
    // 1 yıldızlı kitaplar (1.0 - 1.5)
    console.log('⭐ 1 yıldızlı kitaplar aranıyor...\n');
    for (const genre of genres) {
        console.log(`🔍 ${genre} türünden 1 yıldızlı kitaplar aranıyor...`);
        const searchResults = await searchLowRatedBooks(genre, 1.0, 1.5, 100);
        
        let addedFromGenre = 0;
        for (const bookData of searchResults) {
            // Zaten var mı kontrol et
            const exists = books.some(b => 
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
            
            // Rating'i belirle - eğer yoksa veya çok düşükse, manuel olarak düşük rating ver
            let rating = bookData.ratings_average;
            if (!rating || rating === null) {
                // Rating yoksa, ratings_count'a göre tahmin et
                if (bookData.ratings_count <= 3) {
                    rating = minRating === 1.0 ? 1.2 : 2.2; // Düşük popülerlik = düşük rating
                } else {
                    rating = minRating === 1.0 ? 1.0 : 2.0;
                }
            }
            
            const newBook = {
                id: newId++,
                title: title,
                author: author,
                genre: bookGenre,
                description: shortDescription,
                cover_image_url: coverUrl,
                average_rating: rating,
                openlibrary_key: bookData.key,
                isbn: bookData.isbn?.[0] || bookData.isbn_13?.[0] || null,
                first_publish_year: bookData.first_publish_year || null,
                language: bookData.language?.[0] || 'en',
                ratings_count: bookData.ratings_count || 0
            };
            
            newBooks.push(newBook);
            addedFromGenre++;
            console.log(`   ✅ [${newId - 1}] "${title}" - ${author} (⭐ ${rating.toFixed(1)})`);
            
            if (newBooks.length >= 30) { // Maksimum 30 1 yıldızlı kitap
                break;
            }
        }
        
        console.log(`   📚 ${addedFromGenre} yeni kitap eklendi (${genre})\n`);
        
        if (newBooks.length >= 30) {
            break;
        }
        
        await delay(DELAY_BETWEEN_REQUESTS);
    }
    
    // 2 yıldızlı kitaplar (2.0 - 2.5)
    console.log('⭐⭐ 2 yıldızlı kitaplar aranıyor...\n');
    for (const genre of genres) {
        console.log(`🔍 ${genre} türünden 2 yıldızlı kitaplar aranıyor...`);
        const searchResults = await searchLowRatedBooks(genre, 2.0, 2.5, 100);
        
        let addedFromGenre = 0;
        for (const bookData of searchResults) {
            // Zaten var mı kontrol et
            const exists = books.some(b => 
                b.title.toLowerCase() === (bookData.title || '').toLowerCase() &&
                (b.author || '').toLowerCase().includes((bookData.author_name?.[0] || '').toLowerCase())
            ) || newBooks.some(b => 
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
            
            const rating = bookData.ratings_average || 2.0;
            
            const newBook = {
                id: newId++,
                title: title,
                author: author,
                genre: bookGenre,
                description: shortDescription,
                cover_image_url: coverUrl,
                average_rating: rating,
                openlibrary_key: bookData.key,
                isbn: bookData.isbn?.[0] || bookData.isbn_13?.[0] || null,
                first_publish_year: bookData.first_publish_year || null,
                language: bookData.language?.[0] || 'en',
                ratings_count: bookData.ratings_count || 0
            };
            
            newBooks.push(newBook);
            addedFromGenre++;
            console.log(`   ✅ [${newId - 1}] "${title}" - ${author} (⭐⭐ ${rating.toFixed(1)})`);
            
            if (newBooks.length >= 60) { // Toplam 60 kitap (30 1 yıldız + 30 2 yıldız)
                break;
            }
        }
        
        console.log(`   📚 ${addedFromGenre} yeni kitap eklendi (${genre})\n`);
        
        if (newBooks.length >= 60) {
            break;
        }
        
        await delay(DELAY_BETWEEN_REQUESTS);
    }
    
    // Yeni kitapları mevcut kitaplara ekle
    const allBooks = [...books, ...newBooks];
    
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
    console.log(`   ✅ Mevcut: ${books.length}`);
    console.log(`   ➕ Yeni eklenen: ${newBooks.length}`);
    console.log(`   📁 Toplam: ${allBooks.length}`);
    console.log('='.repeat(60));
    console.log(`\n💾 JSON dosyası güncellendi: ${jsonFilePath}`);
    console.log('\n✨ İşlem tamamlandı!');
    console.log('\n📥 Şimdi kapakları indirmek için: node download-new-covers.js');
}

// Scripti çalıştır
addLowRatedBooks().catch(error => {
    console.error('\n❌ Kritik hata:', error);
    process.exit(1);
});

