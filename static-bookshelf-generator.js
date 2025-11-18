/**
 * StaticBookshelfGenerator - Static bookshelf page generation functionality
 * Generates static HTML files from bookshelf data for SNS sharing
 */
class StaticBookshelfGenerator {
    constructor(bookManager, userData) {
        this.bookManager = bookManager;
        this.userData = userData;
        this.baseUrl = window.location.origin + window.location.pathname.replace('index.html', '');
    }

    /**
     * Generate static bookshelf page
     */
    async generateStaticBookshelf(bookshelfId, options = {}) {
        try {
            // Get bookshelf information
            const bookshelf = this.userData.bookshelves?.find(b => b.id === bookshelfId);
            if (!bookshelf) {
                throw new Error('Specified bookshelf not found');
            }

            // Get books included in bookshelf (use getBookshelfBooks, not getBookshelfBooksWithUserData)
            const books = this.getBookshelfBooks(bookshelfId);

            // Get HTML template
            const template = await this.loadTemplate();

            // Populate template with values
            const htmlContent = this.populateTemplate(template, bookshelf, books, options);

            // Save as static file
            const filename = `${bookshelfId}.html`;
            const url = await this.saveStaticFile(filename, htmlContent);

            return {
                success: true,
                filename: filename,
                url: url,
                bookshelf: bookshelf,
                totalBooks: books.length
            };

        } catch (error) {
            console.error('Static bookshelf generation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get books in bookshelf
     */
    getBookshelfBooks(bookshelfId) {
        // Get latest userData
        const latestUserData = window.bookshelf ? window.bookshelf.userData : this.userData;
        
        const bookshelf = latestUserData.bookshelves?.find(b => b.id === bookshelfId);
        if (!bookshelf || !bookshelf.books) return [];

        // Get books in bookshelf order
        let books = bookshelf.books
            .map(bookId => this.bookManager.findBookByASIN(bookId))
            .filter(book => book !== undefined);

        // Apply custom order if available
        const customOrder = latestUserData.bookOrder?.[bookshelfId];
        if (customOrder && customOrder.length > 0) {
            books.sort((a, b) => {
                const aIndex = customOrder.indexOf(a.asin);
                const bIndex = customOrder.indexOf(b.asin);
                
                if (aIndex === -1 && bIndex === -1) return 0; // Both not in custom order
                if (aIndex === -1) return 1; // a not in custom order, put at end
                if (bIndex === -1) return -1; // b not in custom order, put at end
                return aIndex - bIndex; // Both in custom order, use custom order
            });
        }

        return books;
    }



    /**
     * Load template file
     */
    async loadTemplate() {
        try {
            const response = await fetch('templates/bookshelf-template.html');
            if (!response.ok) {
                throw new Error('Failed to load template file');
            }
            return await response.text();
        } catch (error) {
            // Fallback: return basic template
            return this.getBasicTemplate();
        }
    }

    /**
     * Populate template with values
     */
    populateTemplate(template, bookshelf, books, options = {}) {
        const now = new Date();
        const booksHtml = this.generateBooksHtml(books);
        const coverImage = this.generateBookshelfCoverImage(books);

        // Generate URL (fixed based on bookshelf ID)
        const bookshelfUrl = `${this.baseUrl}static/${bookshelf.id}.html`;
        const encodedUrl = encodeURIComponent(bookshelfUrl);
        const encodedTitle = encodeURIComponent(`${bookshelf.name} - Virtual Bookshelf`);

        const replacements = {
            '{{BOOKSHELF_NAME}}': this.escapeHtml(bookshelf.name),
            '{{BOOKSHELF_DESCRIPTION}}': this.escapeHtml(bookshelf.description || `Bookshelf: ${bookshelf.name}`),
            '{{BOOKSHELF_EMOJI}}': bookshelf.emoji || '📚',
            '{{BOOKSHELF_URL}}': bookshelfUrl,
            '{{BOOKSHELF_COVER_IMAGE}}': coverImage,
            '{{TOTAL_BOOKS}}': books.length,
            '{{CREATED_DATE}}': this.formatDate(bookshelf.createdDate || now),

            '{{BOOKS_HTML}}': booksHtml,
            '{{ENCODED_URL}}': encodedUrl,
            '{{ENCODED_TITLE}}': encodedTitle,
            '{{ENCODED_BOOKSHELF_NAME}}': encodeURIComponent(bookshelf.name)
        };

        let populatedTemplate = template;
        Object.entries(replacements).forEach(([placeholder, value]) => {
            populatedTemplate = populatedTemplate.replace(new RegExp(placeholder, 'g'), value);
        });

        return populatedTemplate;
    }

    /**
     * Generate HTML for book list
     */
    generateBooksHtml(books) {
        return books.map(book => {
            const userNote = this.userData.notes?.[book.asin];
            const rating = userNote?.rating || 0;
            const memo = userNote?.memo || '';
            const amazonUrl = this.bookManager.getAmazonUrl(book, this.userData.settings?.affiliateId);

            // Convert markdown links to HTML
            const memoHtml = memo ? this.convertMarkdownLinksToHtml(memo) : '';

            return `
                <div class="static-book-item">
                    <a href="${amazonUrl}" target="_blank" rel="noopener noreferrer">
                        <img class="static-book-cover"
                             src="${this.escapeHtml(this.bookManager.getProductImageUrl(book))}"
                             alt="${this.escapeHtml(book.title)}"
                             loading="lazy">
                    </a>
                    <div class="static-book-info">
                        <div class="static-book-title">${this.escapeHtml(book.title)}</div>
                        <div class="static-book-author">${this.escapeHtml(book.authors)}</div>
                        ${rating > 0 ? `<div class="static-book-rating">${'⭐'.repeat(rating)}</div>` : ''}
                        ${memoHtml ? `<div class="static-book-memo">${memoHtml}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('\n');
    }

    /**
     * Generate bookshelf cover image (using covers of first few books)
     */
    generateBookshelfCoverImage(books) {
        if (books.length === 0) {
            return `${this.baseUrl}images/default-bookshelf-cover.png`;
        }

        // Use first book's image as representative
        const firstBook = books[0];
        return this.bookManager.getProductImageUrl(firstBook);
    }

    /**
     * Save as static file (download)
     */
    async saveStaticFile(filename, content) {
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        // Release URL after a certain time
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        // Return public URL (actual deployment URL)
        return `${this.baseUrl}static/${filename}`;
    }

    /**
     * Basic template (for fallback)
     */
    getBasicTemplate() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{BOOKSHELF_NAME}} - Virtual Bookshelf</title>
    <meta property="og:title" content="{{BOOKSHELF_NAME}} - Virtual Bookshelf">
    <meta property="og:description" content="{{BOOKSHELF_DESCRIPTION}}">
    <meta property="og:url" content="{{BOOKSHELF_URL}}">
    <link rel="stylesheet" href="../css/bookshelf.css">
</head>
<body>
    <div class="container">
        <h1>{{BOOKSHELF_EMOJI}} {{BOOKSHELF_NAME}}</h1>
        <p>{{BOOKSHELF_DESCRIPTION}}</p>
        <div class="books-grid">{{BOOKS_HTML}}</div>
    </div>
</body>
</html>`;
    }

    /**
     * Format date
     */
    formatDate(date) {
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /**
     * HTML escape
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Update bookshelf visibility settings
     */
    updateBookshelfVisibility(bookshelfId, isPublic) {
        const bookshelf = this.userData.bookshelves?.find(b => b.id === bookshelfId);
        if (bookshelf) {
            bookshelf.isPublic = isPublic;
            bookshelf.lastUpdated = Date.now();
            // Note: saveUserData should be called from the main application
        }
    }

    /**
     * Get list of public bookshelves
     */
    getPublicBookshelves() {
        return this.userData.bookshelves
            ?.filter(bookshelf => bookshelf.isPublic)
            .map(bookshelf => ({
                ...bookshelf,
                url: `${this.baseUrl}static/${bookshelf.id}.html`
            })) || [];
    }

    /**
     * Convert markdown links to HTML
     */
    convertMarkdownLinksToHtml(text) {
        // Convert markdown link syntax [text](url) to HTML <a> tags
        return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }
}