/**
 * BookManager - Class responsible for book CRUD management
 * Provides import from kindle.json, manual addition, and deletion functionality
 */
function normalizeGenre(rawGenre, fallback = '') {
    if (!rawGenre) return fallback;
    const parts = rawGenre.split('/');
    return (parts[0] || fallback).trim();
}

class BookManager {
    constructor() {
        this.library = {
            books: [],
            metadata: {
                lastImportDate: null,
                totalBooks: 0,
                manuallyAdded: 0,
                importedFromKindle: 0
            }
        };
    }

    /**
     * ライブラリデータを初期化・読み込み
     */
    async initialize() {
        // まずLocalStorageから確認
        const savedLibrary = localStorage.getItem('virtualBookshelf_library');
        if (savedLibrary) {
            try {
                const parsed = JSON.parse(savedLibrary);
                if (parsed && Array.isArray(parsed.books) && parsed.books.length > 0) {
                    const isCurated = parsed.books.every(book => book.source === 'curated_json');
                    if (isCurated) {
                        this.library = parsed;
                        return;
                    }
                    // Eski veriyi temizle (örneğin Japonca kitaplar)
                    console.log('Old cached library detected. Replacing with curated dataset.');
                }
            } catch (error) {
                // LocalStorage loading error (fallback to file)
            }
            // Eski verileri temizle
            localStorage.removeItem('virtualBookshelf_library');
        }
        
        let libraryLoaded = false;

        // LocalStorageにない場合はlibrary.jsonを確認
        try {
            const response = await fetch('data/library.json');
            if (response.ok) {
                const libraryData = await response.json();
                if (libraryData && libraryData.books) {
                    // 新しいデータ構造から古い形式に変換
                    this.library = {
                        books: Object.entries(libraryData.books).map(([asin, book]) => ({
                            title: book.title,
                            authors: book.authors,
                            acquiredTime: book.acquiredTime,
                            readStatus: book.readStatus,
                            asin: asin,
                            productImage: book.productImage,
                            source: book.source,
                            addedDate: book.addedDate,
                            // 追加フィールドも含める
                            ...(book.memo && { memo: book.memo }),
                            ...(book.rating && { rating: book.rating }),
                            ...(book.updatedAsin && { updatedAsin: book.updatedAsin })
                        })),
                        metadata: {
                            totalBooks: libraryData.stats?.totalBooks || 0,
                            manuallyAdded: 0,
                            importedFromKindle: libraryData.stats?.totalBooks || 0,
                            lastImportDate: libraryData.exportDate || null
                        }
                    };
                    libraryLoaded = this.library.books.length > 0;
                    if (libraryLoaded) {
                        return;
                    }
                }
            }
        } catch (error) {
            // library.json loading error – fallback handled below
        }
        
        // 最後に curated JSON (fantasy-books.json) から読み込み
        if (!libraryLoaded) {
            await this.loadCuratedBooks();
        }
    }

    /**
     * fantasy-books.json からサンプル書籍データを読み込み
     */
    async loadCuratedBooks() {
        const candidatePaths = ['data/fantasy-books.json', 'fantasy-books.json'];
        let curatedData = null;

        for (const path of candidatePaths) {
            try {
                const response = await fetch(path);
                if (response.ok) {
                    curatedData = await response.json();
                    break;
                }
            } catch (error) {
                // 試行を継続
            }
        }

        if (!curatedData) {
            console.error('Failed to load curated books from fantasy-books.json');
            this.library = {
                books: [],
                metadata: {
                    totalBooks: 0,
                    manuallyAdded: 0,
                    importedFromKindle: 0,
                    lastImportDate: null
                }
            };
            return;
        }

        const books = this.transformCuratedData(curatedData);
        const now = Date.now();

        this.library = {
            books,
            metadata: {
                totalBooks: books.length,
                manuallyAdded: 0,
                importedFromKindle: 0,
                lastImportDate: now
            }
        };

        await this.saveLibrary();
        console.log(`Loaded ${books.length} curated books from fantasy-books.json`);
    }

    transformCuratedData(curatedData) {
        const now = Date.now();
        const books = [];

        const pushBook = (item, categoryHint = '') => {
            if (!item || typeof item !== 'object') {
                return;
            }

            const asin = item.id ? `curated-${item.id}` : `curated-${books.length + 1}`;
            const coverUrl = item.cover_image_url || item.coverImage || item.productImage || '';
            const category = this.deriveCategoryFromGenre(item.genre || categoryHint);
            const normalizedGenre = normalizeGenre(item.genre, category);
            const averageRating = typeof item.average_rating === 'number' ? item.average_rating : null;
            const rating = averageRating ? Math.round(averageRating) : 0;

            books.push({
                asin,
                title: item.title || 'Untitled',
                authors: item.author || item.authors || 'Unknown',
                author: item.author || item.authors || 'Unknown',
                description: item.description || '',
                genre: normalizedGenre,
                categories: category,
                category,
                productImage: coverUrl,
                cover_image: coverUrl,
                coverImage: coverUrl,
                source: 'curated_json',
                average_rating: averageRating,
                rating,
                readStatus: 'UNKNOWN',
                acquiredTime: now,
                addedDate: now
            });
        };

        if (Array.isArray(curatedData)) {
            curatedData.forEach(item => pushBook(item));
        } else {
            Object.entries(curatedData).forEach(([categoryKey, entries]) => {
                if (Array.isArray(entries)) {
                    entries.forEach(item => pushBook(item, categoryKey));
                }
            });
        }

        return books;
    }

    deriveCategoryFromGenre(rawGenre = '') {
        const genre = (rawGenre || '').toLowerCase();

        if (genre.includes('fantasy')) return 'fantasy';
        if (genre.includes('science')) return 'science_fiction';
        if (genre.includes('horror')) return 'horror';
        if (genre.includes('mystery') || genre.includes('thriller') || genre.includes('crime')) return 'mystery_thriller';
        if (genre.includes('classic')) return 'classics';
        if (genre.includes('romance')) return 'romance';
        if (genre.includes('dystopian')) return 'dystopian';

        return normalizeGenre(rawGenre || 'General')
            .toLowerCase()
            .replace(/\s+/g, '_');
    }

    /**
     * kindle.jsonから初回データを移行
     */
    async initializeFromKindleData() {
        try {
            const response = await fetch('data/kindle.json');
            const kindleBooks = await response.json();
            
            this.library.books = kindleBooks.map(book => ({
                ...book,
                source: 'kindle_import',
                addedDate: Date.now()
            }));
            
            this.library.metadata = {
                lastImportDate: Date.now(),
                totalBooks: kindleBooks.length,
                manuallyAdded: 0,
                importedFromKindle: kindleBooks.length
            };
            
            await this.saveLibrary();
            // Kindle import completed
        } catch (error) {
            // Kindle.json loading error
        }
    }

    /**
     * Import new data from kindle.json (with duplicate check)
     */
    async importFromKindle(fileInput = null) {
        let kindleBooks;
        
        if (fileInput) {
            // ファイル入力からインポート
            const fileContent = await this.readFileContent(fileInput);
            kindleBooks = JSON.parse(fileContent);
        } else {
            // data/kindle.json からインポート
            const response = await fetch('data/kindle.json');
            kindleBooks = await response.json();
        }

        const importResults = {
            total: kindleBooks.length,
            added: 0,
            updated: 0,
            skipped: 0
        };

        for (const kindleBook of kindleBooks) {
            const existingBook = this.library.books.find(book => book.asin === kindleBook.asin);
            
            if (existingBook) {
                // 既存書籍の更新（新しい情報で上書き）
                if (this.shouldUpdateBook(existingBook, kindleBook)) {
                    Object.assign(existingBook, {
                        title: kindleBook.title,
                        authors: kindleBook.authors,
                        acquiredTime: kindleBook.acquiredTime,
                        readStatus: kindleBook.readStatus,
                        productImage: kindleBook.productImage
                    });
                    importResults.updated++;
                }
                else {
                    importResults.skipped++;
                }
            } else {
                // 新規書籍の追加
                this.library.books.push({
                    ...kindleBook,
                    source: 'kindle_import',
                    addedDate: Date.now()
                });
                importResults.added++;
            }
        }

        // メタデータ更新
        this.library.metadata.lastImportDate = Date.now();
        this.library.metadata.totalBooks = this.library.books.length;
        this.library.metadata.importedFromKindle = this.library.books.filter(book => book.source === 'kindle_import').length;

        await this.saveLibrary();
        
        console.log('インポート結果:', importResults);
        return importResults;
    }

    async importSelectedBooks(selectedBooks) {
        const importedBooks = [];
        const duplicateBooks = [];
        const errorBooks = [];
        
        // 既存の本のASINを取得
        const existingASINs = new Set(this.library.books.map(book => book.asin));
        
        for (const book of selectedBooks) {
            try {
                // Duplicate check
                if (existingASINs.has(book.asin)) {
                    duplicateBooks.push({
                        title: book.title,
                        asin: book.asin,
                        reason: '既に存在'
                    });
                    continue;
                }
                
                // 本を追加
                const bookToAdd = {
                    ...book,
                    source: 'kindle_import',
                    addedDate: Date.now()
                };
                
                this.library.books.push(bookToAdd);
                importedBooks.push(bookToAdd);
                
            } catch (error) {
                console.error(`本の処理エラー: ${book.title}`, error);
                errorBooks.push({
                    title: book.title,
                    asin: book.asin,
                    reason: error.message
                });
            }
        }
        
        // メタデータを更新
        this.library.metadata = {
            totalBooks: this.library.books.length,
            manuallyAdded: this.library.books.filter(b => b.source === 'manual_add').length,
            importedFromKindle: this.library.books.filter(b => b.source === 'kindle_import').length,
            lastImportDate: Date.now()
        };
        
        // ライブラリを保存
        await this.saveLibrary();
        
        console.log(`選択インポート完了: ${importedBooks.length}件追加`);
        
        return {
            success: true,
            total: selectedBooks.length,
            added: importedBooks.length,
            updated: 0, // 選択インポートでは更新なし
            skipped: duplicateBooks.length + errorBooks.length,
            imported: importedBooks,
            duplicates: duplicateBooks,
            errors: errorBooks
        };
    }


    /**
     * 書籍更新が必要かチェック
     */
    shouldUpdateBook(existingBook, newBook) {
        return existingBook.acquiredTime !== newBook.acquiredTime ||
               existingBook.readStatus !== newBook.readStatus ||
               existingBook.title !== newBook.title ||
               existingBook.productImage !== newBook.productImage;
    }

    /**
     * AmazonリンクからASINを抽出
     */
    extractASINFromUrl(url) {
        const patterns = [
            /amazon\.co\.jp\/dp\/([A-Z0-9]{10})/,
            /amazon\.co\.jp\/.*\/dp\/([A-Z0-9]{10})/,
            /amazon\.com\/dp\/([A-Z0-9]{10})/,
            /amazon\.com\/.*\/dp\/([A-Z0-9]{10})/,
            /\/([A-Z0-9]{10})(?:\/|\?|$)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Automatically fetch book information from ASIN (combination of multiple APIs)
     */
    async fetchBookDataFromAmazon(asin) {
        console.log(`Starting book information fetch: ${asin}`);

        try {
            // Search with Google Books API (actually working)
            const googleBooksData = await this.fetchFromGoogleBooks(asin);
            if (googleBooksData && googleBooksData.title && googleBooksData.title !== 'Title not retrieved') {
                console.log('Successfully fetched from Google Books:', googleBooksData);
                return googleBooksData;
            }
        } catch (error) {
            console.log('Google Books search failed:', error.message);
        }

        // Return template if not found in Google Books
        console.log('Auto-fetch failed, using template as fallback');
        return this.generateSmartBookData(asin);
    }

    /**
     * Fetch book information from Google Books API
     */
    async fetchFromGoogleBooks(asin) {
        try {
            console.log(`Google Books API search: ${asin}`);

            // Search as ISBN
            let url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${asin}`;
            let response = await fetch(url);
            let data = await response.json();

            console.log('Google Books ISBN search results:', data);

            if (data.items && data.items.length > 0) {
                const book = data.items[0].volumeInfo;
                console.log('Found book:', book);

                return {
                    asin: asin,
                    title: book.title || 'Title not retrieved',
                    authors: book.authors ? book.authors.join(', ') : 'Author not retrieved',
                    acquiredTime: Date.now(),
                    readStatus: 'UNKNOWN',
                    productImage: book.imageLinks ?
                        (book.imageLinks.large || book.imageLinks.medium || book.imageLinks.thumbnail) :
                        `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`
                };
            }

            // If not found by ISBN, try general search
            url = `https://www.googleapis.com/books/v1/volumes?q=${asin}`;
            response = await fetch(url);
            data = await response.json();

            console.log('Google Books general search results:', data);

            if (data.items && data.items.length > 0) {
                const book = data.items[0].volumeInfo;
                console.log('Book found in general search:', book);

                return {
                    asin: asin,
                    title: book.title || 'Title not retrieved',
                    authors: book.authors ? book.authors.join(', ') : 'Author not retrieved',
                    acquiredTime: Date.now(),
                    readStatus: 'UNKNOWN',
                    productImage: book.imageLinks ?
                        (book.imageLinks.large || book.imageLinks.medium || book.imageLinks.thumbnail) :
                        `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`
                };
            }

            throw new Error('Book not found');

        } catch (error) {
            console.warn('Google Books API error:', error);
            throw error;
        }
    }


    /**
     * Generate smart book data (practical approach)
     */
    generateSmartBookData(asin) {
        // Infer book type from ASIN format and provide more practical information
        let title, authors;

        if (asin.startsWith('B') && asin.length === 10) {
            // For Kindle books
            title = '';  // Empty to prompt manual input
            authors = '';
        } else if (/^\d{9}[\dX]$/.test(asin)) {
            // For ISBN-10
            title = '';
            authors = '';
        } else {
            // Other
            title = '';
            authors = '';
        }

        return {
            asin: asin,
            title: title,
            authors: authors,
            acquiredTime: Date.now(),
            readStatus: 'UNKNOWN',
            productImage: `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`
        };
    }



    /**
     * 表示・リンク用の有効なASINを取得
     */
    getEffectiveASIN(book) {
        return book.updatedAsin || book.asin;
    }

    /**
     * Amazon商品画像URLを取得
     */
    getProductImageUrl(book) {
        if (book.cover_image) return book.cover_image;
        if (book.coverImage) return book.coverImage;
        if (book.productImage) return book.productImage;
        if (book.cover_image_url) return book.cover_image_url;

        const effectiveAsin = this.getEffectiveASIN(book);
        if (!effectiveAsin || effectiveAsin.startsWith('curated-')) {
            return '';
        }
        return `https://images-na.ssl-images-amazon.com/images/P/${effectiveAsin}.01.L.jpg`;
    }

    /**
     * AmazonアフィリエイトリンクURLを生成
     */
    getAmazonUrl(book, affiliateId = null) {
        const effectiveAsin = this.getEffectiveASIN(book);
        if (!effectiveAsin || effectiveAsin.startsWith('curated-') || !this.isValidASIN(effectiveAsin)) {
            return null;
        }

        let url = `https://www.amazon.co.jp/dp/${effectiveAsin}`;

        if (affiliateId) {
            url += `?tag=${affiliateId}`;
        }

        return url;
    }

    /**
     * Add book manually
     */
    async addBookManually(bookData) {
        const asin = bookData.asin;

        if (!asin || !this.isValidASIN(asin)) {
            throw new Error('Valid ASIN is required');
        }

        // Duplicate check
        if (this.library.books.find(book => book.asin === asin)) {
            throw new Error('This book is already in your library');
        }

        const newBook = {
            asin: asin,
            title: bookData.title || 'Title not set',
            authors: bookData.authors || 'Author not set',
            acquiredTime: bookData.acquiredTime || Date.now(),
            readStatus: bookData.readStatus || 'UNKNOWN',
            productImage: bookData.productImage || `https://images-na.ssl-images-amazon.com/images/P/${asin}.01.L.jpg`,
            source: 'manual_add',
            addedDate: Date.now()
        };

        this.library.books.push(newBook);
        this.library.metadata.totalBooks = this.library.books.length;
        this.library.metadata.manuallyAdded = this.library.books.filter(book => book.source === 'manual_add').length;

        await this.saveLibrary();
        return newBook;
    }

    /**
     * Add book from Amazon link
     */
    async addBookFromAmazonUrl(url) {
        const asin = this.extractASINFromUrl(url);
        if (!asin) {
            throw new Error('Not a valid Amazon link');
        }

        // Get book information from Amazon API (simplified version)
        const bookData = await this.fetchBookDataFromAmazon(asin);
        return await this.addBookManually(bookData);
    }

    /**
     * Delete book
     */
    async deleteBook(asin, hardDelete = false) {
        const bookIndex = this.library.books.findIndex(book => book.asin === asin);
        
        if (bookIndex === -1) {
            throw new Error('Specified book not found');
        }

        if (hardDelete) {
            // Complete deletion
            this.library.books.splice(bookIndex, 1);
            this.library.metadata.totalBooks = this.library.books.length;
            
            // Update count by source
            this.library.metadata.manuallyAdded = this.library.books.filter(book => book.source === 'manual_add').length;
            this.library.metadata.importedFromKindle = this.library.books.filter(book => book.source === 'kindle_import').length;
        }

        await this.saveLibrary();
        return true;
    }

    /**
     * 蔵書を全てクリア
     */
    async clearAllBooks() {
        this.library.books = [];
        this.library.metadata = {
            totalBooks: 0,
            manuallyAdded: 0,
            importedFromKindle: 0,
            lastImportDate: null
        };
        
        await this.saveLibrary();
        return true;
    }

    /**
     * 書籍情報を更新
     */
    async updateBook(asin, updates) {
        const bookIndex = this.library.books.findIndex(book => book.asin === asin);
        if (bookIndex === -1) {
            throw new Error('Specified book not found');
        }

        const book = this.library.books[bookIndex];

        // undefinedの場合はプロパティを削除
        Object.keys(updates).forEach(key => {
            if (updates[key] === undefined) {
                delete book[key];
            } else {
                book[key] = updates[key];
            }
        });

        // メタデータを更新
        this.library.metadata.totalBooks = this.library.books.length;
        this.library.metadata.manuallyAdded = this.library.books.filter(b => b.source === 'manual_add').length;
        this.library.metadata.importedFromKindle = this.library.books.filter(b => b.source === 'kindle_import').length;

        await this.saveLibrary();
        return book;
    }

    /**
     * ASINの妥当性チェック
     */
    isValidASIN(asin) {
        return /^[A-Z0-9]{10}$/.test(asin);
    }

    /**
     * ファイル内容を読み取り
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Save library data to file (for export)
     */
    async saveLibrary() {
        // Save to LocalStorage
        localStorage.setItem('virtualBookshelf_library', JSON.stringify(this.library));
        
        // Export in downloadable format
        return this.library;
    }


    /**
     * 統計情報を取得
     */
    getStatistics() {
        const books = this.library.books;
        return {
            total: books.length,
            read: books.filter(book => book.readStatus === 'READ').length,
            unread: books.filter(book => book.readStatus === 'UNKNOWN').length,
            manuallyAdded: books.filter(book => book.source === 'manual_add').length,
            importedFromKindle: books.filter(book => book.source === 'kindle_import').length,
            lastImportDate: this.library.metadata.lastImportDate
        };
    }

    /**
     * 全ての書籍を取得
     */
    getAllBooks() {
        return this.library.books;
    }

    /**
     * Search book by ASIN
     */
    findBookByASIN(asin) {
        return this.library.books.find(book => book.asin === asin);
    }

    /**
     * Search book by title or author
     */
    searchBooks(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.library.books.filter(book => 
            book.title.toLowerCase().includes(lowercaseQuery) ||
            book.authors.toLowerCase().includes(lowercaseQuery)
        );
    }
}

// BookManager automatic export process (periodic save)
class AutoSaveManager {
    constructor(bookManager) {
        this.bookManager = bookManager;
        this.setupAutoSave();
    }

    setupAutoSave() {
        // Auto-save every 5 minutes
        setInterval(() => {
            this.bookManager.saveLibrary();
        }, 5 * 60 * 1000);

        // Save on page unload
        window.addEventListener('beforeunload', () => {
            this.bookManager.saveLibrary();
        });
    }
}