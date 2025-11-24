// BookBar - Main JavaScript
// Debug flag system
const DEBUG = false; // Set to false for production

function debugLog(...args) {
    if (DEBUG) {
        console.log('[BookBar Debug]', ...args);
    }
}

function debugError(...args) {
    if (DEBUG) {
        console.error('[BookBar Error]', ...args);
    }
}

// API Helper Functions
const API_BASE_URL = 'http://localhost:3000/api';

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('bookbar_token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// User Management System
class UserManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        // Check if user is logged in
        const token = localStorage.getItem('bookbar_token');
        if (token) {
            try {
                const data = await apiRequest('/auth/me');
                this.currentUser = data.user;
                this.updateUI();
            } catch (error) {
                // Token invalid, clear it
                localStorage.removeItem('bookbar_token');
            }
        }
    }

    async register(name, email, password, bio = '') {
        try {
            const data = await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, password, bio })
            });

            if (data.success && data.token) {
                localStorage.setItem('bookbar_token', data.token);
                this.currentUser = data.user;
                this.updateUI();
                return { success: true, user: data.user };
            }
            return { success: false, message: 'Registration failed.' };
        } catch (error) {
            return { success: false, message: error.message || 'Registration failed.' };
        }
    }

    async login(email, password) {
        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            if (data.success && data.token) {
                localStorage.setItem('bookbar_token', data.token);
                this.currentUser = data.user;
                this.updateUI();
                return { success: true, user: data.user };
            }
            return { success: false, message: 'Login failed.' };
        } catch (error) {
            return { success: false, message: error.message || 'Invalid email or password.' };
        }
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('bookbar_token');
        this.updateUI();
    }

    updateUI() {
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        const userAvatar = document.getElementById('user-avatar');
        if (this.currentUser) {
            // User is logged in
            if (authButtons) authButtons.style.display = 'none';
            if (userMenu) {
                userMenu.style.display = 'flex';
                if (userName) userName.textContent = this.currentUser.name;
                if (userAvatar) {
                    const initials = this.currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    userAvatar.textContent = initials;
                }
            }
        } else {
            // User is not logged in
            if (authButtons) authButtons.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }
}

// Initialize UserManager
const userManager = new UserManager();

class VirtualBookshelf {
    constructor() {
        this.books = [];
        this.userData = null;
        this.filteredBooks = [];
        this.currentView = 'covers';
        this.currentViewMode = 'all'; // 'all', 'favorites', 'authors'
        this.currentPage = 1;
        this.currentPeoplePage = 1;
        this.booksPerPage = 50;
        this.sortOrder = 'custom';
        this.sortDirection = 'desc';
        this.lastNotificationCheck = null;
        this.notificationCheckInterval = null;
        this.viewHistory = []; // Track view history
        this.isNavigatingBack = false; // Flag to prevent adding to history when going back
        
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            
            // Check if books are loaded
            if (!this.books || this.books.length === 0) {
                console.warn('No books loaded, but continuing...');
            }
            
            this.setupEventListeners();
            this.setupLanguageListener();
            this.updateBookshelfSelector();
            this.updateSortDirectionButton();
            this.renderBookshelfOverview();
            
            // Start checking for new notifications
            this.startNotificationPolling();
            
            // Setup browser history management
            this.setupHistoryManagement();
            
            // Navigate to view from URL if present (after a short delay to ensure everything is loaded)
            setTimeout(() => {
                const hash = window.location.hash;
                if (hash && history.state && history.state.view) {
                    this.navigateToView(history.state.view, history.state.params || {});
                }
            }, 100);
            
            // Apply filters before displaying to ensure filteredBooks is populated
            // Check if userData is available before applying filters
            if (this.userData) {
                this.applyFilters();
            } else {
                // If no userData, just use all books
                this.filteredBooks = this.books || [];
            }
            
            this.updateDisplay();
            this.updateStats();
            
            // Initialize HighlightsManager after bookshelf is ready
            if (typeof HighlightsManager !== 'undefined') {
                window.highlightsManager = new HighlightsManager(this);
            }
            
            // Hide loading indicator
            this.hideLoading();
        } catch (error) {
            console.error('Initialization error:', error);
            console.error('Error stack:', error.stack);
            // Try to show more detailed error
            const errorMessage = error.message || 'An error occurred while loading data.';
            this.showError(errorMessage);
            this.hideLoading();
        }
    }

    setupLanguageListener() {
        // Listen for language changes
        window.addEventListener('languageChanged', (event) => {
            // Update all dynamic content when language changes
            if (this.currentViewMode === 'profile') {
                this.showProfile();
            } else if (this.currentViewMode === 'messages') {
                this.showMessages();
            } else if (this.currentViewMode === 'notifications') {
                this.showNotifications();
            } else if (this.currentViewMode === 'people') {
                this.showPeople();
            }
            // Update user menu dropdown if it exists
            const dropdown = document.getElementById('user-menu-dropdown');
            if (dropdown) {
                this.createUserMenuDropdown();
            }
        });
    }

    async loadData() {
        // Initialize BookManager
        this.bookManager = new BookManager();
        await this.bookManager.initialize();

        // Get books from BookManager instead of direct kindle.json
        this.books = this.bookManager.getAllBooks();
        
        // Load config data
        let config = {};
        try {
            const configResponse = await fetch('data/config.json');
            config = await configResponse.json();
        } catch (error) {
            console.error('Failed to load config.json:', error);
            // Don't throw error, just use empty config
            config = {};
        }
        
        // Check localStorage first for user data
        const savedUserData = localStorage.getItem('virtualBookshelf_userData');
        
        if (savedUserData) {
            // Use localStorage data as primary source
            this.userData = JSON.parse(savedUserData);
        } else {
            // Fallback to file if localStorage is empty
            try {
                const libraryResponse = await fetch('data/library.json');
                if (!libraryResponse.ok) {
                    throw new Error('library.json not found');
                }
                
                const text = await libraryResponse.text();
                if (!text.trim()) {
                    // Use default data when the file is empty
                    console.log('Empty library.json detected, using defaults');
                    this.userData = this.createDefaultUserData();
                } else {
                    // Check if response is HTML (error page) instead of JSON
                    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                        console.log('library.json returned HTML instead of JSON, using defaults');
                        this.userData = this.createDefaultUserData();
                    } else {
                        const libraryData = JSON.parse(text);
                    // Extract necessary parts from the unified data
                    this.userData = {
                        exportDate: libraryData.exportDate || new Date().toISOString(),
                        bookshelves: libraryData.bookshelves || [],
                        notes: {},
                        settings: libraryData.settings || this.getDefaultSettings(),
                        bookOrder: libraryData.bookOrder || {},
                        stats: libraryData.stats || { totalBooks: 0, notesCount: 0 },
                        version: libraryData.version || '2.0'
                    };
                        // Rebuild user notes based on book data
                        if (libraryData.books) {
                            Object.keys(libraryData.books).forEach(asin => {
                                const book = libraryData.books[asin];
                                if (book.memo || book.rating) {
                                    this.userData.notes[asin] = {
                                        memo: book.memo || '',
                                        rating: book.rating || 0
                                    };
                                }
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load library.json:', error);
                console.log('Using default user data');
                this.userData = this.createDefaultUserData();
            }
        }
        
        // Merge config into userData settings
        this.userData.settings = { ...this.userData.settings, ...config };
        
        this.currentView = this.userData.settings.defaultView || 'covers';
        
        // Load cover size setting
        const coverSize = this.userData.settings.coverSize || 'medium';
        const coverSizeElement = document.getElementById('cover-size');
        if (coverSizeElement) {
            coverSizeElement.value = coverSize;
        }
        
        // Hybrid view is deprecated; fall back to covers
        if (this.currentView === 'hybrid') {
            this.currentView = 'covers';
        }
        
        // Load books per page setting
        if (this.userData.settings.booksPerPage) {
            if (this.userData.settings.booksPerPage === 'all') {
                this.booksPerPage = 999999;
            } else {
                this.booksPerPage = this.userData.settings.booksPerPage;
            }
            const booksPerPageElement = document.getElementById('books-per-page');
            if (booksPerPageElement) {
                booksPerPageElement.value = this.userData.settings.booksPerPage;
            }
        }
        this.showImagesInOverview = this.userData.settings.showImagesInOverview !== false; // Default true

        // Initialize Static Bookshelf Generator after userData is fully loaded
        this.staticGenerator = new StaticBookshelfGenerator(this.bookManager, this.userData);

        this.applyFilters();
    }

    setupEventListeners() {
        // Auth buttons - open modals
        const btnLogin = document.getElementById('btn-login');
        const btnSignup = document.getElementById('btn-signup');
        if (btnLogin) {
            btnLogin.addEventListener('click', (e) => {
                e.preventDefault();
                // Open login page
                window.location.href = 'login.html';
            });
        }
        if (btnSignup) {
            btnSignup.addEventListener('click', (e) => {
                e.preventDefault();
                // Open signup page
                window.location.href = 'signup.html';
            });
        }

        // Login modal
        const loginModal = document.getElementById('login-modal');
        if (loginModal) {
            const loginForm = document.getElementById('login-form');
            const loginClose = document.getElementById('login-modal-close');
            const cancelLogin = document.getElementById('cancel-login');
            
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleLogin();
                });
            }
            if (loginClose) loginClose.addEventListener('click', () => this.closeModal('login-modal'));
            if (cancelLogin) cancelLogin.addEventListener('click', () => this.closeModal('login-modal'));
        }

        // Signup modal
        const signupModal = document.getElementById('signup-modal');
        if (signupModal) {
            const signupForm = document.getElementById('signup-form');
            const signupClose = document.getElementById('signup-modal-close');
            const cancelSignup = document.getElementById('cancel-signup');
            
            if (signupForm) {
                signupForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleSignup();
                });
            }
            if (signupClose) signupClose.addEventListener('click', () => this.closeModal('signup-modal'));
            if (cancelSignup) cancelSignup.addEventListener('click', () => this.closeModal('signup-modal'));
        }
        
        // Check login status and update UI
        this.updateAuthUI();
        
        // Navigation links
        const navBooks = document.getElementById('nav-books');
        const navFavorites = document.getElementById('nav-favorites');
        const navAuthors = document.getElementById('nav-authors');
        
        if (navBooks) {
            navBooks.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.currentViewMode !== 'all') {
                    this.showAllBooks();
                }
            });
        }
        
        if (navFavorites) {
            navFavorites.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.currentViewMode !== 'favorites') {
                    this.showFavorites();
                }
            });
        }
        
        if (navAuthors) {
            navAuthors.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.currentViewMode !== 'authors') {
                    this.showAuthors();
                }
            });
        }
        
        // Community dropdown
        const navCommunity = document.getElementById('nav-community');
        const navPeople = document.getElementById('nav-people');
        const navMessages = document.getElementById('nav-messages');
        const communityDropdown = document.getElementById('community-dropdown');
        
        if (navCommunity) {
            navCommunity.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const dropdown = document.querySelector('.nav-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('active');
                }
            });
        }
        
        if (navPeople) {
            navPeople.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showPeople();
                if (communityDropdown) {
                    const dropdown = document.querySelector('.nav-dropdown');
                    if (dropdown) dropdown.classList.remove('active');
                }
            });
        }
        
        if (navMessages) {
            navMessages.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showMessages();
                if (communityDropdown) {
                    const dropdown = document.querySelector('.nav-dropdown');
                    if (dropdown) dropdown.classList.remove('active');
                }
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.querySelector('.nav-dropdown');
            if (dropdown && !dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
        
        // Set initial active state
        const navBooksInitial = document.getElementById('nav-books');
        if (navBooksInitial) {
            navBooksInitial.classList.add('active');
        }
        
        // User menu dropdown
        const userAvatar = document.getElementById('user-avatar');
        if (userAvatar) {
            userAvatar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserMenu();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            this.closeUserMenu();
        });

        // View toggle buttons removed

        
        // Search
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.search(e.target.value);
            });
        }
        
        // Filters
        
        
        // Star rating filters
        ['star-0', 'star-1', 'star-2', 'star-3', 'star-4', 'star-5'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.addEventListener('change', () => this.applyFilters());
            }
        });
        
        // Sort
        const sortOrder = document.getElementById('sort-order');
        if (sortOrder) {
            sortOrder.addEventListener('change', (e) => {
                this.sortOrder = e.target.value;
                this.updateSortDirectionButton();
                this.applySorting();
            });
        }
        
        const sortDirection = document.getElementById('sort-direction');
        if (sortDirection) {
            sortDirection.addEventListener('click', () => {
                this.toggleSortDirection();
            });
        }

        // Books per page
        const booksPerPage = document.getElementById('books-per-page');
        if (booksPerPage) {
            booksPerPage.addEventListener('change', (e) => {
                this.setBooksPerPage(e.target.value);
            });
        }

        // Cover size
        const coverSize = document.getElementById('cover-size');
        if (coverSize) {
            coverSize.addEventListener('change', (e) => {
                this.setCoverSize(e.target.value);
            });
        }

        // Bookshelf selector (optional - may not exist in new design)
        const bookshelfSelector = document.getElementById('bookshelf-selector');
        if (bookshelfSelector) {
            bookshelfSelector.addEventListener('change', (e) => {
                this.switchBookshelf(e.target.value);
                this.updateStaticPageButton(e.target.value);
            });
        }

        // Static page button
        const viewStaticPageBtn = document.getElementById('view-static-page');
        if (viewStaticPageBtn) {
            viewStaticPageBtn.addEventListener('click', () => this.openStaticPage());
        }

        // Export button (optional - only visible when logged in)
        const exportBtn = document.getElementById('export-unified');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportUnifiedData();
            });
        }

        // Bookshelf management
        const manageBookshelves = document.getElementById('manage-bookshelves');
        if (manageBookshelves) {
            manageBookshelves.addEventListener('click', () => {
                this.showBookshelfManager();
            });
        }

        // Add bookshelf button
        const addBookshelfBtn = document.getElementById('add-bookshelf');
        if (addBookshelfBtn) {
            addBookshelfBtn.addEventListener('click', () => {
                this.addBookshelf();
            });
        }

        // Library management buttons - use correct IDs (optional - only visible when logged in)
        const importKindle = document.getElementById('import-kindle');
        if (importKindle) {
            importKindle.addEventListener('click', () => {
                this.showImportModal();
            });
        }

        const addBookManually = document.getElementById('add-book-manually');
        if (addBookManually) {
            addBookManually.addEventListener('click', () => {
                this.showAddBookModal();
            });
        }

        // JSON Import button
        const importJson = document.getElementById('import-json');
        if (importJson) {
            importJson.addEventListener('click', () => {
                this.openModal('json-import-modal');
            });
        }

        // JSON Import modal handlers
        const jsonImportModal = document.getElementById('json-import-modal');
        if (jsonImportModal) {
            const jsonImportBtn = document.getElementById('import-json-btn');
            const jsonImportClose = document.getElementById('json-import-modal-close');
            const cancelJsonImport = document.getElementById('cancel-json-import');
            const jsonFileInput = document.getElementById('json-file-input');
            
            if (jsonImportBtn) {
                jsonImportBtn.addEventListener('click', () => {
                    this.handleJsonImport();
                });
            }
            if (jsonImportClose) jsonImportClose.addEventListener('click', () => this.closeModal('json-import-modal'));
            if (cancelJsonImport) cancelJsonImport.addEventListener('click', () => this.closeModal('json-import-modal'));
            
            if (jsonFileInput) {
                jsonFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            document.getElementById('json-input').value = event.target.result;
                        };
                        reader.readAsText(file);
                    }
                });
            }
        }


        // Unified export button handled above (export-library removed)

        // Import from file button
        const importFromFile = document.getElementById('import-from-file');
        if (importFromFile) {
            importFromFile.addEventListener('click', () => {
                this.importFromFile();
            });
        }

        // Bookshelf display toggle
        const toggleBtn = document.getElementById('toggle-bookshelf-display');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleBookshelfDisplay();
            });
        }

        // Modal close - individual handlers for each modal
        const bookModalClose = document.getElementById('modal-close');
            if (bookModalClose) {
                bookModalClose.addEventListener('click', () => this.closeModal('book-modal'));
            }

        const bookshelfModalClose = document.getElementById('bookshelf-modal-close');
        if (bookshelfModalClose) {
            bookshelfModalClose.addEventListener('click', () => this.closeBookshelfModal());
        }

        const importModalClose = document.getElementById('import-modal-close');
        if (importModalClose) {
            importModalClose.addEventListener('click', () => this.closeImportModal());
        }

        const addBookModalClose = document.getElementById('add-book-modal-close');
        if (addBookModalClose) {
            addBookModalClose.addEventListener('click', () => this.closeAddBookModal());
        }

        const bookshelfFormModalClose = document.getElementById('bookshelf-form-modal-close');
        if (bookshelfFormModalClose) {
            bookshelfFormModalClose.addEventListener('click', () => this.closeBookshelfForm());
        }

        const cancelBookshelfForm = document.getElementById('cancel-bookshelf-form');
        if (cancelBookshelfForm) {
            cancelBookshelfForm.addEventListener('click', () => this.closeBookshelfForm());
        }

        const saveBookshelfForm = document.getElementById('save-bookshelf-form');
        if (saveBookshelfForm) {
            saveBookshelfForm.addEventListener('click', () => this.saveBookshelfForm());
        }

        // Enter key to submit bookshelf form
        const bookshelfNameInput = document.getElementById('bookshelf-name');
        if (bookshelfNameInput) {
            bookshelfNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.saveBookshelfForm();
                }
            });
        }

        // Manual add button
        const addManuallyBtn = document.getElementById('add-manually');
        if (addManuallyBtn) {
            addManuallyBtn.addEventListener('click', () => this.addBookManually());
        }

        // ASIN auto-fetch button
        const fetchBookInfoBtn = document.getElementById('fetch-book-info');
        if (fetchBookInfoBtn) {
            fetchBookInfoBtn.addEventListener('click', () => this.fetchBookInfoFromASIN());
        }

        // Trigger auto-fetch when pressing Enter in ASIN input
        const asinInput = document.getElementById('manual-asin');
        if (asinInput) {
            asinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.fetchBookInfoFromASIN();
                }
            });
        }

        // Clear library button
        const clearLibraryBtn = document.getElementById('clear-library');
        if (clearLibraryBtn) {
            clearLibraryBtn.addEventListener('click', () => {
                this.clearLibrary();
            });
        }

        // Static share modal
        const staticShareModalClose = document.getElementById('static-share-modal-close');
        if (staticShareModalClose) {
            staticShareModalClose.addEventListener('click', () => this.closeStaticShareModal());
        }

        const generateStaticPageBtn = document.getElementById('generate-static-page');
        if (generateStaticPageBtn) {
            generateStaticPageBtn.addEventListener('click', () => this.generateStaticPage());
        }

        const cancelStaticShareBtn = document.getElementById('cancel-static-share');
        if (cancelStaticShareBtn) {
            cancelStaticShareBtn.addEventListener('click', () => this.closeStaticShareModal());
        }

        // Event delegation for modal content
        document.addEventListener('click', (e) => {
            // Toggle edit mode
            if (e.target.classList.contains('edit-mode-btn')) {
                const asin = e.target.dataset.asin;
                const book = this.books.find(b => b.asin === asin);
                if (book) {
                    this.showBookDetail(book, true);
                }
            }

            // Cancel edit mode
            if (e.target.classList.contains('cancel-edit-btn')) {
                const asin = e.target.dataset.asin;
                const book = this.books.find(b => b.asin === asin);
                if (book) {
                    this.showBookDetail(book, false);
                }
            }
        });
    }

    setView(view) {
        this.currentView = view;
        this.updateDisplay();
        this.saveUserData();
    }

    search(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        // If viewing favorites, filter by favorites first
        if (this.currentViewMode === 'favorites') {
            const favorites = this.getFavorites();
            this.filteredBooks = this.books.filter(book => favorites.includes(book.asin));
            // Still apply other filters (rating, search, etc.)
            // Continue with normal filtering below
        }
        
        // If viewing authors, don't apply filters (authors view handles its own display)
        if (this.currentViewMode === 'authors') {
            return;
        }
        
        // Start with appropriate book list
        let booksToFilter = this.currentViewMode === 'favorites' ? this.filteredBooks : [...this.books];
        
        this.filteredBooks = booksToFilter.filter(book => {
            // Bookshelf filter
            if (this.currentBookshelf && this.currentBookshelf !== 'all') {
                const bookshelf = this.userData.bookshelves?.find(b => b.id === this.currentBookshelf);
                if (bookshelf && bookshelf.books && !bookshelf.books.includes(book.asin)) {
                    return false;
                }
            }
            
            
            // Star rating filter
            const enabledRatings = [];
            for (let i = 0; i <= 5; i++) {
                const checkbox = document.getElementById(`star-${i}`);
                if (checkbox && checkbox.checked) {
                    enabledRatings.push(i);
                }
            }
            
            // Only apply rating filter if at least one checkbox is checked
            if (enabledRatings.length > 0) {
                // Get book rating - use same logic as getDisplayRatingValue
                let bookRating = 0;
                const userNote = this.userData.notes?.[book.asin];
                if (userNote && userNote.rating) {
                    bookRating = Number(userNote.rating);
                } else if (book && book.rating) {
                    bookRating = Number(book.rating);
                } else if (book && book.average_rating) {
                    // Rating'i yuvarlama - 1.0-1.9 -> 1, 2.0-2.9 -> 2, vb.
                    // Math.floor kullanarak: 1.0-1.99 -> 1, 2.0-2.99 -> 2
                    const rating = Number(book.average_rating);
                    bookRating = Math.floor(rating);
                    // Eğer rating 0 ise veya geçersizse, 0 olarak bırak
                    if (isNaN(bookRating) || bookRating < 0) {
                        bookRating = 0;
                    }
                } else if (book && book.averageRating) {
                    const rating = Number(book.averageRating);
                    bookRating = Math.floor(rating);
                    if (isNaN(bookRating) || bookRating < 0) {
                        bookRating = 0;
                    }
                }
                
                // Filter: only show books with ratings in enabledRatings array
                if (!enabledRatings.includes(bookRating)) {
                    return false;
                }
            }
            // If no ratings are enabled (all unchecked), show all books (no filtering)
            
            // Search filter
            if (this.searchQuery) {
                const searchText = `${book.title} ${book.authors}`.toLowerCase();
                if (!searchText.includes(this.searchQuery)) {
                    return false;
                }
            }
            
            return true;
        });
        
        this.applySorting();
    }

    applySorting() {
        this.filteredBooks.sort((a, b) => {
            let aValue = a[this.sortOrder];
            let bValue = b[this.sortOrder];
            
            if (this.sortOrder === 'acquiredTime') {
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
            }
            
            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }
            
            let comparison = 0;
            if (aValue > bValue) comparison = 1;
            if (aValue < bValue) comparison = -1;
            
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
        
        this.currentPage = 1;
        this.updateDisplay();
        this.updateStats();
    }
    
    toggleSortDirection() {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.updateSortDirectionButton();
        this.applySorting();
    }

    setBooksPerPage(value) {
        if (value === 'all') {
            this.booksPerPage = this.filteredBooks.length || 999999;
        } else {
            const parsedValue = parseInt(value);
            // Guard against invalid values
            if (isNaN(parsedValue) || parsedValue <= 0) {
                this.booksPerPage = 50;
                value = 50;
            } else {
                this.booksPerPage = parsedValue;
            }
        }
        
        this.currentPage = 1;
        
        // Save the setting
        if (!this.userData.settings) {
            this.userData.settings = {};
        }
        this.userData.settings.booksPerPage = value;
        
        this.updateDisplay();
        this.saveUserData();
    }

    setCoverSize(size) {
        // Save the setting
        if (!this.userData.settings) {
            this.userData.settings = {};
        }
        this.userData.settings.coverSize = size;
        
        // Apply CSS class to bookshelf container
        const bookshelf = document.getElementById('bookshelf');
        bookshelf.classList.remove('size-small', 'size-medium', 'size-large');
        bookshelf.classList.add(`size-${size}`);
        
        this.saveUserData();
    }
    
    updateSortDirectionButton() {
        const button = document.getElementById('sort-direction');
        
        if (this.sortOrder === 'custom') {
            button.textContent = '📝 Custom Order';
            button.disabled = true;
            button.style.opacity = '0.5';
        } else {
            button.disabled = false;
            button.style.opacity = '1';
            
            // Update button text based on sort type
            if (this.sortOrder === 'acquiredTime') {
                // Chronological sorts
                if (this.sortDirection === 'asc') {
                    button.textContent = '↑ Oldest first';
                } else {
                    button.textContent = '↓ Newest first';
                }
            } else {
                // String-based sorts (title/author)
                if (this.sortDirection === 'asc') {
                    button.textContent = '↑ A→Z';
                } else {
                    button.textContent = '↓ Z→A';
                }
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateDisplay() {
        const bookshelf = document.getElementById('bookshelf');
        bookshelf.textContent = '';
        
        // Apply view and cover size classes
        const coverSize = this.userData.settings?.coverSize || 'medium';
        bookshelf.className = `bookshelf view-${this.currentView} size-${coverSize}`;
        
        this.renderStandardView(bookshelf);
        
        this.setupPagination();
    }



    renderStandardView(container) {
        // Apply custom book order only if sort order is set to 'custom'
        const bookshelfSelector = document.getElementById('bookshelf-selector');
        const currentBookshelfId = bookshelfSelector ? bookshelfSelector.value : 'all';
        let booksToRender = [...this.filteredBooks];
        
        if (this.sortOrder === 'custom' && this.userData.bookOrder && this.userData.bookOrder[currentBookshelfId]) {
            const customOrder = this.userData.bookOrder[currentBookshelfId];
            
            // Sort books according to custom order, with unordered books at the end
            booksToRender.sort((a, b) => {
                const aIndex = customOrder.indexOf(a.asin);
                const bIndex = customOrder.indexOf(b.asin);
                
                if (aIndex === -1 && bIndex === -1) return 0; // Both not in custom order
                if (aIndex === -1) return 1; // a not in custom order, put at end
                if (bIndex === -1) return -1; // b not in custom order, put at end
                return aIndex - bIndex; // Both in custom order, use custom order
            });
        }
        
        // Handle pagination - determine slice once per render
        const booksPerPage = parseInt(this.booksPerPage) || 50;  // use a safe numeric value
        const currentPage = parseInt(this.currentPage) || 1;
        
        let booksToShow;
        if (booksPerPage >= this.filteredBooks.length) {
            // Show all books
            booksToShow = booksToRender;
        } else {
            // Show paginated books
            const startIndex = (currentPage - 1) * booksPerPage;
            const endIndex = startIndex + booksPerPage;
            booksToShow = booksToRender.slice(startIndex, endIndex);
        }
        
        booksToShow.forEach(book => {
            container.appendChild(this.createBookElement(book, this.currentView));
        });
    }

    createBookElement(book, displayType) {
        const bookElement = document.createElement('div');
        bookElement.className = 'book-item';
        bookElement.dataset.asin = book.asin;
        
        // Add drag-and-drop attributes
        bookElement.draggable = true;
        bookElement.setAttribute('data-book-asin', book.asin);
        
        const userNote = this.userData.notes[book.asin];
        const amazonUrl = this.bookManager.getAmazonUrl(book, this.userData.settings.affiliateId);
        const ratingValue = this.getDisplayRatingValue(book, userNote);
        const ratingHtml = this.displayStarRating(ratingValue, book.average_rating);
        const amazonButtonHtml = amazonUrl ? `<a href="${amazonUrl}" target="_blank" rel="noopener noreferrer" class="book-link amazon-link">Buy</a>` : '';
        const coverImageHtml = this.renderCoverImage(book, amazonUrl);
        
        if (displayType === 'cover' || displayType === 'covers') {
            bookElement.innerHTML = `
                <div class="book-cover-container">
                    <div class="drag-handle">⋮⋮</div>
                    ${coverImageHtml}
                </div>
                <div class="book-info">
                    <div class="book-title">${this.escapeHtml(book.title)}</div>
                    <div class="book-author">${this.escapeHtml(book.authors || 'Unknown author')}</div>
                    <div class="book-links">
                        ${amazonButtonHtml}
                    </div>
                    ${ratingHtml}
                    ${book.genre ? `<div class="book-genre" style="margin-top: 0.5rem; color: #7f8c8d; font-size: 0.85rem;">📚 ${this.escapeHtml(book.genre)}</div>` : ''}
                </div>
            `;
        } else {
            bookElement.innerHTML = `
                <div class="book-cover-container">
                    <div class="drag-handle">⋮⋮</div>
                    ${coverImageHtml}
                </div>
                <div class="book-info">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.authors}</div>
                    <div class="book-links">
                        ${amazonButtonHtml}
                    </div>
                    ${ratingHtml}
                    ${book.genre ? `<div class="book-genre" style="margin-top: 0.5rem; color: #7f8c8d; font-size: 0.85rem;">📚 ${this.escapeHtml(book.genre)}</div>` : ''}
                    ${userNote && userNote.memo ? `<div class="book-memo" style="margin-top: 0.5rem;">📝 ${this.formatMemoForDisplay(userNote.memo, 400)}</div>` : ''}

                </div>
            `;
        }
        
        // Add favorite button event listener
        const favoriteBtn = bookElement.querySelector('.favorite-btn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFavorite(e.target.dataset.asin || e.target.closest('.favorite-btn').dataset.asin);
            });
        }
        
        // Add drag event listeners
        bookElement.addEventListener('dragstart', (e) => this.handleDragStart(e));
        bookElement.addEventListener('dragover', (e) => this.handleDragOver(e));
        bookElement.addEventListener('drop', (e) => this.handleDrop(e));
        bookElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
        
        bookElement.addEventListener('click', (e) => {
            // Prevent click when dragging or clicking drag handle
            if (e.target.closest('.drag-handle') || bookElement.classList.contains('dragging')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // Open book detail page when clicking on book card (except links and buttons)
            if (!e.target.closest('a') && !e.target.closest('button') && !e.target.closest('.drag-handle')) {
                e.preventDefault();
                e.stopPropagation();
                this.showBookDetailPage(book);
                return;
            }
        });
        
        return bookElement;
    }

    renderCoverImage(book, amazonUrl) {
        const imageUrl = this.bookManager.getProductImageUrl(book);
        const imageElement = imageUrl ?
            `<img class="book-cover lazy" data-src="${this.escapeHtml(imageUrl)}" alt="${this.escapeHtml(book.title)}">` :
            `<div class="book-cover-placeholder">${this.escapeHtml(book.title)}</div>`;

        // Check if user is logged in and if book is favorited
        const isLoggedIn = this.isUserLoggedIn();
        const isFavorited = isLoggedIn && this.isBookFavorited(book.asin);
        const favoriteIcon = isLoggedIn ? 
            `<button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-asin="${book.asin}" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}" style="position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; z-index: 10; transition: all 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);" onmouseover="this.style.transform='scale(1.1)'; this.style.background='rgba(255,255,255,1)'" onmouseout="this.style.transform='scale(1)'; this.style.background='rgba(255,255,255,0.9)'">${isFavorited ? '❤️' : '🤍'}</button>` : 
            '';

        if (amazonUrl) {
            return `<div class="book-cover-link" style="position: relative;">${favoriteIcon}<a href="${amazonUrl}" target="_blank" rel="noopener noreferrer">${imageElement}</a></div>`;
        }
        return `<div class="book-cover-link disabled" style="position: relative;">${favoriteIcon}${imageElement}</div>`;
    }
    
    isUserLoggedIn() {
        const token = localStorage.getItem('bookbar_token');
        const user = localStorage.getItem('bookbar_user');
        return !!(token || user);
    }
    
    isBookFavorited(asin) {
        const favorites = this.getFavorites();
        return favorites.includes(asin);
    }
    
    getFavorites() {
        const favoritesJson = localStorage.getItem('bookbar_favorites');
        if (favoritesJson) {
            try {
                return JSON.parse(favoritesJson);
            } catch (e) {
                return [];
            }
        }
        return [];
    }
    
    saveFavorites(favorites) {
        localStorage.setItem('bookbar_favorites', JSON.stringify(favorites));
    }
    
    toggleFavorite(asin) {
        if (!this.isUserLoggedIn()) {
            alert('Please log in to add books to favorites.');
            window.location.href = 'login.html';
            return;
        }
        
        const favorites = this.getFavorites();
        const index = favorites.indexOf(asin);
        
        if (index > -1) {
            favorites.splice(index, 1);
        } else {
            favorites.push(asin);
        }
        
        this.saveFavorites(favorites);
        this.updateDisplay();
    }

    handleDragStart(e) {
        // Get the book-item element, not the drag handle
        const bookItem = e.target.closest('.book-item');
        this.draggedElement = bookItem;
        this.draggedASIN = bookItem.dataset.asin;
        bookItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', this.draggedASIN);
        console.log('🎯 Drag started:', this.draggedASIN, bookItem);
    }

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        
        // Visual feedback
        const target = e.target.closest('.book-item');
        if (target && target !== this.draggedElement) {
            target.style.borderLeft = '3px solid #3498db';
        }
        
        return false;
    }

    handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        const target = e.target.closest('.book-item');
        if (target && target !== this.draggedElement) {
            const targetASIN = target.dataset.asin;
            this.reorderBooks(this.draggedASIN, targetASIN);
        }

        // Clear visual feedback
        document.querySelectorAll('.book-item').forEach(item => {
            item.style.borderLeft = '';
        });

        return false;
    }

    handleDragEnd(e) {
        const bookItem = e.target.closest('.book-item');
        if (bookItem) {
            bookItem.classList.remove('dragging');
        }
        this.draggedElement = null;
        this.draggedASIN = null;
        
        // Clear all visual feedback
        document.querySelectorAll('.book-item').forEach(item => {
            item.style.borderLeft = '';
        });
        console.log('🎯 Drag ended');
    }

    reorderBooks(draggedASIN, targetASIN) {
        const bookshelfSelector = document.getElementById('bookshelf-selector');
        const currentBookshelfId = bookshelfSelector ? bookshelfSelector.value : 'all';
        
        // Initialize bookOrder if it doesn't exist
        if (!this.userData.bookOrder) {
            this.userData.bookOrder = {};
        }
        if (!this.userData.bookOrder[currentBookshelfId]) {
            this.userData.bookOrder[currentBookshelfId] = [];
        }

        let bookOrder = this.userData.bookOrder[currentBookshelfId];
        
        // If this is the first time ordering for this bookshelf, initialize with current filtered order
        if (bookOrder.length === 0) {
            bookOrder = this.filteredBooks.map(book => book.asin);
            this.userData.bookOrder[currentBookshelfId] = bookOrder;
        }

        // Add dragged item if not in order yet
        if (!bookOrder.includes(draggedASIN)) {
            bookOrder.push(draggedASIN);
        }

        // Remove dragged item from current position
        const draggedIndex = bookOrder.indexOf(draggedASIN);
        if (draggedIndex !== -1) {
            bookOrder.splice(draggedIndex, 1);
        }

        // Insert at new position (before target)
        const targetIndex = bookOrder.indexOf(targetASIN);
        if (targetIndex !== -1) {
            bookOrder.splice(targetIndex, 0, draggedASIN);
        } else {
            // If target not found, add to end
            bookOrder.push(draggedASIN);
        }

        // Switch to custom order automatically when manually reordering
        this.sortOrder = 'custom';
        document.getElementById('sort-order').value = 'custom';
        
        // Save and refresh display
        this.saveUserData();
        this.updateDisplay();
    }

    showBookDetailPage(book) {
        this.currentViewMode = 'book-detail';
        this.pushToHistory('book-detail', { bookAsin: book.asin });
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf book-detail-view';
        
        const userNote = this.userData.notes[book.asin] || { memo: '', rating: 0 };
        const ratingValue = this.getDisplayRatingValue(book, userNote);
        const ratingHtml = this.displayStarRating(ratingValue, book.average_rating);
        
        // Load comments from API
        this.loadBookComments(book.asin).then(comments => {
            const commentsHtml = this.renderBookComments(comments, book.asin);
            const commentsContainer = document.getElementById('book-comments-list');
            if (commentsContainer) {
                commentsContainer.innerHTML = commentsHtml;
            }
        }).catch(err => {
            console.error('Error loading comments:', err);
        });
        
        bookshelf.innerHTML = `
            <div class="book-detail-page">
                <div class="book-detail-header" style="display: flex; gap: 2rem; margin-bottom: 3rem; padding-bottom: 2rem; border-bottom: 2px solid #e8ecf1;">
                    <div style="flex-shrink: 0;">
                        ${book.productImage ?
                            `<img src="${this.bookManager.getProductImageUrl(book)}" alt="${book.title}" style="width: 200px; height: 300px; object-fit: cover; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">` :
                            `<div style="width: 200px; height: 300px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 4rem; color: #6c757d; box-shadow: 0 8px 24px rgba(0,0,0,0.15);">Book</div>`
                        }
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <h1 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 2.5rem; font-weight: 700; line-height: 1.2;">${this.escapeHtml(book.title)}</h1>
                        <div style="margin-bottom: 1.5rem;">
                            <p style="margin: 0 0 0.75rem 0; color: #34495e; font-size: 1.1rem;">
                                <strong style="color: #2c3e50; font-weight: 600;">Author:</strong> ${this.escapeHtml(book.authors || 'Unknown author')}
                            </p>
                            ${book.genre ? `
                                <p style="margin: 0 0 0.75rem 0; color: #34495e; font-size: 1.1rem;">
                                    <strong style="color: #2c3e50; font-weight: 600;">Genre:</strong> ${this.escapeHtml(book.genre)}
                                </p>
                            ` : ''}
                            ${ratingHtml ? `<div style="margin: 1rem 0;">${ratingHtml}</div>` : ''}
                            ${book.description ? `
                                <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e8ecf1;">
                                    <p style="margin: 0; color: #495057; line-height: 1.8; font-size: 1rem; white-space: pre-wrap;">${this.escapeHtml(book.description)}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e8ecf1;">
                    <h2 style="margin: 0 0 1.5rem 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600; font-family: 'Cinzel', serif;">Comments</h2>
                    
                    <div id="book-comments-list" style="margin-bottom: 1rem; min-height: 100px;">
                        <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
                            <p>Loading comments...</p>
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 2.5rem; border-radius: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15); border: 2px solid #e8ecf1; animation: slideUp 0.5s ease-out;">
                        <label style="display: block; margin-bottom: 1.25rem; color: #2c3e50; font-weight: 600; font-size: 1.1rem; font-family: 'Cinzel', serif;">
                            Add Your Comment
                        </label>
                        
                        <!-- Star Rating -->
                        <div class="star-rating-comment" data-asin="${book.asin}" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: #2c3e50; font-size: 0.9rem; font-weight: 500;">Rate this book:</span>
                            <div class="stars-container" style="display: flex; gap: 0.25rem;">
                                ${[1, 2, 3, 4, 5].map(star => `
                                    <span class="star" data-rating="${star}" data-asin="${book.asin}" 
                                          style="font-size: 1.5rem; color: #ddd; cursor: pointer; transition: color 0.2s; user-select: none;"
                                          onmouseover="this.style.color='#ffc107'; const stars = this.parentElement.querySelectorAll('.star'); const rating = parseInt(this.getAttribute('data-rating')); for(let i = 0; i < rating; i++) { stars[i].style.color = '#ffc107'; }"
                                          onmouseout="const stars = this.parentElement.querySelectorAll('.star'); const selectedRating = this.parentElement.getAttribute('data-selected-rating') || '0'; for(let i = 0; i < stars.length; i++) { stars[i].style.color = i < parseInt(selectedRating) ? '#ffc107' : '#ddd'; }"
                                          onclick="const rating = parseInt(this.getAttribute('data-rating')); this.parentElement.setAttribute('data-selected-rating', rating); const stars = this.parentElement.querySelectorAll('.star'); for(let i = 0; i < stars.length; i++) { stars[i].style.color = i < rating ? '#ffc107' : '#ddd'; }">★</span>
                                `).join('')}
                            </div>
                        </div>
                        
                        <textarea id="book-comment-input-${book.asin}" 
                                  placeholder="Share your thoughts about this book..." 
                                  style="width: 100%; min-height: 150px; padding: 1rem; border: 2px solid #e8ecf1; border-radius: 10px; font-family: inherit; font-size: 1rem; resize: vertical; transition: all 0.3s; color: #495057; line-height: 1.6; box-sizing: border-box;"
                                  onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'"
                                  onblur="this.style.borderColor='#e8ecf1'; this.style.boxShadow='none'"
                                  >${userNote && userNote.memo ? this.escapeHtml(userNote.memo) : ''}</textarea>
                        <button class="btn btn-primary save-comment-btn" 
                                data-asin="${book.asin}" 
                                style="margin-top: 1.5rem; padding: 1rem; width: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 10px; color: white; font-weight: 600; font-size: 1.1rem; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'"
                                onmousedown="this.style.transform='translateY(0)'">
                            Save Comment
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Setup event listeners
        const saveCommentBtn = bookshelf.querySelector('.save-comment-btn');
        if (saveCommentBtn) {
            saveCommentBtn.addEventListener('click', async (e) => {
                const asin = e.target.dataset.asin;
                const commentTextarea = document.getElementById(`book-comment-input-${asin}`);
                if (!commentTextarea) return;
                
                const commentText = commentTextarea.value.trim();
                if (!commentText) {
                    alert('Please enter a comment');
                    return;
                }
                
                const btn = e.target;
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Saving...';
                
                try {
                    const result = await this.saveNote(asin, commentText);
                    if (result && (result === true || result.success === true)) {
                        // Clear textarea
                        commentTextarea.value = '';
                        
                        // Use the bookId returned from saveNote to reload comments
                        // CRITICAL: Don't use ASIN - it's wrong! Use bookId directly
                        let bookIdToUse = null;
                        if (result && result.bookId) {
                            bookIdToUse = result.bookId;
                            console.log('🔄 Using bookId from saveNote to reload comments:', bookIdToUse);
                        } else {
                            // Fallback: try to get bookId from ASIN (but this might be wrong)
                            console.warn('⚠️  No bookId returned from saveNote, trying to get from ASIN...');
                            try {
                                const bookResponse = await fetch(`/api/books/${asin}`);
                                if (bookResponse.ok) {
                                    const bookData = await bookResponse.json();
                                    // Verify title matches before using
                                    if (bookData.book?.title === book.title) {
                                        bookIdToUse = bookData.book?.id;
                                        console.log('✅ Got bookId from ASIN (title verified):', bookIdToUse);
                                    } else {
                                        console.error('❌ ASIN found wrong book, cannot reload comments safely');
                                        alert('Comment saved but could not reload comments. Please refresh the page.');
                                        return;
                                    }
                                }
                            } catch (e) {
                                console.error('❌ Could not get bookId:', e);
                            }
                        }
                        
                        if (!bookIdToUse) {
                            console.error('❌ Could not determine bookId for reloading comments');
                            alert('Comment saved but could not reload comments. Please refresh the page.');
                            return;
                        }
                        
                        // Reload comments using the bookId directly (not ASIN!)
                        console.log('🔄 Reloading comments for bookId:', bookIdToUse);
                        const comments = await this.loadBookComments(bookIdToUse.toString());
                        const commentsHtml = this.renderBookComments(comments, asin); // Keep original ASIN for rendering
                        const commentsContainer = document.getElementById('book-comments-list');
                        if (commentsContainer) {
                            commentsContainer.innerHTML = commentsHtml;
                            console.log('✅ Comments UI updated');
                        } else {
                            console.warn('⚠️  Comments container not found');
                        }
                        // Re-attach delete button listeners
                        this.attachDeleteCommentListeners(asin);
                        
                        // Show success message
                        btn.textContent = 'Comment saved successfully!';
                        btn.style.backgroundColor = '#28a745';
                        setTimeout(() => {
                            btn.textContent = originalText;
                            btn.style.backgroundColor = '';
                            btn.disabled = false;
                        }, 3000);
                    } else {
                        alert('Failed to save comment. Please try again.');
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }
                } catch (error) {
                    console.error('Error saving comment:', error);
                    alert('Error saving comment. Please try again.');
                    btn.textContent = originalText;
                    btn.disabled = false;
                }
            });
        }
        
        // Attach delete button listeners after comments are loaded
        setTimeout(() => {
            this.attachDeleteCommentListeners(book.asin);
        }, 100);
    }
    
    async loadBookComments(asinOrBookId) {
        const token = localStorage.getItem('bookbar_token');
        
        try {
            let bookId = null;
            
            // Check if asinOrBookId is a numeric ID or ASIN
            const isNumeric = /^\d+$/.test(asinOrBookId);
            
            if (isNumeric) {
                // It's a book ID, use it directly
                bookId = parseInt(asinOrBookId);
                console.log('📚 Loading comments by book ID:', bookId);
            } else {
                // It's an ASIN, but ASINs are unreliable - try to find book by title+author instead
                const book = this.books.find(b => b.asin === asinOrBookId);
                if (!book) {
                    console.warn('⚠️  Book not found in local data for ASIN:', asinOrBookId);
                    return [];
                }
                
                console.log('📚 Loading comments for book:', book.title, 'by', book.author || book.authors);
                
                // Try to find book by title+author (more reliable than ASIN)
                const bookAuthor = (book.author || book.authors || '').trim();
                if (book.title && bookAuthor) {
                    const searchUrl = `/api/books/search?title=${encodeURIComponent(book.title.trim())}&author=${encodeURIComponent(bookAuthor)}`;
                    const searchResponse = await fetch(searchUrl);
                    
                    if (searchResponse.ok) {
                        const searchData = await searchResponse.json();
                        if (searchData.books && searchData.books.length > 0) {
                            const exactMatch = searchData.books.find(b => 
                                b.title === book.title && 
                                (b.author === bookAuthor || b.author === book.author || b.author === book.authors)
                            );
                            
                            if (exactMatch) {
                                bookId = exactMatch.id;
                                console.log('✅ Found book by title+author for loading comments, ID:', bookId);
                            } else {
                                const titleMatch = searchData.books.find(b => b.title === book.title);
                                if (titleMatch) {
                                    bookId = titleMatch.id;
                                    console.log('✅ Found book by title for loading comments, ID:', bookId);
                                }
                            }
                        }
                    }
                }
                
                // Fallback: try ASIN if title+author search failed
                if (!bookId) {
                    console.log('⚠️  Title+author search failed, trying ASIN as fallback...');
                    const bookResponse = await fetch(`/api/books/${asinOrBookId}`);
                    if (bookResponse.ok) {
                        const bookData = await bookResponse.json();
                        bookId = bookData.book?.id;
                        if (bookId) {
                            console.log('✅ Found book by ASIN for loading comments, ID:', bookId);
                        }
                    }
                }
            }
            
            if (!bookId) {
                console.error('❌ Could not find book ID for loading comments');
                return [];
            }
            
            // Get comments for this book
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
            
            console.log('📝 Fetching comments for book ID:', bookId);
            const commentsResponse = await fetch(`/api/books/${bookId}/comments`, {
                headers
            });
            
            if (commentsResponse.ok) {
                const data = await commentsResponse.json();
                const comments = data.comments || [];
                console.log(`✅ Loaded ${comments.length} comment(s) for book ID ${bookId}`);
                return comments;
            } else {
                console.error('❌ Failed to load comments, status:', commentsResponse.status);
            }
        } catch (error) {
            console.error('❌ Error loading comments:', error);
        }
        
        return [];
    }
    
    renderBookComments(comments, asin) {
        if (!comments || comments.length === 0) {
            return `
                <div style="padding: 1rem; text-align: center; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-radius: 15px; border: 2px dashed #e8ecf1;">
                    <p style="margin: 0; color: #7f8c8d; font-style: italic; font-size: 0.875rem;">No comments yet. Be the first to share your thoughts!</p>
                </div>
            `;
        }
        
        return comments.map(comment => {
            const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            const isOwnComment = comment.user_id === userData.id;
            
            const rating = comment.rating || null;
            const ratingStars = rating ? Array.from({ length: 5 }, (_, i) => 
                i < rating ? '★' : '☆'
            ).join('') : '';
            
            return `
                <div class="comment-item" style="padding: 1.5rem; background: white; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-bottom: 1.25rem; border-left: 4px solid #667eea; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.08)'">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <div>
                            <strong style="color: #2c3e50; font-size: 1rem; font-weight: 600;">${this.escapeHtml(comment.username || comment.name || 'User')}</strong>
                            <span style="color: #7f8c8d; font-size: 0.875rem; margin-left: 0.5rem;">${this.formatDate(comment.createdAt || comment.created_at)}</span>
                            ${rating ? `<div style="margin-top: 0.25rem; color: #ffc107; font-size: 1rem; letter-spacing: 0.1rem;">${ratingStars}</div>` : ''}
                        </div>
                        ${isOwnComment ? `
                            <button class="delete-comment-btn" data-comment-id="${comment.id}" data-asin="${asin}" style="background: #fee; border: 1px solid #e74c3c; color: #e74c3c; cursor: pointer; font-size: 0.875rem; padding: 0.375rem 0.75rem; border-radius: 8px; transition: all 0.2s; font-weight: 500;" onmouseover="this.style.background='#e74c3c'; this.style.color='white'" onmouseout="this.style.background='#fee'; this.style.color='#e74c3c'">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                    <p style="margin: 0; color: #495057; line-height: 1.7; font-size: 0.95rem; white-space: pre-wrap;">${this.escapeHtml(comment.comment)}</p>
                </div>
            `;
        }).join('');
    }
    
    attachDeleteCommentListeners(asin) {
        const deleteButtons = document.querySelectorAll('.delete-comment-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const commentId = e.target.dataset.commentId;
                const bookAsin = e.target.dataset.asin;
                
                await this.deleteComment(commentId);
                
                // Reload comments
                this.loadBookComments(bookAsin).then(comments => {
                    const commentsHtml = this.renderBookComments(comments, bookAsin);
                    const commentsContainer = document.getElementById('book-comments-list');
                    if (commentsContainer) {
                        commentsContainer.innerHTML = commentsHtml;
                    }
                    // Re-attach listeners
                    this.attachDeleteCommentListeners(bookAsin);
                });
            });
        });
    }

    showBookDetail(book, isEditMode = false) {
        const modal = document.getElementById('book-modal');
        const modalBody = document.getElementById('modal-body');

        const isHidden = this.userData.hiddenBooks && this.userData.hiddenBooks.includes(book.asin);
        const userNote = this.userData.notes[book.asin] || { memo: '', rating: 0 };
        const amazonUrl = this.bookManager.getAmazonUrl(book, this.userData.settings.affiliateId);
        const ratingValue = this.getDisplayRatingValue(book, userNote);
        const ratingHtml = this.displayStarRating(ratingValue, book.average_rating);

        modalBody.innerHTML = `
            <div class="book-detail">
                <div class="book-detail-header">
                    ${book.productImage ?
                        `<img class="book-detail-cover" src="${this.bookManager.getProductImageUrl(book)}" alt="${book.title}">` :
                        '<div class="book-detail-cover-placeholder">📖</div>'
                    }
                    <div class="book-detail-info">
                        <div class="book-info-section" ${isEditMode ? 'style="display: none;"' : ''}>
                            <h2 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 1.5rem; font-weight: 600;">${book.title}</h2>
                            
                            <div style="margin-bottom: 1rem;">
                                <p style="margin: 0 0 0.5rem 0; color: #34495e; font-size: 1rem;">
                                    <strong style="color: #2c3e50;">Author:</strong> ${book.authors || 'Unknown author'}
                                </p>
                                ${book.genre ? `
                                    <p style="margin: 0 0 0.5rem 0; color: #34495e; font-size: 1rem;">
                                        <strong style="color: #2c3e50;">Genre:</strong> ${book.genre}
                                    </p>
                                ` : ''}
                                ${ratingHtml ? `<div style="margin: 0.75rem 0;">${ratingHtml}</div>` : ''}
                            </div>
                            
                            ${book.description ? `
                                <div style="margin: 1.5rem 0; padding: 1rem; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 8px; border-left: 4px solid #3498db;">
                                    <h3 style="margin: 0 0 0.75rem 0; color: #2c3e50; font-size: 1rem; font-weight: 600;">📖 Description</h3>
                                    <p style="margin: 0; color: #495057; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap;">${this.escapeHtml(book.description)}</p>
                                </div>
                            ` : ''}
                            
                            <div class="book-comment-section" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 2px solid #e8ecf1;">
                                <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                                    <span style="font-size: 1.5rem; margin-right: 0.5rem;">💬</span>
                                    <h3 style="margin: 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">Your Comments</h3>
                                </div>
                                
                                <div class="book-comments" style="margin-bottom: 1.5rem; min-height: 60px;">
                                    ${userNote && userNote.memo ? `
                                        <div class="comment-item" style="padding: 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 1rem;">
                                            <div style="display: flex; align-items: start;">
                                                <span style="font-size: 1.2rem; margin-right: 0.75rem; margin-top: 0.2rem;">✨</span>
                                                <p style="margin: 0; color: #ffffff; line-height: 1.6; font-size: 0.95rem; white-space: pre-wrap; flex: 1;">${this.formatMemoForDisplay(userNote.memo, 1000)}</p>
                                            </div>
                                        </div>
                                    ` : `
                                        <div style="padding: 1.5rem; text-align: center; background: #f8f9fa; border-radius: 8px; border: 2px dashed #dee2e6;">
                                            <span style="font-size: 2rem; display: block; margin-bottom: 0.5rem;">📝</span>
                                            <p style="margin: 0; color: #6c757d; font-style: italic; font-size: 0.9rem;">No comments yet. Share your thoughts about this book!</p>
                                        </div>
                                    `}
                                </div>
                                
                                <div class="add-comment-section" style="background: #ffffff; padding: 1.25rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border: 1px solid #e8ecf1;">
                                    <label style="display: block; margin-bottom: 0.75rem; color: #2c3e50; font-weight: 500; font-size: 0.95rem;">
                                        Add your comment:
                                    </label>
                                    
                                    <!-- Star Rating -->
                                    <div class="star-rating-comment" data-asin="${book.asin}" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                        <span style="color: #2c3e50; font-size: 0.9rem; font-weight: 500;">Rate this book:</span>
                                        <div class="stars-container" style="display: flex; gap: 0.25rem;">
                                            ${[1, 2, 3, 4, 5].map(star => `
                                                <span class="star" data-rating="${star}" data-asin="${book.asin}" 
                                                      style="font-size: 1.5rem; color: #ddd; cursor: pointer; transition: color 0.2s; user-select: none;"
                                                      onmouseover="this.style.color='#ffc107'; const stars = this.parentElement.querySelectorAll('.star'); const rating = parseInt(this.getAttribute('data-rating')); for(let i = 0; i < rating; i++) { stars[i].style.color = '#ffc107'; }"
                                                      onmouseout="const stars = this.parentElement.querySelectorAll('.star'); const selectedRating = this.parentElement.getAttribute('data-selected-rating') || '0'; for(let i = 0; i < stars.length; i++) { stars[i].style.color = i < parseInt(selectedRating) ? '#ffc107' : '#ddd'; }"
                                                      onclick="const rating = parseInt(this.getAttribute('data-rating')); this.parentElement.setAttribute('data-selected-rating', rating); const stars = this.parentElement.querySelectorAll('.star'); for(let i = 0; i < stars.length; i++) { stars[i].style.color = i < rating ? '#ffc107' : '#ddd'; }">★</span>
                                            `).join('')}
                                        </div>
                                    </div>
                                    
                                    <textarea id="book-comment-input-${book.asin}" 
                                              placeholder="What did you think about this book? Share your thoughts, favorite quotes, or recommendations..." 
                                              style="width: 100%; min-height: 120px; padding: 1rem; border: 2px solid #e8ecf1; border-radius: 8px; font-family: inherit; font-size: 0.95rem; resize: vertical; transition: border-color 0.3s; color: #495057; line-height: 1.6;"
                                              onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'"
                                              onblur="this.style.borderColor='#e8ecf1'; this.style.boxShadow='none'"
                                              >${userNote && userNote.memo ? this.escapeHtml(userNote.memo) : ''}</textarea>
                                    <button class="btn btn-primary save-comment-btn" 
                                            data-asin="${book.asin}" 
                                            style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.95rem; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);"
                                            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 12px rgba(102, 126, 234, 0.4)'"
                                            onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(102, 126, 234, 0.3)'">
                                        💾 Save Comment
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="book-edit-section" ${!isEditMode ? 'style="display: none;"' : ''}>
                            <div class="edit-field">
                                <label>📖 Title</label>
                                <input type="text" class="edit-title" data-asin="${book.asin}" value="${book.title}" />
                            </div>
                            <div class="edit-field">
                                <label>✍️ Author</label>
                                <input type="text" class="edit-authors" data-asin="${book.asin}" value="${book.authors}" />
                            </div>
                            <div class="edit-field">
                                <label>📅 Acquired Date</label>
                                <input type="date" class="edit-acquired-time" data-asin="${book.asin}" value="${new Date(book.acquiredTime).toISOString().split('T')[0]}" />
                            </div>
                            <div class="edit-field">
                                <label>🔖 Original ASIN</label>
                                <input type="text" class="edit-original-asin" data-asin="${book.asin}" value="${book.asin}" maxlength="10" pattern="[A-Z0-9]{10}" />
                                <small class="field-help">Original product identifier (usually unchanged)</small>
                            </div>
                            <div class="edit-field">
                                <label>🔗 Updated ASIN (optional)</label>
                                <input type="text" class="edit-updated-asin" data-asin="${book.asin}" value="${book.updatedAsin || ''}" placeholder="Only if a new ASIN exists" maxlength="10" pattern="[A-Z0-9]{10}" />
                                <small class="field-help">Enter the new ASIN if Amazon has changed it.</small>
                            </div>
                            <div class="edit-actions" style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                                <button class="btn btn-small save-book-changes" data-asin="${book.asin}">💾 Save</button>
                                <button class="btn btn-small btn-secondary cancel-edit-btn" data-asin="${book.asin}">❌ Cancel</button>
                            </div>
                        </div>

                        
                        <div class="book-actions">
                            ${amazonUrl ? `<a class="amazon-link" href="${amazonUrl}" target="_blank" rel="noopener">📚 View on Amazon</a>` : ''}
                            <button class="btn btn-danger delete-btn" data-asin="${book.asin}" style="${isEditMode ? '' : 'display: none;'}">
                                🗑️ Delete Book
                            </button>
                        </div>
                        
                        <div class="bookshelf-actions" style="margin-top: 1rem; ${isEditMode ? '' : 'display: none;'}">
                            <div style="margin-bottom: 1rem;">
                                <label for="bookshelf-select-${book.asin}">📚 Add to shelf:</label>
                                <select id="bookshelf-select-${book.asin}" class="bookshelf-select">
                                    <option value="">Select a shelf...</option>
                                    ${this.userData.bookshelves ? this.userData.bookshelves.map(bs => 
                                        `<option value="${bs.id}">${bs.emoji || '📚'} ${bs.name}</option>`
                                    ).join('') : ''}
                                </select>
                                <button class="btn btn-secondary add-to-bookshelf" data-asin="${book.asin}">Add</button>
                            </div>
                            
                            <div class="current-bookshelves">
                                <label>📚 Shelves containing this book:</label>
                                <div id="current-bookshelves-${book.asin}">
                                    ${this.userData.bookshelves ? this.userData.bookshelves
                                        .filter(bs => bs.books && bs.books.includes(book.asin))
                                        .map(bs => `
                                            <div class="bookshelf-item" style="display: inline-flex; align-items: center; margin: 0.25rem; padding: 0.25rem 0.5rem; background-color: #f0f0f0; border-radius: 4px;">
                                                <span>${bs.emoji || '📚'} ${bs.name}</span>
                                                <button class="btn btn-small btn-danger remove-from-bookshelf" 
                                                        data-asin="${book.asin}" 
                                                        data-bookshelf-id="${bs.id}" 
                                                        style="margin-left: 0.5rem; padding: 0.125rem 0.25rem; font-size: 0.75rem;">
                                                    ❌
                                                </button>
                                            </div>
                                        `).join('') : ''}
                                </div>
                                ${this.userData.bookshelves && this.userData.bookshelves.filter(bs => bs.books && bs.books.includes(book.asin)).length === 0 ? 
                                    '<p style="color: #888; font-style: italic; margin: 0.5rem 0;">This book is not part of any shelf yet.</p>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="book-notes-section" style="${!isEditMode && !userNote.memo ? 'display: none;' : ''}">
                    <h3>📝 Personal Notes</h3>
                    ${!isEditMode && userNote.memo ? `
                        <div class="note-display" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border-left: 4px solid #007bff;">${this.convertMarkdownLinksToHtml(userNote.memo)}</div>
                    ` : ''}
                    <textarea class="note-textarea large-textarea" data-asin="${book.asin}" rows="6" placeholder="Write your thoughts or highlights about this book..." style="${isEditMode ? '' : 'display: none;'}">${userNote.memo || ''}</textarea>
                    <div class="note-preview" style="${isEditMode ? (userNote.memo ? 'display: block;' : 'display: none;') : 'display: none;'}">
                        <h4>📄 Preview</h4>
                        <div class="note-preview-content">${isEditMode && userNote.memo ? this.convertMarkdownLinksToHtml(userNote.memo) : ''}</div>
                    </div>
                    <p class="note-help" style="${isEditMode ? '' : 'display: none;'}">💡 Notes are saved automatically. Line breaks are preserved.</p>

                    <div class="rating-section" style="${isEditMode ? '' : 'display: none;'}">
                        <h4>⭐ Star Rating</h4>
                        <div class="star-rating" data-asin="${book.asin}" data-current-rating="${userNote.rating || 0}">
                            ${this.generateStarRating(userNote.rating || 0)}
                        </div>
                        <button class="btn btn-small rating-reset" data-asin="${book.asin}">Reset Rating</button>
                    </div>
                </div>
                
            </div>
        `;
        
        // Setup modal event listeners
        // Save comment button
        const saveCommentBtn = modalBody.querySelector('.save-comment-btn');
        if (saveCommentBtn) {
            saveCommentBtn.addEventListener('click', (e) => {
                const asin = e.target.dataset.asin;
                const commentTextarea = document.getElementById(`book-comment-input-${asin}`);
                if (commentTextarea) {
                    this.saveNote(asin, commentTextarea.value);
                    // Show success message
                    const btn = e.target;
                    const originalText = btn.textContent;
                    btn.textContent = '✅ Saved!';
                    btn.style.backgroundColor = '#28a745';
                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.style.backgroundColor = '';
                    }, 2000);
                }
            });
        }
        
        const noteTextarea = modalBody.querySelector('.note-textarea');
        if (noteTextarea) {
            noteTextarea.addEventListener('blur', (e) => {
                this.saveNote(e.target.dataset.asin, e.target.value);
            });
        }

        // Real-time preview while editing
        if (isEditMode && noteTextarea) {
            noteTextarea.addEventListener('input', (e) => {
                this.updateMemoPreview(e.target);
            });
        }
        
        const addToBookshelfBtn = modalBody.querySelector('.add-to-bookshelf');
        if (addToBookshelfBtn) {
            addToBookshelfBtn.addEventListener('click', (e) => {
                this.addBookToBookshelf(e.target.dataset.asin);
            });
        }
        
        // Remove from bookshelf buttons
        modalBody.querySelectorAll('.remove-from-bookshelf').forEach(button => {
            button.addEventListener('click', (e) => {
                const asin = e.target.dataset.asin;
                const bookshelfId = e.target.dataset.bookshelfId;
                this.removeFromBookshelf(asin, bookshelfId);
            });
        });
        
        // Rating reset button
        const ratingResetBtn = modalBody.querySelector('.rating-reset');
        if (ratingResetBtn) {
            ratingResetBtn.addEventListener('click', (e) => {
                const asin = e.target.dataset.asin;
                console.log(`🔄 Reset rating: ASIN: ${asin}`);
                this.saveRating(asin, 0);

                // Update star display in modal
                const starRating = modalBody.querySelector('.star-rating');
                starRating.dataset.currentRating = 0;
                const stars = starRating.querySelectorAll('.star');
                stars.forEach(star => {
                    star.classList.remove('active');
                });

                // Update display in main bookshelf
                this.updateDisplay();
                this.updateStats();
            });
        }

        const deleteBtn = modalBody.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                this.deleteBook(e.target.dataset.asin);
            });
        }
        
        // Add book edit functionality
        const saveChangesBtn = modalBody.querySelector('.save-book-changes');
        if (saveChangesBtn) {
            saveChangesBtn.addEventListener('click', (e) => {
                this.saveBookChanges(e.target.dataset.asin);
            });
        }
        
        
        // Add star rating functionality
        const starRating = modalBody.querySelector('.star-rating');
        if (starRating) {
            // Initialize star display based on current rating
            const currentRating = parseInt(starRating.dataset.currentRating) || 0;
            const stars = starRating.querySelectorAll('.star');
            stars.forEach((star, index) => {
                if (index + 1 <= currentRating) {
                    star.classList.add('active');
                    star.style.color = '#ffa500';
                } else {
                    star.classList.remove('active');
                    star.style.color = '#ddd';
                }
            });
            
            // Add hover effects for better UX
            starRating.addEventListener('mouseover', (e) => {
                if (e.target.classList.contains('star')) {
                    const hoverRating = parseInt(e.target.dataset.rating);
                    const stars = starRating.querySelectorAll('.star');
                    stars.forEach((star, index) => {
                        if (index + 1 <= hoverRating) {
                            star.style.color = '#ffa500';
                        } else {
                            star.style.color = '#ddd';
                        }
                    });
                }
            });
            
            starRating.addEventListener('mouseleave', () => {
                const currentRating = parseInt(starRating.dataset.currentRating) || 0;
                const stars = starRating.querySelectorAll('.star');
                stars.forEach((star, index) => {
                    if (index + 1 <= currentRating) {
                        star.style.color = '#ffa500';
                    } else {
                        star.style.color = '#ddd';
                    }
                });
            });
            
            starRating.addEventListener('click', (e) => {
                if (e.target.classList.contains('star')) {
                    const rating = parseInt(e.target.dataset.rating);
                    const asin = starRating.dataset.asin;
                    console.log(`⭐ Updated rating: ${rating} stars, ASIN: ${asin}`);
                    this.saveRating(asin, rating);
                    
                    // Update current rating data
                    starRating.dataset.currentRating = rating;
                    
                    // Update star display in modal
                    const stars = starRating.querySelectorAll('.star');
                    stars.forEach((star, index) => {
                        star.classList.toggle('active', (index + 1) <= rating);
                    });
                    
                    // Update display in main bookshelf
                    this.updateDisplay();
                    this.updateStats();
                }
            });
        }
        
        // Load highlights
        this.loadBookHighlights(book);
        
        modal.classList.add('show');
    }

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
        }
    }

    closeModal(modalId = 'book-modal') {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            
            // Clear form if it's a login/signup modal
            if (modalId === 'login-modal') {
                const form = document.getElementById('login-form');
                if (form) form.reset();
            } else if (modalId === 'signup-modal') {
                const form = document.getElementById('signup-form');
                if (form) form.reset();
            }
            
            // Clear modal body for book modal
            if (modalId === 'book-modal') {
                const modalBody = document.getElementById('modal-body');
                if (modalBody) modalBody.innerHTML = '';
            }
        }
    }

    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            alert('Please fill in all fields.');
            return;
        }

        try {
            const result = await userManager.login(email, password);
            if (result.success) {
                this.closeModal('login-modal');
                alert('Login successful! Welcome, ' + result.user.name);
                // Reload books after login
                await this.loadData();
                this.updateDisplay();
            } else {
                alert(result.message || 'Login failed. Please check your information.');
            }
        } catch (error) {
            alert('An error occurred during login: ' + error.message);
        }
    }

    async handleSignup() {
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const bio = document.getElementById('signup-bio').value;
        
        if (!name || !email || !password) {
            alert('Please fill in all required fields.');
            return;
        }

        try {
            const result = await userManager.register(name, email, password, bio);
            if (result.success) {
                this.closeModal('signup-modal');
                alert('Registration successful! Welcome, ' + result.user.name);
                // Reload books after signup
                await this.loadData();
                this.updateDisplay();
            } else {
                alert(result.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            alert('An error occurred during registration: ' + error.message);
        }
    }

    async handleJsonImport() {
        const jsonInput = document.getElementById('json-input');
        const resultsDiv = document.getElementById('json-import-results');
        
        if (!jsonInput || !jsonInput.value.trim()) {
            alert('Please paste JSON data or upload a JSON file.');
            return;
        }

        try {
            let books = JSON.parse(jsonInput.value);
            
            if (!Array.isArray(books)) {
                alert('JSON must be an array of book objects.');
                return;
            }

            if (books.length === 0) {
                alert('JSON array is empty.');
                return;
            }

            // Normalize book data - support both cover_image and cover_image_url
            books = books.map(book => ({
                title: book.title,
                author: book.author,
                description: book.description,
                genre: book.genre,
                cover_image: book.cover_image || book.cover_image_url,
                asin: book.asin,
                average_rating: book.average_rating // Will be handled by server
            }));

            // Show loading
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<p>Importing books... Please wait.</p>';
            }

            const token = localStorage.getItem('bookbar_token');
            if (!token) {
                alert('Please log in to import books.');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/books/import`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ books })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Import failed');
            }

            // Show results
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <h3 style="color: #28a745; margin-bottom: 1rem;">✅ Import Complete!</h3>
                    <p><strong>Successfully imported:</strong> ${data.success} books</p>
                    <p><strong>Failed:</strong> ${data.failed} books</p>
                    ${data.errors.length > 0 ? `
                        <details style="margin-top: 1rem;">
                            <summary style="cursor: pointer; color: #dc3545;">View Errors (${data.errors.length})</summary>
                            <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                                ${data.errors.map(err => `<li>${err.title || 'Book ' + err.index}: ${err.error}</li>`).join('')}
                            </ul>
                        </details>
                    ` : ''}
                `;
            }

            // Reload books
            await this.loadData();
            this.updateDisplay();
            this.updateStats();

            // Clear input after 3 seconds
            setTimeout(() => {
                if (jsonInput) jsonInput.value = '';
                if (resultsDiv) resultsDiv.style.display = 'none';
            }, 3000);

        } catch (error) {
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = `<p style="color: #dc3545;">❌ Error: ${error.message}</p>`;
            } else {
                alert('Import failed: ' + error.message);
            }
        }
    }




    async saveNote(asin, memo) {
        // Save to localStorage (for backward compatibility) - but don't trigger page refresh
        if (!this.userData.notes[asin]) {
            this.userData.notes[asin] = { memo: '', rating: 0 };
        }
        this.userData.notes[asin].memo = memo;
        // Don't call saveUserData() here to avoid triggering any page refresh
        
        // Also save to database if user is logged in
        const token = localStorage.getItem('bookbar_token');
        if (!token) {
            console.error('❌ User not logged in - cannot save comment to database');
            alert('Please log in to save comments');
            return false;
        }
        
        if (!memo || !memo.trim()) {
            console.error('❌ Empty comment');
            return false;
        }
        
        try {
            console.log('💾 Attempting to save comment for ASIN:', asin);
            
            // Find book by ASIN or create it
            const book = this.books.find(b => b.asin === asin);
            if (!book) {
                console.error('❌ Book not found for ASIN:', asin);
                alert('Book not found. Please refresh the page.');
                return false;
            }
            
            console.log('📚 Found book:', book.title);
            
            // ALWAYS search by title+author first - JSON ASINs are wrong!
            // JSON file has wrong IDs (e.g., "King Sorrow" is ID 2 in JSON but ID 9 in database)
            // So we MUST ignore ASIN and always use title+author search
            let bookId = null;
            let foundByTitleAuthor = false;
            console.log('🔍 Searching for book in database (ignoring ASIN - JSON IDs are wrong)...');
            console.log('📖 Book from local data:', { title: book.title, author: book.author || book.authors, asin: book.asin, note: 'ASIN will be ignored' });
            
            // Step 1: Search by title+author (ONLY reliable method)
            const bookAuthor = (book.author || book.authors || '').trim();
            if (book.title && bookAuthor) {
                console.log('🔍 Step 1: Searching by title+author (ONLY reliable method - JSON ASINs are wrong)...');
                const searchUrl = `/api/books/search?title=${encodeURIComponent(book.title.trim())}&author=${encodeURIComponent(bookAuthor)}`;
                console.log('   Search URL:', searchUrl);
                
                const searchResponse = await fetch(searchUrl);
                console.log('   Search response status:', searchResponse.status, searchResponse.statusText);
                
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    console.log(`   Found ${searchData.books?.length || 0} book(s) in search results`);
                    
                    if (searchData.books && searchData.books.length > 0) {
                        // Try to find exact match first (title AND author)
                        const exactMatch = searchData.books.find(b => {
                            const titleMatch = b.title === book.title;
                            const authorMatch = b.author === bookAuthor || b.author === book.author || b.author === book.authors;
                            return titleMatch && authorMatch;
                        });
                        
                        if (exactMatch) {
                            bookId = exactMatch.id;
                            foundByTitleAuthor = true;
                            console.log('✅ Found book by title+author (exact match):');
                            console.log('   - ID:', exactMatch.id);
                            console.log('   - Title:', exactMatch.title);
                            console.log('   - Author:', exactMatch.author);
                            console.log('   - ASIN:', exactMatch.asin);
                        } else {
                            // Try title match only (author might be slightly different)
                            const titleMatch = searchData.books.find(b => b.title === book.title);
                            if (titleMatch) {
                                bookId = titleMatch.id;
                                foundByTitleAuthor = true;
                                console.log('✅ Found book by title match (author might differ):');
                                console.log('   - ID:', titleMatch.id);
                                console.log('   - Title:', titleMatch.title);
                                console.log('   - Author:', titleMatch.author, '(expected:', bookAuthor, ')');
                            } else {
                                console.log('⚠️  No exact title match found in search results');
                            }
                        }
                    } else {
                        console.log('⚠️  No books found in title+author search');
                    }
                } else {
                    const errorText = await searchResponse.text().catch(() => 'Unknown error');
                    console.error('❌ Title+author search failed!');
                    console.error('   Status:', searchResponse.status, searchResponse.statusText);
                    console.error('   Response:', errorText);
                    console.error('   Search URL was:', searchUrl);
                    
                    // If search endpoint doesn't exist (404), this is a critical error
                    if (searchResponse.status === 404) {
                        console.error('❌ CRITICAL: Search endpoint not found (404)!');
                        console.error('   The /api/books/search endpoint might not be registered in server.js');
                        console.error('   Please check server.js and restart the server');
                    }
                }
            } else {
                console.warn('⚠️  Cannot search by title+author - missing title or author');
                console.warn('   Title:', book.title);
                console.warn('   Author:', bookAuthor);
            }
            
            // Step 2: If title+author failed, try title-only search
            if (!bookId && book.title) {
                console.log('🔍 Step 2: Title+author search failed, trying title-only search...');
                const searchUrl = `/api/books/search?title=${encodeURIComponent(book.title.trim())}`;
                const searchResponse = await fetch(searchUrl);
                
                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    if (searchData.books && searchData.books.length > 0) {
                        const titleMatch = searchData.books.find(b => b.title === book.title);
                        if (titleMatch) {
                            bookId = titleMatch.id;
                            foundByTitleAuthor = true;
                            console.log('✅ Found book by title-only search:');
                            console.log('   - ID:', titleMatch.id);
                            console.log('   - Title:', titleMatch.title);
                            console.log('   - Author:', titleMatch.author);
                        }
                    }
                }
            }
            
            // Step 3: ASIN is NOT used as fallback because JSON IDs are wrong!
            // We only use ASIN if title+author search completely fails AND we need to create a new book
            
            // If still not found, create new book
            if (!bookId) {
                console.log('⚠️  Book not found in database, creating new book...');
                // Book doesn't exist in database, create it
                const createResponse = await fetch('/api/books', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        asin: asin,
                        title: book.title || 'Unknown Book',
                        author: book.authors || book.author || null,
                        description: book.description || null,
                        genre: book.genre || null,
                        cover_image: book.productImage || book.cover_image_url || null
                    })
                });
                
                if (createResponse.ok) {
                    const createData = await createResponse.json();
                    bookId = createData.book?.id;
                    console.log('✅ Book created in database, ID:', bookId);
                } else {
                    const errorData = await createResponse.json().catch(() => ({}));
                    console.error('❌ Failed to create book in database:', errorData);
                    
                    // If ASIN already exists, try to find the existing book by ASIN
                    if (errorData.error && errorData.error.includes('ASIN already exists')) {
                        console.log('⚠️  ASIN already exists, trying to find existing book by ASIN...');
                        const existingBookResponse = await fetch(`/api/books/${asin}`);
                        
                        if (existingBookResponse.ok) {
                            const existingBookData = await existingBookResponse.json();
                            const existingBook = existingBookData.book;
                            
                            console.log('✅ Found existing book by ASIN:');
                            console.log('   - ID:', existingBook.id);
                            console.log('   - Title:', existingBook.title);
                            console.log('   - Author:', existingBook.author);
                            
                            // Check if title matches - if not, search by title+author again
                            if (existingBook.title === book.title) {
                                bookId = existingBook.id;
                                console.log('✅ Using existing book (title matches)');
                            } else {
                                console.log('⚠️  Existing book title doesn\'t match, searching by title+author...');
                                // Try title+author search one more time
                                const bookAuthor = book.author || book.authors || '';
                                const searchUrl = `/api/books/search?title=${encodeURIComponent(book.title)}${bookAuthor ? `&author=${encodeURIComponent(bookAuthor)}` : ''}`;
                                const searchResponse = await fetch(searchUrl);
                                
                                if (searchResponse.ok) {
                                    const searchData = await searchResponse.json();
                                    if (searchData.books && searchData.books.length > 0) {
                                        const exactMatch = searchData.books.find(b => 
                                            b.title === book.title && 
                                            (bookAuthor ? (b.author === bookAuthor || b.author === book.author || b.author === book.authors) : true)
                                        );
                                        
                                        if (exactMatch) {
                                            bookId = exactMatch.id;
                                            foundByTitleAuthor = true; // Mark that we found it by title+author
                                            console.log('✅ Found correct book by title+author:', bookId);
                                        } else {
                                            // Use the first result if no exact match
                                            bookId = searchData.books[0].id;
                                            foundByTitleAuthor = true; // Mark that we found it by title+author
                                            console.log('⚠️  Using first result from search:', bookId);
                                        }
                                    }
                                }
                                
                                // If still no bookId, use the existing book anyway (better than failing)
                                if (!bookId) {
                                    console.log('⚠️  Could not find by title+author, using existing book by ASIN');
                                    bookId = existingBook.id;
                                }
                            }
                        } else {
                            console.error('❌ Could not find existing book by ASIN either');
                            alert(`Error: Book with ASIN "${asin}" already exists but could not be retrieved.\n\nPlease refresh the page and try again.`);
                            return false;
                        }
                    } else {
                        // Other error
                        alert(`Failed to create book: ${errorData.error || 'Unknown error'}`);
                        return false;
                    }
                }
            }
            
            if (!bookId) {
                console.error('❌ Book ID not found after search/create');
                alert('Failed to get book ID. Please try again.');
                return false;
            }
            
            // CRITICAL: We MUST find the book by title+author, ASIN is unreliable!
            // If we didn't find it by title+author, we CANNOT proceed - it will save to wrong book
            if (!foundByTitleAuthor) {
                console.error('❌ CRITICAL ERROR: Could not find book by title+author search!');
                console.error('   This means the book might not exist in database or search failed.');
                console.error('   Cannot proceed - would save comment to wrong book if we use ASIN.');
                console.error('   Book details:', { title: book.title, author: book.author || book.authors, asin: book.asin });
                
                alert(`Error: Could not find the book "${book.title}" by ${book.author || book.authors} in the database.\n\nThis might be because:\n1. The book doesn't exist in the database yet\n2. The search service is not working\n\nPlease refresh the page and try again. If the problem persists, contact support.`);
                return false;
            }
            
            // Double-check: Verify the book ID one more time
            console.log('🔍 Final verification before saving comment...');
            const verifyResponse = await fetch(`/api/books/${bookId}`);
            if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                const dbBook = verifyData.book;
                console.log('   - Expected:', book.title, 'by', book.author || book.authors);
                console.log('   - Database:', dbBook?.title, 'by', dbBook?.author);
                
                if (dbBook?.title !== book.title) {
                    console.error('❌ CRITICAL: Final verification failed - title mismatch!');
                    console.error('   This should not happen if title+author search worked correctly.');
                    alert(`Error: Book verification failed. Expected "${book.title}" but found "${dbBook?.title}".\n\nPlease refresh the page and try again.`);
                    return false;
                }
                console.log('✅ Final verification passed - book title matches');
            } else {
                console.warn('⚠️  Could not verify book, but proceeding since we found it by title+author...');
            }
            
            // Get rating from star rating component
            const starRatingContainer = document.querySelector(`.star-rating-comment[data-asin="${asin}"] .stars-container`);
            let rating = null;
            if (starRatingContainer) {
                const selectedRating = starRatingContainer.getAttribute('data-selected-rating');
                if (selectedRating && selectedRating !== '0') {
                    rating = parseInt(selectedRating);
                }
            }
            
            // Save comment to database
            console.log('💬 Saving comment to database for book ID:', bookId, '("' + book.title + '")', rating ? `with rating: ${rating}` : 'without rating');
            const commentResponse = await fetch('/api/comments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    book_id: bookId,
                    comment: memo.trim(),
                    rating: rating
                })
            });
            
            if (commentResponse.ok) {
                const commentData = await commentResponse.json();
                console.log('✅ Comment saved successfully:', commentData);
                console.log('   - Comment ID:', commentData.comment?.id);
                console.log('   - Book ID:', commentData.comment?.book_id);
                console.log('   - Book Title:', commentData.comment?.book_title);
                
                // Save to localStorage after successful database save
                this.saveUserData();
                
                // IMPORTANT: Return the book ASIN from database, not the frontend ASIN
                // The frontend ASIN might be wrong, but we need to reload comments using the correct book
                // We'll use the bookId to find the correct ASIN, or just reload by bookId
                console.log('🔄 Comment saved, UI will be refreshed by the caller...');
                
                return {
                    success: true,
                    bookId: bookId,
                    commentId: commentData.comment?.id,
                    bookTitle: commentData.comment?.book_title || book.title
                };
            } else {
                const errorText = await commentResponse.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText || 'Unknown error' };
                }
                
                console.error('❌ Failed to save comment:');
                console.error('   - Response status:', commentResponse.status);
                console.error('   - Response status text:', commentResponse.statusText);
                console.error('   - Error data:', errorData);
                console.error('   - Book ID used:', bookId);
                console.error('   - Book title:', book.title);
                
                const errorMessage = errorData.error || errorData.details || errorData.message || 'Unknown error';
                alert(`Failed to save comment:\n\n${errorMessage}\n\nStatus: ${commentResponse.status}\n\nPlease check the console for more details.`);
                return false;
            }
        } catch (error) {
            console.error('❌ Exception while saving comment to database:');
            console.error('   - Error message:', error.message);
            console.error('   - Error stack:', error.stack);
            console.error('   - ASIN:', asin);
            console.error('   - Book title:', book?.title);
            console.error('   - Book ID found:', bookId);
            
            alert(`Error saving comment:\n\n${error.message}\n\nPlease check the console (F12) for more details.`);
            return false;
        }
    }


    async loadBookHighlights(book) {
        const highlightsContainer = document.getElementById(`highlights-${book.asin}`);
        const loadingElement = highlightsContainer.querySelector('.highlights-loading');
        
        try {
            // Use HighlightsManager for ASIN-based loading
            if (window.highlightsManager) {
                const highlights = await window.highlightsManager.loadHighlightsForBook(book);
                
                loadingElement.style.display = 'none';
                
                if (highlights.length > 0) {
                    // Use the HighlightsManager's render method
                    const highlightsListContainer = document.createElement('div');
                    window.highlightsManager.renderHighlights(highlights, highlightsListContainer);
                    
                    // Replace loading with rendered highlights
                    highlightsContainer.innerHTML = '<h3>🎯 Highlights</h3>';
                    highlightsContainer.appendChild(highlightsListContainer);
                } else {
                    // No highlights found
                    highlightsContainer.innerHTML = '<h3>🎯 Highlights</h3><p class="no-highlights">No highlights available for this book.</p>';
                }
            } else {
                // Fallback if HighlightsManager not available
                loadingElement.textContent = 'Highlights are not available.';
            }
        } catch (error) {
            console.error('Highlight load error:', error);
            loadingElement.textContent = 'Failed to load highlights.';
        }
    }


    updateStats() {
        const totalBooks = this.books.length;
        
        const totalBooksElement = document.getElementById('total-books');
        if (totalBooksElement) {
            totalBooksElement.textContent = totalBooks.toLocaleString();
        }
    }



    setupPagination() {
        const pagination = document.getElementById('pagination');
        const totalPages = Math.ceil(this.filteredBooks.length / this.booksPerPage);
        
        // Hide pagination if showing all books or only one page
        if (totalPages <= 1 || this.booksPerPage >= this.filteredBooks.length) {
            pagination.innerHTML = '';
            return;
        }
        
        let paginationHTML = `
            <button ${this.currentPage === 1 ? 'disabled' : ''} onclick="bookshelf.goToPage(${this.currentPage - 1})">Previous</button>
        `;
        
        for (let i = Math.max(1, this.currentPage - 2); i <= Math.min(totalPages, this.currentPage + 2); i++) {
            paginationHTML += `
                <button class="${i === this.currentPage ? 'current-page' : ''}" onclick="bookshelf.goToPage(${i})">${i}</button>
            `;
        }
        
        paginationHTML += `
            <button ${this.currentPage === totalPages ? 'disabled' : ''} onclick="bookshelf.goToPage(${this.currentPage + 1})">Next</button>
        `;
        
        pagination.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.updateDisplay();
        
        // Scroll back to bookshelf area
        const bookshelf = document.getElementById('bookshelf');
        if (bookshelf) {
            bookshelf.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    createDefaultUserData() {
        return {
            exportDate: new Date().toISOString(),
            bookshelves: [],
            notes: {},
            settings: this.getDefaultSettings(),
            bookOrder: {},
            stats: { totalBooks: 0, notesCount: 0 },
            version: '2.0'
        };
    }

    getDefaultSettings() {
        return {
            defaultView: 'covers',
            showHighlights: true,
            currentBookshelf: 'all',
            theme: 'light',
            booksPerPage: 50,
            showImagesInOverview: true
        };
    }

    saveUserData() {
        localStorage.setItem('virtualBookshelf_userData', JSON.stringify(this.userData));
    }

    // exportUserData function removed - replaced with exportUnifiedData

    autoSaveUserDataFile() {
        // Retrieve books from BookManager
        const bookManager = window.bookManager;
        const books = {};
        
        // Convert books to integrated format
        if (bookManager && bookManager.library && bookManager.library.books) {
            bookManager.library.books.forEach(book => {
                const asin = book.asin;
                books[asin] = {
                    title: book.title,
                    authors: book.authors,
                    acquiredTime: book.acquiredTime,
                    readStatus: book.readStatus,
                    productImage: book.productImage,
                    source: book.source,
                    addedDate: book.addedDate,
                    memo: this.userData.notes[asin]?.memo || '',
                    rating: this.userData.notes[asin]?.rating || 0
                };
            });
        }

        const backupData = {
            exportDate: new Date().toISOString(),
            books: books,
            bookshelves: this.userData.bookshelves,
            settings: this.userData.settings,
            bookOrder: this.userData.bookOrder,
            stats: {
                totalBooks: Object.keys(books).length,
                notesCount: Object.keys(this.userData.notes).length
            },
            version: '2.0'
        };
        
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'library.json';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('📁 Generated library.json automatically');
    }

    updateBookshelfSelector() {
        const selector = document.getElementById('bookshelf-selector');
        if (!selector) return;
        
        selector.innerHTML = '<option value="all">📚 All Books</option>';
        
        if (this.userData.bookshelves) {
            this.userData.bookshelves.forEach(bookshelf => {
                const option = document.createElement('option');
                option.value = bookshelf.id;
                option.textContent = `${bookshelf.emoji || '📚'} ${bookshelf.name}`;
                selector.appendChild(option);
            });
        }
    }

    switchBookshelf(bookshelfId) {
        this.currentBookshelf = bookshelfId;
        this.updateStaticPageButton(bookshelfId);
        this.applyFilters();
    }

    showBookshelfManager() {
        const modal = document.getElementById('bookshelf-modal');
        modal.classList.add('show');
        this.renderBookshelfList();
    }

    closeBookshelfModal() {
        const modal = document.getElementById('bookshelf-modal');
        modal.classList.remove('show');
    }

    renderBookshelfList() {
        const container = document.getElementById('bookshelves-list');
        if (!this.userData.bookshelves) {
            this.userData.bookshelves = [];
        }

        let html = '';
        this.userData.bookshelves.forEach(bookshelf => {
            const bookCount = bookshelf.books ? bookshelf.books.length : 0;
            const isPublic = bookshelf.isPublic || false;
        const publicBadge = isPublic ? '<span class="public-badge">📤 Public</span>' : '';



            html += `
                <div class="bookshelf-item" data-id="${bookshelf.id}" draggable="true">
                    <div class="bookshelf-drag-handle">⋮⋮</div>
                    <div class="bookshelf-info">
                        <h4>${bookshelf.emoji || '📚'} ${bookshelf.name} ${publicBadge}</h4>
                        <p>${bookshelf.description || ''}</p>
                        <span class="book-count">${bookCount} books</span>

                    </div>
                    <div class="bookshelf-actions">
                        <button class="btn btn-secondary edit-bookshelf" data-id="${bookshelf.id}">Edit</button>
                        ${isPublic ? `<button class="btn btn-primary share-bookshelf" data-id="${bookshelf.id}">📄 Generate static page</button>` : ''}
                        <button class="btn btn-danger delete-bookshelf" data-id="${bookshelf.id}">Delete</button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Remove existing event listeners to prevent duplicates
        const oldContainer = container.cloneNode(true);
        container.parentNode.replaceChild(oldContainer, container);
        
        // Add event listeners for edit/delete/share buttons
        oldContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit-bookshelf')) {
                this.editBookshelf(e.target.dataset.id);
            } else if (e.target.classList.contains('delete-bookshelf')) {
                this.deleteBookshelf(e.target.dataset.id);
            } else if (e.target.classList.contains('share-bookshelf')) {
                this.showStaticShareModal(e.target.dataset.id);
            }
        });

        // Add drag and drop functionality for bookshelf reordering
        this.setupBookshelfDragAndDrop(oldContainer);
    }

    addBookshelf() {
        this.showBookshelfForm();
    }

    showBookshelfForm(bookshelfToEdit = null) {
        const modal = document.getElementById('bookshelf-form-modal');
        const title = document.getElementById('bookshelf-form-title');
        const nameInput = document.getElementById('bookshelf-name');
        const emojiInput = document.getElementById('bookshelf-emoji');
        const descriptionInput = document.getElementById('bookshelf-description');
        const isPublicInput = document.getElementById('bookshelf-is-public');

        // Set form title and populate fields for editing
        if (bookshelfToEdit) {
            title.textContent = '📚 Edit Shelf';
            nameInput.value = bookshelfToEdit.name;
            emojiInput.value = bookshelfToEdit.emoji || '📚';
            descriptionInput.value = bookshelfToEdit.description || '';
            isPublicInput.checked = bookshelfToEdit.isPublic || false;
        } else {
            title.textContent = '📚 New Shelf';
            nameInput.value = '';
            emojiInput.value = '📚';
            descriptionInput.value = '';
            isPublicInput.checked = false;
        }
        
        // Store current editing bookshelf
        this.currentEditingBookshelf = bookshelfToEdit;
        
        modal.classList.add('show');
        nameInput.focus();
    }

    closeBookshelfForm() {
        const modal = document.getElementById('bookshelf-form-modal');
        modal.classList.remove('show');
        this.currentEditingBookshelf = null;
    }

    saveBookshelfForm() {
        const nameInput = document.getElementById('bookshelf-name');
        const emojiInput = document.getElementById('bookshelf-emoji');
        const descriptionInput = document.getElementById('bookshelf-description');
        const isPublicInput = document.getElementById('bookshelf-is-public');

        const name = nameInput.value.trim();
        if (!name) {
            alert('Please enter a shelf name.');
            nameInput.focus();
            return;
        }

        if (this.currentEditingBookshelf) {
            // Edit existing bookshelf
            this.currentEditingBookshelf.name = name;
            this.currentEditingBookshelf.emoji = emojiInput.value.trim() || '📚';
            this.currentEditingBookshelf.description = descriptionInput.value.trim();
            this.currentEditingBookshelf.isPublic = isPublicInput.checked;
            this.currentEditingBookshelf.lastUpdated = new Date().toISOString();
        } else {
            // Create new bookshelf
            const newBookshelf = {
                id: `bookshelf_${Date.now()}`,
                name: name,
                emoji: emojiInput.value.trim() || '📚',
                description: descriptionInput.value.trim(),
                isPublic: isPublicInput.checked,
                books: [],
                createdAt: new Date().toISOString()
            };
            this.userData.bookshelves.push(newBookshelf);
        }

        this.saveUserData();
        this.updateBookshelfSelector();
        this.renderBookshelfList();
        this.closeBookshelfForm();
    }

    editBookshelf(bookshelfId) {
        const bookshelf = this.userData.bookshelves.find(b => b.id === bookshelfId);
        if (!bookshelf) return;
        
        this.showBookshelfForm(bookshelf);
    }

    deleteBookshelf(bookshelfId) {
        const bookshelf = this.userData.bookshelves.find(b => b.id === bookshelfId);
        if (!bookshelf) return;

        if (confirm(`📚 Delete the shelf "${bookshelf.name}"?\n\n⚠️ This action cannot be undone.`)) {
            this.userData.bookshelves = this.userData.bookshelves.filter(b => b.id !== bookshelfId);
            this.saveUserData();
            this.updateBookshelfSelector();
            this.renderBookshelfList();
            
            // If currently viewing this bookshelf, switch to "all"
            if (this.currentBookshelf === bookshelfId) {
                this.currentBookshelf = 'all';
                const selector = document.getElementById('bookshelf-selector');
                if (selector) selector.value = 'all';
                this.applyFilters();
            }
        }
    }

    addBookToBookshelf(asin) {
        const bookshelfSelect = document.getElementById(`bookshelf-select-${asin}`);
        const bookshelfId = bookshelfSelect.value;
        
        if (!bookshelfId) {
            alert('📚 Please choose a shelf');
            return;
        }

        const bookshelf = this.userData.bookshelves.find(b => b.id === bookshelfId);
        if (!bookshelf) {
            alert('❌ Shelf not found');
            return;
        }

        if (!bookshelf.books) {
            bookshelf.books = [];
        }

        if (bookshelf.books.includes(asin)) {
        alert(`📚 This book is already in "${bookshelf.name}".`);
            return;
        }

        bookshelf.books.push(asin);
        this.saveUserData();
        this.renderBookshelfList(); // Update the bookshelf management UI if open
        
        alert(`✅ Added to "${bookshelf.name}".`);
        
        // Reset the dropdown
        bookshelfSelect.value = '';
    }

    removeFromBookshelf(asin, bookshelfId) {
        const bookshelf = this.userData.bookshelves.find(b => b.id === bookshelfId);
        if (!bookshelf || !bookshelf.books) {
            alert('❌ Shelf not found');
            return;
        }
        
        const book = this.books.find(b => b.asin === asin);
        const bookTitle = book ? book.title : 'this book';
        
        if (!bookshelf.books.includes(asin)) {
            alert(`📚 This book is not in "${bookshelf.name}".`);
            return;
        }
        
        if (confirm(`📚 Remove "${bookTitle}" from "${bookshelf.name}"?\n\n⚠️ The book itself will remain in your library.`)) {
            bookshelf.books = bookshelf.books.filter(bookAsin => bookAsin !== asin);
            this.saveUserData();
            this.renderBookshelfList(); // Update the bookshelf management UI if open
            
            // If currently viewing this bookshelf, update the display
            if (this.currentBookshelf === bookshelfId) {
                this.applyFilters();
                this.updateDisplay();
            }
            
            alert(`✅ Removed "${bookTitle}" from "${bookshelf.name}".`);
            
            // Close modal to show the updated bookshelf
            this.closeModal('book-modal');
        }
    }

    /**
     * Completely delete a book (with BookManager integration)
     */
    async deleteBook(asin) {
        const book = this.books.find(b => b.asin === asin);
        if (!book) {
            alert('❌ Could not find the specified book.');
            return;
        }

        const confirmMessage = `🗑️ Are you sure you want to completely delete "${book.title}"?

⚠️ This operation cannot be undone.
📝 Favorites, notes, and shelf assignments will also be removed.`;

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            // Delete completely using BookManager
            await this.bookManager.deleteBook(asin, true);
            
            // Also remove from user data
            if (this.userData.notes[asin]) {
                delete this.userData.notes[asin];
            }
            
            // Remove from all bookshelves
            if (this.userData.bookshelves) {
                this.userData.bookshelves.forEach(bookshelf => {
                    if (bookshelf.books) {
                        bookshelf.books = bookshelf.books.filter(id => id !== asin);
                    }
                });
            }

            this.saveUserData();
            
            // Update display
            this.books = this.bookManager.getAllBooks();
            this.applyFilters();
            this.updateStats();
            this.renderBookshelfOverview();
            
            // Close modal
            this.closeModal('book-modal');
            
            alert(`✅ Successfully deleted "${book.title}"`);
        } catch (error) {
            console.error('Delete error:', error);
            alert(`❌ Failed to delete: ${error.message}`);
        }
    }


    showBookSelectionForImport(books, source) {
        this.pendingImportBooks = books;
        this.importSource = source;

        // Hide import options and show selection UI
        document.querySelector('.import-options').style.display = 'none';
        const selectionDiv = document.getElementById('book-selection');
        selectionDiv.style.display = 'block';

        // Get existing books (for duplicate checking)
        const existingASINs = new Set(this.bookManager.getAllBooks().map(book => book.asin));

        // Generate book list (with filter functionality)
        this.renderBookList(books, existingASINs);

        // Add event listeners
        this.setupBookSelectionListeners();
        this.updateSelectedCount();
    }

    renderBookList(books, existingASINs) {
        const bookList = document.getElementById('book-list');
        bookList.innerHTML = '';

        // Get filter settings
        const hideExisting = document.getElementById('hide-existing-books').checked;

        let visibleCount = 0;
        books.forEach((book, index) => {
            const isExisting = existingASINs.has(book.asin);

            // Apply filter: Skip if hiding already imported books
            if (hideExisting && isExisting) {
                return;
            }

            visibleCount++;
            const bookItem = document.createElement('div');
            bookItem.className = `book-selection-item ${isExisting ? 'existing-book' : ''}`;
            bookItem.dataset.bookIndex = index;
            bookItem.innerHTML = `
                <input type="checkbox" id="book-${index}" value="${index}" ${isExisting ? 'disabled' : ''}>
                <div class="book-selection-info">
                    <div class="book-selection-title">${book.title} ${isExisting ? '(Already imported)' : ''}</div>
                    <div class="book-selection-author">${book.authors}</div>
                    <div class="book-selection-meta">${new Date(book.acquiredTime).toLocaleDateString('ja-JP')}</div>
                </div>
            `;
            bookList.appendChild(bookItem);
        });

        // Update display count
        this.updateBookListStats(books.length, visibleCount, existingASINs.size);
    }

    updateBookListStats(totalBooks, visibleBooks, existingBooks) {
        // Add/update element to display statistics
        let statsElement = document.getElementById('book-list-stats');
        if (!statsElement) {
            statsElement = document.createElement('div');
            statsElement.id = 'book-list-stats';
            statsElement.style.cssText = 'margin-bottom: 1rem; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; font-size: 0.9rem; color: #6c757d;';
            document.getElementById('book-list').parentNode.insertBefore(statsElement, document.getElementById('book-list'));
        }

        const newBooks = totalBooks - existingBooks;
        statsElement.innerHTML = `
            📊 Total: ${totalBooks} books | New: ${newBooks} books | Already imported: ${existingBooks} books | Showing: ${visibleBooks} books
        `;
    }
    
    setupBookSelectionListeners() {
        // Redraw list when filter changes
        document.getElementById('hide-existing-books').addEventListener('change', () => {
            const existingASINs = new Set(this.bookManager.getAllBooks().map(book => book.asin));
            this.renderBookList(this.pendingImportBooks, existingASINs);
            this.updateSelectedCount();
        });

        // Select all
        document.getElementById('select-all-books').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#book-list input[type="checkbox"]:not([disabled])');
            checkboxes.forEach(cb => cb.checked = true);
            this.updateSelectedCount();
        });

        // Deselect all
        document.getElementById('deselect-all-books').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#book-list input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = false);
            this.updateSelectedCount();
        });

        // When checkbox changes
        document.getElementById('book-list').addEventListener('change', () => {
            this.updateSelectedCount();
        });

        // Import selected books
        document.getElementById('import-selected-books').addEventListener('click', () => {
            this.importSelectedBooks();
        });

        // Cancel
        document.getElementById('cancel-import').addEventListener('click', () => {
            this.cancelImport();
        });
    }
    
    updateSelectedCount() {
        const checkboxes = document.querySelectorAll('#book-list input[type="checkbox"]:checked');
        const count = checkboxes.length;
        document.getElementById('selected-count').textContent = count;
        
        const importButton = document.getElementById('import-selected-books');
        importButton.disabled = count === 0;
    }
    
    async importSelectedBooks() {
        const checkboxes = document.querySelectorAll('#book-list input[type="checkbox"]:checked');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.value));
        const selectedBooks = selectedIndices.map(index => this.pendingImportBooks[index]);
        
        if (selectedBooks.length === 0) {
        alert('📚 Please select at least one book to import.');
            return;
        }
        
        try {
            const results = await this.bookManager.importSelectedBooks(selectedBooks);
            this.showImportResults(results);
            
            // Update display
            this.books = this.bookManager.getAllBooks();
            this.applyFilters();
            this.updateStats();
            
            // Hide selection UI
            document.getElementById('book-selection').style.display = 'none';
            
        } catch (error) {
            console.error('Selected import error:', error);
        alert(`❌ Import failed: ${error.message}`);
        }
    }
    
    cancelImport() {
        // Hide selection UI and show import options
        document.getElementById('book-selection').style.display = 'none';
        document.querySelector('.import-options').style.display = 'block';
        
        // Clear temporary data
        this.pendingImportBooks = null;
        this.importSource = null;
    }

    async saveBookChanges(asin) {
        const titleInput = document.querySelector(`.edit-title[data-asin="${asin}"]`);
        const authorsInput = document.querySelector(`.edit-authors[data-asin="${asin}"]`);
        const acquiredTimeInput = document.querySelector(`.edit-acquired-time[data-asin="${asin}"]`);
        const originalAsinInput = document.querySelector(`.edit-original-asin[data-asin="${asin}"]`);
        const updatedAsinInput = document.querySelector(`.edit-updated-asin[data-asin="${asin}"]`);

        const newTitle = titleInput.value.trim();
        const newAuthors = authorsInput.value.trim();
        const newAcquiredTime = acquiredTimeInput.value;
        const newOriginalAsin = originalAsinInput.value.trim();
        const newUpdatedAsin = updatedAsinInput.value.trim();

        if (!newTitle) {
        alert('📖 Title is required.');
            return;
        }

        // オリジナルASINの妥当性チェック
        if (!newOriginalAsin || !this.bookManager.isValidASIN(newOriginalAsin)) {
            alert('🔖 Please enter a 10-character alphanumeric ASIN (e.g., B07ABC1234).');
            return;
        }

        // 変更後ASINの妥当性チェック
        if (newUpdatedAsin && !this.bookManager.isValidASIN(newUpdatedAsin)) {
            alert('🔗 Updated ASIN must also be 10 alphanumeric characters (e.g., B07ABC1234).');
            return;
        }

            // Duplicate check if original ASIN is changed
        if (newOriginalAsin !== asin) {
            const existingBook = this.books.find(book => book.asin === newOriginalAsin);
            if (existingBook) {
                alert('🔖 This original ASIN is already in use.');
                return;
            }
        }

        try {
            const updateData = {
                title: newTitle,
                authors: newAuthors || 'Author not set'
            };

            // If original ASIN is changed
            if (newOriginalAsin !== asin) {
                updateData.asin = newOriginalAsin;
            }

            // Update if purchase date is changed
            if (newAcquiredTime) {
                updateData.acquiredTime = new Date(newAcquiredTime).getTime();
            }

            // Process updated ASIN
            if (newUpdatedAsin) {
                updateData.updatedAsin = newUpdatedAsin;
                // Also update image URL with new ASIN
                updateData.productImage = `https://images-na.ssl-images-amazon.com/images/P/${newUpdatedAsin}.01.L.jpg`;
            } else {
                // Remove property if ASIN is deleted after change
                updateData.updatedAsin = undefined;
                // Restore image URL with original ASIN (may have been changed)
                updateData.productImage = `https://images-na.ssl-images-amazon.com/images/P/${newOriginalAsin}.01.L.jpg`;
            }

            const success = await this.bookManager.updateBook(asin, updateData);

            if (success) {
                // Migrate user data if original ASIN is changed
                if (newOriginalAsin !== asin) {
                    this.migrateUserData(asin, newOriginalAsin);
                }

                // Update display
                this.books = this.bookManager.getAllBooks();
                this.applyFilters();
                this.updateStats();

                alert('✅ Book information updated successfully.');

                // 編集モードから表示モードに戻る
                if (newOriginalAsin !== asin) {
                    // ASINが変更された場合はモーダルを閉じる
                    this.closeModal('book-modal');
                } else {
                    // 表示モードで再表示
                    const book = this.books.find(b => b.asin === newOriginalAsin);
                    if (book) {
                        this.showBookDetail(book, false);
                    }
                }
            }

        } catch (error) {
            console.error('Book update error:', error);
            alert(`❌ Update failed: ${error.message}`);
        }
    }

    /**
     * Migrate user data when original ASIN is changed
     */
    migrateUserData(oldAsin, newAsin) {
        // Migrate star rating and memo
        if (this.userData.notes[oldAsin]) {
            this.userData.notes[newAsin] = this.userData.notes[oldAsin];
            delete this.userData.notes[oldAsin];
        }

        // Migrate hidden settings
        if (this.userData.hiddenBooks && this.userData.hiddenBooks.includes(oldAsin)) {
            const index = this.userData.hiddenBooks.indexOf(oldAsin);
            this.userData.hiddenBooks[index] = newAsin;
        }

        // Migrate bookshelf information
        if (this.userData.bookshelves) {
            Object.values(this.userData.bookshelves).forEach(bookshelf => {
                if (bookshelf.books && bookshelf.books.includes(oldAsin)) {
                    const index = bookshelf.books.indexOf(oldAsin);
                    bookshelf.books[index] = newAsin;
                }
            });
        }

        // Save user data
        this.saveUserData();
    }

    updateMemoPreview(textarea) {
        const preview = textarea.parentElement.querySelector('.note-preview');
        const previewContent = preview.querySelector('.note-preview-content');
        
        const text = textarea.value.trim();
        if (text) {
            // マークダウンリンクをHTMLリンクに変換
            const htmlContent = this.convertMarkdownLinksToHtml(text);
            previewContent.innerHTML = htmlContent;
            preview.style.display = 'block';
        } else {
            preview.style.display = 'none';
        }
    }

    convertMarkdownLinksToHtml(text) {
        // [リンクテキスト](URL) の形式をHTMLリンクに変換
        return text
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(/\n/g, '<br>'); // 改行もHTMLに変換
    }

    formatMemoForDisplay(memo, maxLength) {
        if (!memo) return '';
        
        // 改行を保持しつつ、長さ制限を適用
        const lines = memo.split('\n');
        let formattedText = '';
        let currentLength = 0;
        
        for (const line of lines) {
            if (currentLength + line.length > maxLength) {
                const remainingLength = maxLength - currentLength;
                if (remainingLength > 10) {
                    formattedText += line.substring(0, remainingLength) + '...';
                } else {
                    formattedText += '...';
                }
                break;
            }
            
            formattedText += line + '\n';
            currentLength += line.length + 1; // +1 for newline
        }
        
        // マークダウンリンクをHTMLリンクに変換
        return this.convertMarkdownLinksToHtml(formattedText.trim());
    }

    /**
     * Kindleインポートモーダルを表示
     */
    showImportModal() {
        const modal = document.getElementById('import-modal');
        modal.classList.add('show');
    }

    /**
     * Kindleインポートモーダルを閉じる
     */
    closeImportModal() {
        const modal = document.getElementById('import-modal');
        modal.classList.remove('show');
        // 結果表示をリセット
        const resultsDiv = document.getElementById('import-results');
        resultsDiv.style.display = 'none';
        resultsDiv.innerHTML = '';
    }

    /**
     * ファイルからKindleデータをインポート
     */
    async importFromFile() {
        const fileInput = document.getElementById('kindle-file-input');
        if (!fileInput.files || fileInput.files.length === 0) {
            alert('📁 Please choose a file.');
            return;
        }

        try {
            // Load file and display book list
            const file = fileInput.files[0];
            const text = await file.text();
            const books = JSON.parse(text);
            
            this.showBookSelectionForImport(books, 'file');
            
        } catch (error) {
            console.error('File loading error:', error);
            alert(`❌ Failed to read file: ${error.message}`);
        }
    }

    /**
     * Import from data/kindle.json
     */
    // This method is no longer needed - removed data/kindle.json import option

    /**
     * Display import results
     */
    showImportResults(results) {
        const resultsDiv = document.getElementById('import-results');
        resultsDiv.innerHTML = `
            <div class="import-summary">
                <h3>📊 Import Results</h3>
                <div class="import-stats">
                    <div class="stat-item">
                        <span class="stat-value">${results.total}</span>
                        <span class="stat-label">Total Books</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value success">${results.added}</span>
                        <span class="stat-label">Newly Added</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value warning">${results.updated}</span>
                        <span class="stat-label">Updated</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${results.skipped}</span>
                        <span class="stat-label">Skipped</span>
                    </div>
                </div>
                <p class="import-note">
                    ✅ Import completed. Newly added: ${results.added} books, Updated: ${results.updated} books
                </p>
            </div>
        `;
        resultsDiv.style.display = 'block';
    }

    /**
     * Show manual addition modal
     */
    showAddBookModal() {
        const modal = document.getElementById('add-book-modal');
        modal.classList.add('show');
    }

    /**
     * Close manual addition modal
     */
    closeAddBookModal() {
        const modal = document.getElementById('add-book-modal');
        modal.classList.remove('show');
        
        // フォームをリセット（存在する要素のみ）
        const amazonUrlInput = document.getElementById('amazon-url-input');
        if (amazonUrlInput) amazonUrlInput.value = '';
        
        const manualAsin = document.getElementById('manual-asin');
        if (manualAsin) manualAsin.value = '';

        const manualTitle = document.getElementById('manual-title');
        if (manualTitle) manualTitle.value = '';

        const manualAuthors = document.getElementById('manual-authors');
        if (manualAuthors) manualAuthors.value = '';

        // ASINステータスをリセット
        const asinStatus = document.getElementById('asin-status');
        if (asinStatus) asinStatus.style.display = 'none';

        // 結果表示をリセット
        const resultsDiv = document.getElementById('add-book-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
            resultsDiv.innerHTML = '';
        }
    }

    /**
     * Add book from Amazon link
     */


    async fetchBookMetadata(asin) {
        try {
            // 簡易的にASINから書籍情報を推測（完全ではない）
            
            // まず既存の蔵書データから同じASINがないかチェック
            const existingBook = this.books.find(book => book.asin === asin);
            if (existingBook) {
                throw new Error('This book is already in your library');
            }
            
            // Amazon画像URLから表紙画像の存在確認
            const imageUrl = `https://images-amazon.com/images/P/${asin}.01.L.jpg`;
            
            return {
                asin: asin,
                title: '', // 自動取得できない
                authors: '', // 自動取得できない
                acquiredTime: Date.now(),
                readStatus: 'UNKNOWN',
                productImage: imageUrl,
                source: 'manual_add'
            };
            
        } catch (error) {
            console.error('Metadata fetch error:', error);
            throw error;
        }
    }
    
    fallbackToManualInput(asin) {
        // Set ASIN in manual input form if auto-fetch fails
        document.getElementById('manual-title').value = '';
        document.getElementById('manual-authors').value = '';
        document.getElementById('manual-asin').value = asin;
        document.getElementById('manual-asin').readOnly = true;
        
        alert(`⚠️ Failed to fetch book details automatically.\nASIN: ${asin}\n\nPlease enter the title and author manually.`);
    }

    /**
     * ASINから書籍情報を自動取得してフォームに入力
     */
    async fetchBookInfoFromASIN() {
        const asinInput = document.getElementById('manual-asin');
        const titleInput = document.getElementById('manual-title');
        const authorsInput = document.getElementById('manual-authors');
        const statusDiv = document.getElementById('asin-status');
        const fetchBtn = document.getElementById('fetch-book-info');

        const asin = asinInput.value.trim();

        if (!asin) {
            this.showASINStatus('error', 'Please enter an ASIN.');
            return;
        }

        if (!this.bookManager.isValidASIN(asin)) {
            this.showASINStatus('error', 'Invalid ASIN format (example: B012345678).');
            return;
        }

        // ローディング状態を表示
        this.showASINStatus('loading', '📥 Fetching book details...');
        fetchBtn.disabled = true;
        fetchBtn.textContent = 'Loading...';

        try {
            const bookData = await this.bookManager.fetchBookDataFromAmazon(asin);

            console.log('Fetched book data:', bookData);

            // Set information in fields
            titleInput.value = bookData.title;
            authorsInput.value = bookData.authors;

            // Display message based on fetch results
            if (bookData.title && bookData.title !== 'Title not retrieved' && bookData.title !== '') {
                this.showASINStatus('success', `✅ Found book: ${bookData.title}`);
            } else {
                this.showASINStatus('error', '❌ Could not retrieve book info. Please enter details manually.');
                // Focus on title field if auto-fetch fails
                titleInput.focus();
            }

        } catch (error) {
            console.error('Book metadata fetch error:', error);
            this.showASINStatus('error', '❌ Failed to fetch book data. Please enter details manually.');
        } finally {
            // Restore button
            fetchBtn.disabled = false;
            fetchBtn.textContent = '📥 Fetch automatically';
        }
    }

    /**
     * ASIN取得ステータスを表示
     */
    showASINStatus(type, message) {
        const statusDiv = document.getElementById('asin-status');
        statusDiv.className = `asin-status ${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        // Automatically hide success or error message after 5 seconds
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }

    /**
     * Add book manually
     */
    async addBookManually() {
        const asin = document.getElementById('manual-asin').value.trim();
        const title = document.getElementById('manual-title').value.trim();
        const authors = document.getElementById('manual-authors').value.trim();

        if (!asin) {
            alert('📝 Please enter an ASIN.');
            return;
        }

        if (!title) {
            alert('📝 Please enter a title.');
            return;
        }

        try {
            const bookData = {
                asin: asin,
                title: title,
                authors: authors || 'Unknown',
                readStatus: 'UNKNOWN',
                acquiredTime: Date.now()
            };

            const newBook = await this.bookManager.addBookManually(bookData);
            this.showAddBookSuccess(newBook);
            
            // Update display
            this.books = this.bookManager.getAllBooks();
            this.applyFilters();
            this.updateStats();
            
        } catch (error) {
            console.error('Add book error:', error);
            alert(`❌ Failed to add book: ${error.message}`);
        }
    }

    /**
     * Display book addition success
     */
    showAddBookSuccess(book) {
        const resultsDiv = document.getElementById('add-book-results');
        resultsDiv.innerHTML = `
            <div class="add-success">
                <h3>✅ Book added</h3>
                <div class="added-book-info">
                    <p><strong>Title:</strong> ${book.title}</p>
                    <p><strong>Author:</strong> ${book.authors}</p>
                    <p><strong>ASIN:</strong> ${book.asin}</p>
                </div>
            </div>
        `;
        resultsDiv.style.display = 'block';
    }

    /**
     * 蔵書データをエクスポート
     */
    exportUnifiedData() {
        console.log('📦 エクスポート開始...');
        
        // 既存のlibrary.jsonを読み込み、現在のデータと統合
        const exportData = {
            exportDate: new Date().toISOString(),
            books: {}, // 後で設定
            bookshelves: this.userData.bookshelves || [],
            settings: (() => {
                const { affiliateId, ...settingsWithoutAffiliateId } = this.userData.settings;
                return settingsWithoutAffiliateId;
            })(),
            bookOrder: this.userData.bookOrder || {},
            stats: {
                totalBooks: 0,
                notesCount: Object.keys(this.userData.notes || {}).length
            },
            version: '2.0'
        };
        
        // 現在表示されている書籍データをbooks形式に変換
        const books = {};
        if (this.books && this.books.length > 0) {
            console.log(`📚 ${this.books.length}冊の書籍データを処理中...`);
            this.books.forEach(book => {
                const asin = book.asin;
                if (asin) {
                    books[asin] = {
                        title: book.title || '',
                        authors: book.authors || '',
                        acquiredTime: book.acquiredTime || Date.now(),
                        readStatus: book.readStatus || 'UNREAD',
                        productImage: book.productImage || '',
                        source: book.source || 'unknown',
                        addedDate: book.addedDate || Date.now(),
                        memo: this.userData.notes?.[asin]?.memo || '',
                        rating: this.userData.notes?.[asin]?.rating || 0,
                        // updatedAsinフィールドも含める
                        ...(book.updatedAsin && book.updatedAsin.trim() !== '' && { updatedAsin: book.updatedAsin })
                    };
                }
            });
        }
        
        exportData.books = books;
        exportData.stats.totalBooks = Object.keys(books).length;
        
        console.log(`📊 エクスポートデータ: ${exportData.stats.totalBooks}冊, ${exportData.stats.notesCount}メモ`);
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'library.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('📦 library.json をエクスポートしました！');
    }

    /**
     * 蔵書を全てクリア
     */
    async clearLibrary() {
        const confirmMessage = `🗑️ Are you sure you want to completely clear all data?

This operation will delete the following data:
• All book data
• All bookshelf settings
• All ratings and notes
• All sort order settings

This operation cannot be undone.`;
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        try {
            this.showLoading();
            
            // Clear library using BookManager
            await this.bookManager.clearAllBooks();
            
            // Completely clear all userData
            if (this.userData) {
                // Completely clear bookshelf data
                this.userData.bookshelves = [];
                
                // Completely clear ratings and notes
                this.userData.notes = {};
                
                // Completely clear sort order data
                this.userData.bookOrder = {};
                
                // Reset statistics data
                this.userData.stats = {
                    totalBooks: 0,
                    notesCount: 0
                };
            }
            
            // Update book list
            this.books = [];
            this.filteredBooks = [];
            
            // Update UI
            this.saveUserData();
            this.updateDisplay();
            this.updateStats();
            
            alert('✅ All data has been completely cleared');
        } catch (error) {
            console.error('Error occurred while clearing library:', error);
            alert('❌ Failed to clear library: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    renderBookshelfOverview() {
        const overviewSection = document.getElementById('bookshelves-overview');
        const grid = document.getElementById('bookshelves-grid');
        
        // Null check - element'ler yoksa fonksiyondan çık
        if (!overviewSection || !grid) {
            return;
        }
        
        if (!this.userData.bookshelves || this.userData.bookshelves.length === 0) {
            overviewSection.style.display = 'none';
            return;
        }

        overviewSection.style.display = 'block';
        
        let html = '';
        this.userData.bookshelves.forEach(bookshelf => {
            const bookCount = bookshelf.books ? bookshelf.books.length : 0;
            
            // Apply custom book order for preview if it exists
            let previewBooks = [];
            if (bookshelf.books && bookshelf.books.length > 0) {
                let orderedBooks = [...bookshelf.books];
                
                // Apply custom order if exists
                if (this.userData.bookOrder && this.userData.bookOrder[bookshelf.id]) {
                    const customOrder = this.userData.bookOrder[bookshelf.id];
                    orderedBooks.sort((a, b) => {
                        const aIndex = customOrder.indexOf(a);
                        const bIndex = customOrder.indexOf(b);
                        
                        if (aIndex === -1 && bIndex === -1) return 0;
                        if (aIndex === -1) return 1;
                        if (bIndex === -1) return -1;
                        return aIndex - bIndex;
                    });
                }
                
                previewBooks = orderedBooks.slice(0, 8);
            }
            
            const textOnlyClass = this.showImagesInOverview ? '' : 'text-only';
            const isPublic = bookshelf.isPublic || false;
            const publicBadge = isPublic ? '<span class="public-badge">📤 公開中</span>' : '';



            html += `
                <div class="bookshelf-preview ${textOnlyClass}" data-bookshelf-id="${bookshelf.id}">
                    <div class="bookshelf-preview-header">
                        <h3>${bookshelf.emoji || '📚'} ${bookshelf.name} ${publicBadge}</h3>
                        <div class="bookshelf-preview-actions">
                            <button class="btn btn-small btn-secondary select-bookshelf" data-bookshelf-id="${bookshelf.id}">📚 表示</button>
                            ${isPublic ? `<button class="btn btn-small btn-primary open-static-page" data-bookshelf-id="${bookshelf.id}">🌐 静的ページ</button>` : ''}
                        </div>
                    </div>
                    <p>${bookshelf.description || ''}</p>

                    <p class="book-count">${bookCount}冊</p>
                    <div class="bookshelf-preview-books">
                        ${previewBooks.map(asin => {
                            const book = this.books.find(b => b.asin === asin);
                            if (book && book.productImage) {
                                return `<div class="bookshelf-preview-book"><img src="${this.bookManager.getProductImageUrl(book)}" alt="${book.title}"></div>`;
                            } else {
                                return '<div class="bookshelf-preview-book bookshelf-preview-placeholder">📖</div>';
                            }
                        }).join('')}
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
        
        // Add click handlers for bookshelf actions
        grid.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-bookshelf')) {
                // Bookshelf selection button
                const bookshelfId = e.target.dataset.bookshelfId;
                const selector = document.getElementById('bookshelf-selector');
                if (selector) selector.value = bookshelfId;
                this.switchBookshelf(bookshelfId);

                // Smooth scroll to area where books are displayed
                setTimeout(() => {
                    const bookshelf = document.getElementById('bookshelf');
                    if (bookshelf) {
                        bookshelf.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }, 100);
            } else if (e.target.classList.contains('open-static-page')) {
                // Static page button
                const bookshelfId = e.target.dataset.bookshelfId;
                this.openStaticPageById(bookshelfId);
            } else {
                // Select bookshelf if bookshelf preview area is clicked
                const bookshelfPreview = e.target.closest('.bookshelf-preview');
                if (bookshelfPreview && !e.target.closest('.bookshelf-preview-actions')) {
                    const bookshelfId = bookshelfPreview.dataset.bookshelfId;
                    const selector = document.getElementById('bookshelf-selector');
                if (selector) selector.value = bookshelfId;
                    this.switchBookshelf(bookshelfId);

                    // Smooth scroll to area where books are displayed
                    setTimeout(() => {
                        const bookshelf = document.getElementById('bookshelf');
                        if (bookshelf) {
                            bookshelf.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                        }
                    }, 100);
                }
            }
        });
    }

    toggleBookshelfDisplay() {
        this.showImagesInOverview = !this.showImagesInOverview;
        this.userData.settings.showImagesInOverview = this.showImagesInOverview;
        this.saveUserData();
        
        const button = document.getElementById('toggle-bookshelf-display');
        button.textContent = this.showImagesInOverview ? '🖼️ Toggle Image Display' : '📝 Text Only';
        
        this.renderBookshelfOverview();
    }

    showError(message) {
        const bookshelf = document.getElementById('bookshelf');
        bookshelf.innerHTML = `<div class="error-message">❌ ${message}</div>`;
    }
    
    generateStarRating(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            const isActive = i <= rating ? 'active' : '';
            const color = i <= rating ? '#ffa500' : '#ddd';
            stars += `<span class="star ${isActive}" data-rating="${i}" style="color: ${color};">⭐</span>`;
        }
        return stars;
    }
    
    getDisplayRatingValue(book, userNote) {
        if (userNote && userNote.rating) return Number(userNote.rating);
        if (book && book.rating) return Number(book.rating);
        if (book && book.average_rating) return Number(book.average_rating);
        if (book && book.averageRating) return Number(book.averageRating);
        return 0;
    }

    displayStarRating(rating, averageRating = null) {
        // Eğer rating yoksa ama average_rating varsa, onu kullan
        let displayRating = rating;
        if ((!displayRating || displayRating <= 0) && averageRating) {
            displayRating = Number(averageRating);
        }
        
        // Hala rating yoksa, hiçbir şey gösterme
        if (!displayRating || displayRating <= 0) {
            return '';
        }

        // Yıldız sayısını belirle - Math.floor kullanarak: 1.0-1.9 -> 1, 2.0-2.9 -> 2, vb.
        const starCount = Math.floor(displayRating);
        const rounded = Math.max(1, Math.min(5, starCount));
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            stars += i <= rounded ? '⭐' : '☆';
        }
        
        // average_rating varsa onu göster, yoksa displayRating'i göster
        const ratingToShow = averageRating ? Number(averageRating) : displayRating;
        const label = `Rating: ${ratingToShow.toFixed(1)}`;
        const valueLabel = `<span class="rating-value">${ratingToShow.toFixed(1)}</span>`;
        return `<div class="book-rating" title="${label}"><span class="stars">${stars}</span>${valueLabel}</div>`;
    }
    
    saveRating(asin, rating) {
        if (!this.userData.notes[asin]) {
            this.userData.notes[asin] = { memo: '', rating: 0 };
        }
        this.userData.notes[asin].rating = rating;
        this.saveUserData();
    }
    
    /**
     * ローディング表示
     */
    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'block';
        }
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }

    setupBookshelfDragAndDrop(container) {
        let draggedBookshelf = null;

        container.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('bookshelf-item')) {
                draggedBookshelf = e.target;
                e.target.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
            }
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const target = e.target.closest('.bookshelf-item');
            if (target && target !== draggedBookshelf) {
                target.style.borderTop = '2px solid #3498db';
            }
        });

        container.addEventListener('dragleave', (e) => {
            const target = e.target.closest('.bookshelf-item');
            if (target) {
                target.style.borderTop = '';
            }
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            
            const target = e.target.closest('.bookshelf-item');
            if (target && target !== draggedBookshelf) {
                const draggedId = draggedBookshelf.dataset.id;
                const targetId = target.dataset.id;
                this.reorderBookshelves(draggedId, targetId);
            }

            // Clear all visual feedback
            container.querySelectorAll('.bookshelf-item').forEach(item => {
                item.style.borderTop = '';
            });
        });

        container.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('bookshelf-item')) {
                e.target.classList.remove('dragging');
                draggedBookshelf = null;
            }
            
            // Clear all visual feedback
            container.querySelectorAll('.bookshelf-item').forEach(item => {
                item.style.borderTop = '';
            });
        });
    }

    reorderBookshelves(draggedId, targetId) {
        const draggedIndex = this.userData.bookshelves.findIndex(b => b.id === draggedId);
        const targetIndex = this.userData.bookshelves.findIndex(b => b.id === targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            // Remove the dragged bookshelf from its current position
            const draggedBookshelf = this.userData.bookshelves.splice(draggedIndex, 1)[0];
            
            // Insert it at the new position
            this.userData.bookshelves.splice(targetIndex, 0, draggedBookshelf);
            
            // Save the changes
            this.saveUserData();
            this.updateBookshelfSelector();
            this.renderBookshelfList();
            
            console.log(`📚 Moved shelf "${draggedBookshelf.name}"`);
        }
    }

    /**
     * 静的共有モーダルを表示
     */
    showStaticShareModal(bookshelfId) {
        const bookshelf = this.userData.bookshelves.find(b => b.id === bookshelfId);
        if (!bookshelf) return;

        this.currentShareBookshelf = bookshelf;
        const modal = document.getElementById('static-share-modal');
        const form = document.getElementById('share-generation-form');
        const results = document.getElementById('share-results');

        // フォームを非表示、結果を表示
        form.style.display = 'none';
        results.style.display = 'block';

        modal.classList.add('show');
        
        // Automatically generate static page
        this.generateStaticPage();
    }

    /**
     * Close static share modal
     */
    closeStaticShareModal() {
        const modal = document.getElementById('static-share-modal');
        modal.classList.remove('show');
        this.currentShareBookshelf = null;
    }

    /**
     * Generate static page
     */
    async generateStaticPage() {
        if (!this.currentShareBookshelf) return;


        const generateBtn = document.getElementById('generate-static-page');
        const form = document.getElementById('share-generation-form');
        const results = document.getElementById('share-results');
        const resultsContent = results.querySelector('.share-result-content');

        // ローディング状態
        generateBtn.disabled = true;
        generateBtn.textContent = '生成中...';

        try {
            const options = {};

            const result = await this.staticGenerator.generateStaticBookshelf(
                this.currentShareBookshelf.id,
                options
            );

            if (result.success) {
                // Save public information to bookshelf data
                this.currentShareBookshelf.staticPageInfo = {
                    filename: result.filename,
                    lastGenerated: new Date().toISOString(),

                    // Generate GitHub Pages URL (inferred from repository name)
                    url: `https://karaage0703.github.io/karaage-virtual-bookshelf/static/${result.filename}`
                };
                this.saveUserData();

                // Display on success
                resultsContent.innerHTML = `
                    <div class="success-message">
                        <h3>✅ Static page generated successfully!</h3>
                        <div class="generation-info">
                            <p><strong>Bookshelf:</strong> ${result.bookshelf.emoji} ${result.bookshelf.name}</p>
                            <p><strong>Number of Books:</strong> ${result.totalBooks} books</p>
                            <p><strong>Filename:</strong> ${result.filename}</p>
                            <p><strong>Public URL:</strong> <a href="${this.currentShareBookshelf.staticPageInfo.url}" target="_blank">${this.currentShareBookshelf.staticPageInfo.url}</a></p>
                            <p><strong>Note:</strong> URL will be valid after pushing to GitHub</p>
                        </div>

                        <div class="form-actions">
                            <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${this.currentShareBookshelf.staticPageInfo.url}')">📋 Copy URL</button>
                            <button class="btn btn-secondary" onclick="window.bookshelf.closeStaticShareModal()">Close</button>
                        </div>
                    </div>
                `;

                // Hide form and show results
                form.style.display = 'none';
                results.style.display = 'block';

            } else {
                // Display on error
                resultsContent.innerHTML = `
                    <div class="error-message">
                        <h3>❌ Generation failed</h3>
                        <p>Error: ${result.error}</p>
                        <button class="btn btn-secondary" onclick="document.getElementById('static-share-modal').querySelector('#share-generation-form').style.display='block'; document.getElementById('share-results').style.display='none';">Retry</button>
                    </div>
                `;
                form.style.display = 'none';
                results.style.display = 'block';
            }

        } catch (error) {
            console.error('Static page generation error:', error);
            resultsContent.innerHTML = `
                <div class="error-message">
                    <h3>❌ An error occurred during generation</h3>
                    <p>Error: ${error.message}</p>
                    <button class="btn btn-secondary" onclick="document.getElementById('static-share-modal').querySelector('#share-generation-form').style.display='block'; document.getElementById('share-results').style.display='none';">Retry</button>
                </div>
            `;
            form.style.display = 'none';
            results.style.display = 'block';
        } finally {
            // Restore button
            generateBtn.disabled = false;
            generateBtn.textContent = '📄 Generate Static Page';
        }
    }

    /**
     * Control static page button visibility
     */
    updateStaticPageButton(bookshelfId) {
        const button = document.getElementById('view-static-page');
        if (!button) return;

        if (bookshelfId === 'all') {
            button.style.display = 'none';
        } else {
            const bookshelf = this.userData.bookshelves?.find(b => b.id === bookshelfId);
            if (bookshelf && bookshelf.isPublic) {
                button.style.display = 'inline-block';
            } else {
                button.style.display = 'none';
            }
        }
    }

    /**
     * Open static page for currently selected bookshelf
     */
    openStaticPage() {
        const bookshelfSelector = document.getElementById('bookshelf-selector');
        const currentBookshelfId = bookshelfSelector ? bookshelfSelector.value : 'all';
        if (currentBookshelfId === 'all') return;

        this.openStaticPageById(currentBookshelfId);
    }

    /**
     * Open static page for bookshelf with specified ID
     */
    openStaticPageById(bookshelfId) {
        const bookshelf = this.userData.bookshelves?.find(b => b.id === bookshelfId);
        if (!bookshelf || !bookshelf.isPublic) {
            alert('This shelf is not published.');
            return;
        }

        const staticUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}static/${bookshelfId}.html`;
        window.open(staticUrl, '_blank');
    }
    
    // Navigation functions
    showAllBooks() {
        // Show search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'block';
        
        // Update active nav first
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        const navBooks = document.getElementById('nav-books');
        if (navBooks) {
            navBooks.classList.add('active');
        }
        
        this.currentViewMode = 'all';
        this.applyFilters();
        this.updateDisplay();
        this.pushToHistory('all', {});
    }
    
    showFavorites() {
        if (!this.isUserLoggedIn()) {
            alert('Please log in to view your favorites.');
            window.location.href = 'login.html';
            return;
        }
        
        // Show search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'block';
        
        // Update active nav first
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        const navFavorites = document.getElementById('nav-favorites');
        if (navFavorites) {
            navFavorites.classList.add('active');
        }
        
        this.currentViewMode = 'favorites';
        const favorites = this.getFavorites();
        this.filteredBooks = this.books.filter(book => favorites.includes(book.asin));
        this.currentPage = 1;
        this.updateDisplay();
        this.updateStats();
        this.pushToHistory('favorites', {});
    }
    
    showAuthors() {
        // Show search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'block';
        
        this.currentViewMode = 'authors';
        this.pushToHistory('authors', {});
        
        // Get all unique authors with their book counts
        const authorsMap = new Map();
        this.books.forEach(book => {
            const author = book.authors || book.author || '';
            // Skip if author is empty or 'Unknown'
            if (!author || author.trim() === '' || author === 'Unknown') {
                return;
            }
            if (!authorsMap.has(author)) {
                authorsMap.set(author, 0);
            }
            authorsMap.set(author, authorsMap.get(author) + 1);
        });
        
        // Convert to array, filter out authors with no books, and sort
        const authors = Array.from(authorsMap.entries())
            .map(([author, count]) => ({ author, count }))
            .filter(a => a.count > 0) // Sadece kitapları olan yazarlar
            .sort((a, b) => {
                // Önce kitap sayısına göre (azalan), sonra alfabetik
                if (b.count !== a.count) {
                    return b.count - a.count;
                }
                return a.author.localeCompare(b.author);
            });
        
        // Render authors view
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) {
            console.error('Bookshelf element not found');
            return;
        }
        
        // Clear existing content
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf authors-view';
        
        if (authors.length === 0) {
            bookshelf.innerHTML = '<div class="error-message" style="padding: 2rem; text-align: center; color: #7f8c8d;">No authors found.</div>';
            // Update active nav
            document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
            const navAuthors = document.getElementById('nav-authors');
            if (navAuthors) navAuthors.classList.add('active');
            return;
        }
        
        // Create container for authors list with header
        const authorsContainer = document.createElement('div');
        authorsContainer.style.cssText = 'padding: 2rem 0;';
        
        // Add header
        const header = document.createElement('div');
        header.style.cssText = 'margin-bottom: 2rem; text-align: center;';
        header.innerHTML = `
            <h2 style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 2rem; font-weight: 700; letter-spacing: -0.5px;">Authors</h2>
            <p style="margin: 0; color: #7f8c8d; font-size: 1rem; font-weight: 400;">${authors.length} author${authors.length !== 1 ? 's' : ''} found</p>
        `;
        authorsContainer.appendChild(header);
        
        // Create a beautiful grid of author names
        const authorsList = document.createElement('div');
        authorsList.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem;';
        
        authors.forEach(({ author, count }) => {
            const authorItem = document.createElement('div');
            authorItem.className = 'author-item';
            // Hiçbir transform yok, sadece gölge ve renk değişiyor
            authorItem.style.cssText = 'background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); padding: 1.5rem; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08); cursor: pointer; transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-left-color 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-left: 5px solid #4a90e2; position: relative; overflow: hidden;';
            
            // Add subtle background pattern
            authorItem.innerHTML = `
                <div style="position: relative; z-index: 2;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 700; line-height: 1.3; font-family: 'Cinzel', serif;">${this.escapeHtml(author)}</h3>
                        </div>
                        <span style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); color: white; padding: 0.4rem 0.9rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; box-shadow: 0 2px 4px rgba(74, 144, 226, 0.3); white-space: nowrap; margin-left: 1rem;">${count} book${count !== 1 ? 's' : ''}</span>
                    </div>
                    <div style="display: flex; align-items: center; color: #7f8c8d; font-size: 0.85rem; font-weight: 400; margin-top: 0.5rem; position: relative; z-index: 3;">
                        <span style="display: inline-block; width: 4px; height: 4px; background: #4a90e2; border-radius: 50%; margin-right: 0.5rem;"></span>
                        <span style="font-family: 'Cinzel', serif;">View books</span>
                    </div>
                </div>
            `;
            
            // Sadece gölge ve renk değişiyor, hiçbir transform yok
            authorItem.addEventListener('mouseenter', function() {
                this.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15), 0 2px 6px rgba(0,0,0,0.1)';
                this.style.borderLeftColor = '#357abd';
            });
            authorItem.addEventListener('mouseleave', function() {
                this.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.08)';
                this.style.borderLeftColor = '#4a90e2';
            });
            
            // Click to filter books by author
            authorItem.addEventListener('click', (e) => {
                e.stopPropagation();
                this.filterByAuthor(author);
            });
            
            authorsList.appendChild(authorItem);
        });
        
        authorsContainer.appendChild(authorsList);
        bookshelf.appendChild(authorsContainer);
        
        // Update active nav immediately
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        const navAuthors = document.getElementById('nav-authors');
        if (navAuthors) {
            navAuthors.classList.add('active');
        }
    }
    
    filterByAuthor(authorName) {
        // Filter books by author and show in main view
        this.currentViewMode = 'all';
        this.filteredBooks = this.books.filter(book => {
            const bookAuthor = book.authors || book.author || '';
            return bookAuthor === authorName;
        });
        this.currentPage = 1;
        this.updateDisplay();
        this.updateStats();
        
        // Update search input to show author name
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = authorName;
            this.searchQuery = authorName.toLowerCase();
        }
        
        // Update active nav to Book List
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        const navBooks = document.getElementById('nav-books');
        if (navBooks) {
            navBooks.classList.add('active');
        }
    }
    
    updateAuthUI() {
        const isLoggedIn = this.isUserLoggedIn();
        const authButtons = document.getElementById('auth-buttons');
        const userMenu = document.getElementById('user-menu');
        
        if (isLoggedIn) {
            // Hide auth buttons, show user menu
            if (authButtons) authButtons.style.display = 'none';
            if (userMenu) {
                userMenu.style.display = 'flex';
                const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
                const userName = document.getElementById('user-name');
                const userAvatar = document.getElementById('user-avatar');
                
                if (userName) {
                    userName.textContent = userData.name || userData.email || 'User';
                }
                if (userAvatar) {
                    const initials = (userData.name || userData.email || 'U').substring(0, 2).toUpperCase();
                    userAvatar.textContent = initials;
                    userAvatar.style.cssText = 'width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; cursor: pointer;';
                }
            }
        } else {
            // Show auth buttons, hide user menu
            if (authButtons) authButtons.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }
    }
    
    toggleUserMenu() {
        const dropdown = document.getElementById('user-menu-dropdown');
        if (dropdown) {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        } else {
            // Create dropdown if it doesn't exist
            this.createUserMenuDropdown();
        }
    }
    
    closeUserMenu() {
        const dropdown = document.getElementById('user-menu-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }
    
    createUserMenuDropdown() {
        const userMenu = document.getElementById('user-menu');
        if (!userMenu) return;
        
        let dropdown = document.getElementById('user-menu-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.id = 'user-menu-dropdown';
            dropdown.style.cssText = 'position: absolute; top: 60px; right: 20px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); min-width: 200px; z-index: 1000; overflow: hidden;';
            const t = window.translationManager ? window.translationManager.t.bind(window.translationManager) : (key, def) => def;
            dropdown.innerHTML = `
                <div style="padding: 1rem; border-bottom: 1px solid #e8ecf1;">
                    <div style="font-weight: 600; color: #2c3e50; margin-bottom: 0.25rem;" id="dropdown-user-name"></div>
                    <div style="font-size: 0.85rem; color: #7f8c8d;" id="dropdown-user-email"></div>
                </div>
                <div style="padding: 0.5rem 0;">
                    <a href="#" id="profile-link" style="display: block; padding: 0.75rem 1rem; color: #2c3e50; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">👤 ${t('user.profile', 'Profile')}</a>
                    <a href="#" id="notifications-link" style="display: block; padding: 0.75rem 1rem; color: #2c3e50; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">🔔 ${t('user.notifications', 'Notifications')}</a>
                    <a href="#" id="settings-link" style="display: block; padding: 0.75rem 1rem; color: #2c3e50; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">⚙️ ${t('user.settings', 'Settings')}</a>
                    <a href="#" id="logout-link" style="display: block; padding: 0.75rem 1rem; color: #dc3545; text-decoration: none; transition: background 0.2s; border-top: 1px solid #e8ecf1;" onmouseover="this.style.background='#fee'" onmouseout="this.style.background='white'">🚪 ${t('auth.logout', 'Logout')}</a>
                </div>
            `;
            document.body.appendChild(dropdown);
            
            // Set user info
            const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            const dropdownUserName = document.getElementById('dropdown-user-name');
            const dropdownUserEmail = document.getElementById('dropdown-user-email');
            if (dropdownUserName) dropdownUserName.textContent = userData.name || 'User';
            if (dropdownUserEmail) dropdownUserEmail.textContent = userData.email || '';
            
            // Add event listeners
            document.getElementById('profile-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.showProfile();
                this.closeUserMenu();
            });
            
            document.getElementById('notifications-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.showNotifications();
                this.closeUserMenu();
            });
            
            document.getElementById('settings-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSettings();
                this.closeUserMenu();
            });
            
            document.getElementById('logout-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
                this.closeUserMenu();
            });
        }
        
        dropdown.style.display = 'block';
    }
    
    async showProfile() {
        this.currentViewMode = 'profile';
        this.pushToHistory('profile', {});
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        // Update active nav
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        
        const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
        const username = userData.username || userData.name || 'User';
        const email = userData.email || '';
        const bio = userData.bio || userData.about_me || '';
        const avatar = userData.avatar || null;
        const userId = userData.id;
        
        // Get followers/following count from API
        let followers = 0;
        let following = 0;
        
        if (userId) {
            try {
                const [followersRes, followingRes] = await Promise.all([
                    fetch(`/api/users/${userId}/followers-count`).catch(err => ({ ok: false, status: 0 })),
                    fetch(`/api/users/${userId}/following-count`).catch(err => ({ ok: false, status: 0 }))
                ]);
                
                if (followersRes.ok) {
                    try {
                        const data = await followersRes.json();
                        followers = data.count || 0;
                    } catch (err) {
                        console.error('Error parsing followers count:', err);
                    }
                }
                
                if (followingRes.ok) {
                    try {
                        const data = await followingRes.json();
                        following = data.count || 0;
                    } catch (err) {
                        console.error('Error parsing following count:', err);
                    }
                }
            } catch (error) {
                console.error('Error fetching follower counts:', error);
            }
        }
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf profile-view';
        
        bookshelf.innerHTML = `
            <div class="profile-page">
                <div class="profile-header">
                    <div class="profile-avatar-large" style="position: relative;">
                        ${avatar ? 
                            `<img src="${this.escapeHtml(avatar)}" alt="${this.escapeHtml(username)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : 
                            ''
                        }
                        <div style="display: ${avatar ? 'none' : 'flex'}; width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); align-items: center; justify-content: center; font-size: 3rem; font-weight: 700; color: white; font-family: 'Cinzel', serif;">
                            ${(username[0] || 'U').toUpperCase()}
                        </div>
                        <input type="file" id="avatar-upload-input" accept="image/*" style="display: none;" onchange="window.bookshelf.handleAvatarUpload(event)">
                        <button onclick="document.getElementById('avatar-upload-input').click();" style="position: absolute; bottom: 0; right: 0; width: 36px; height: 36px; border-radius: 50%; background: #667eea; border: 3px solid white; color: white; font-size: 1.2rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); transition: all 0.2s;" onmouseover="this.style.background='#5568d3'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='#667eea'; this.style.transform='scale(1)'" title="Upload profile photo">📷</button>
                    </div>
                    <div class="profile-info">
                        <h2 style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">${this.escapeHtml(username)}</h2>
                        <p style="margin: 0 0 1rem 0; color: #7f8c8d; font-size: 0.95rem;">${this.escapeHtml(email)}</p>
                        <div class="profile-stats" style="display: flex; gap: 2rem; margin-top: 1rem;">
                            <div class="stat-item" style="cursor: pointer;" onclick="window.bookshelf.showFollowersList(${userId})">
                                <span class="stat-value" id="followers-count" style="cursor: pointer; text-decoration: underline;">${followers}</span>
                                <span class="stat-label">Followers</span>
                            </div>
                            <div class="stat-item" style="cursor: pointer;" onclick="window.bookshelf.showFollowingList(${userId})">
                                <span class="stat-value" id="following-count" style="cursor: pointer; text-decoration: underline;">${following}</span>
                                <span class="stat-label">Following</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="profile-tabs-section" style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e8ecf1;">
                    <div class="profile-tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 2px solid #e8ecf1;">
                        <button id="tab-about" class="profile-tab active" onclick="window.bookshelf.switchProfileTab('about')" style="padding: 0.75rem 1.5rem; background: none; border: none; border-bottom: 3px solid #667eea; color: #667eea; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s;">
                            About Me
                        </button>
                        <button id="tab-comments" class="profile-tab" onclick="window.bookshelf.switchProfileTab('comments')" style="padding: 0.75rem 1.5rem; background: none; border: none; border-bottom: 3px solid transparent; color: #7f8c8d; font-weight: 500; font-size: 1rem; cursor: pointer; transition: all 0.2s;">
                            My Comments
                        </button>
                    </div>
                    
                    <div id="tab-content-about" class="tab-content" style="display: block;">
                        <div class="bio-display" id="bio-display" style="display: ${bio ? 'block' : 'none'}; padding: 1.5rem; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-left: 4px solid #667eea; border-radius: 8px; margin-bottom: 1rem; color: #495057; line-height: 1.8; white-space: pre-wrap; font-size: 0.95rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">${this.escapeHtml(bio)}</div>
                        
                        <div class="bio-edit" id="bio-edit" style="display: ${bio ? 'none' : 'block'};">
                            <textarea id="bio-textarea" 
                                      placeholder="Add about yourself..." 
                                      style="width: 100%; min-height: 200px; padding: 1.5rem; border: 2px solid #e8ecf1; border-radius: 12px; font-family: inherit; font-size: 1rem; resize: vertical; color: #495057; line-height: 1.7; transition: all 0.3s; background: #fafbfc;"
                                      onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'; this.style.background='white';"
                                      onblur="this.style.borderColor='#e8ecf1'; this.style.boxShadow='none'; this.style.background='#fafbfc';">${this.escapeHtml(bio)}</textarea>
                            <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem; justify-content: flex-end;">
                                <button id="save-bio-btn" class="btn btn-primary" style="padding: 0.875rem 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                                    Save
                                </button>
                            </div>
                        </div>
                        
                        ${bio ? `
                            <button id="edit-bio-btn-existing" class="btn btn-secondary" style="margin-top: 1rem; padding: 0.625rem 1.25rem; background: transparent; border: 1.5px solid #667eea; border-radius: 6px; color: #667eea; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#667eea'; this.style.color='white';" onmouseout="this.style.background='transparent'; this.style.color='#667eea';">
                                Edit
                            </button>
                        ` : ''}
                    </div>
                    
                    <div id="tab-content-comments" class="tab-content" style="display: none;">
                        <div id="comments-list" style="max-height: 500px; overflow-y: auto;">
                            <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
                                <p>Loading comments...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Event listeners
        const editBioBtnExisting = document.getElementById('edit-bio-btn-existing');
        const saveBioBtn = document.getElementById('save-bio-btn');
        const bioDisplay = document.getElementById('bio-display');
        const bioEdit = document.getElementById('bio-edit');
        const bioTextarea = document.getElementById('bio-textarea');
        
        const showEdit = () => {
            if (bioDisplay) bioDisplay.style.display = 'none';
            if (bioEdit) bioEdit.style.display = 'block';
            if (editBioBtnExisting) editBioBtnExisting.style.display = 'none';
            if (bioTextarea) bioTextarea.focus();
        };
        
        if (editBioBtnExisting) {
            editBioBtnExisting.addEventListener('click', showEdit);
        }
        
        if (saveBioBtn) {
            saveBioBtn.addEventListener('click', async () => {
                const newBio = bioTextarea?.value || '';
                
                try {
                    // Update via API
                    const response = await fetch('/api/users/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('bookbar_token')}`
                        },
                        body: JSON.stringify({ bio: newBio })
                    });
                    
                    if (response.ok || response.status === 404) {
                        // Update localStorage
                        const updatedUser = { ...userData, bio: newBio, about_me: newBio };
                        localStorage.setItem('bookbar_user', JSON.stringify(updatedUser));
                        
                        // Update display
                        if (bioDisplay) {
                            bioDisplay.textContent = newBio || '';
                            bioDisplay.style.display = newBio ? 'block' : 'none';
                        }
                        
                        // Update textarea value
                        if (bioTextarea) {
                            bioTextarea.value = newBio;
                        }
                        
                        // Show/hide edit section and edit button
                        if (bioEdit) {
                            bioEdit.style.display = newBio ? 'none' : 'block';
                        }
                        
                        if (editBioBtnExisting) {
                            editBioBtnExisting.style.display = newBio ? 'block' : 'none';
                        }
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;';
                        successMsg.textContent = '✅ Profile updated!';
                        document.body.appendChild(successMsg);
                        setTimeout(() => successMsg.remove(), 3000);
                    }
                } catch (error) {
                    console.error('Error updating profile:', error);
                    alert('An error occurred while updating your profile.');
                }
            });
        }
        
        // Make followers/following counts clickable (already handled in HTML onclick)
    }
    
    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
        }
        
        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64 = e.target.result;
                
                // Update avatar via API
                const token = localStorage.getItem('bookbar_token');
                if (!token) {
                    alert('Please log in to upload avatar');
                    return;
                }
                
                try {
                    const response = await fetch('/api/users/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ avatar: base64 })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Update localStorage
                        const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
                        userData.avatar = data.user.avatar;
                        localStorage.setItem('bookbar_user', JSON.stringify(userData));
                        
                        // Reload profile to show new avatar
                        await this.showProfile();
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;';
                        successMsg.textContent = '✅ Profile photo updated!';
                        document.body.appendChild(successMsg);
                        setTimeout(() => successMsg.remove(), 3000);
                    } else {
                        const error = await response.json().catch(() => ({ error: 'Failed to upload avatar' }));
                        alert(error.error || 'Failed to upload avatar');
                    }
                } catch (error) {
                    console.error('Error uploading avatar:', error);
                    alert('An error occurred while uploading your avatar');
                }
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error reading file:', error);
            alert('An error occurred while reading the file');
        }
    }
    
    setupHistoryManagement() {
        // Listen for browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view) {
                this.navigateToView(event.state.view, event.state.params || {});
            } else {
                // If no state, try to parse from URL hash
                const hash = window.location.hash;
                if (hash) {
                    const parts = hash.substring(1).split('/');
                    const view = parts[0];
                    const params = {};
                    if (parts[1]) {
                        // Check if it's a userId (numeric) or bookAsin
                        if (/^\d+$/.test(parts[1])) {
                            params.userId = parseInt(parts[1]);
                        } else {
                            params.bookAsin = parts[1];
                        }
                    }
                    this.navigateToView(view, params);
                } else {
                    // If no hash, go to main page
                    this.navigateToView('all', {});
                }
            }
        });
        
        // Check URL on initial load
        const hash = window.location.hash;
        if (hash) {
            const parts = hash.substring(1).split('/');
            const view = parts[0];
            const params = {};
            if (parts[1]) {
                if (/^\d+$/.test(parts[1])) {
                    params.userId = parseInt(parts[1]);
                } else {
                    params.bookAsin = parts[1];
                }
            }
            // Push initial state without triggering navigation
            history.replaceState({ view, params }, '', hash);
        } else {
            // Push initial state
            this.pushToHistory('all', {}, true);
        }
    }
    
    pushToHistory(view, params = {}, replace = false) {
        // Don't add to history when navigating back (handled by navigateToView)
        if (this.isNavigatingBack) {
            return;
        }
        
        const state = { view, params };
        const url = `#${view}${params.userId ? `/${params.userId}` : ''}${params.bookAsin ? `/${params.bookAsin}` : ''}`;
        
        if (replace) {
            history.replaceState(state, '', url);
        } else {
            history.pushState(state, '', url);
        }
    }
    
    async navigateToView(view, params = {}) {
        // Set flag to prevent adding to history when navigating back
        this.isNavigatingBack = true;
        
        try {
            switch(view) {
                case 'all':
                    this.showAllBooks();
                    break;
                case 'favorites':
                    this.showFavorites();
                    break;
                case 'authors':
                    this.showAuthors();
                    break;
                case 'profile':
                    await this.showProfile();
                    break;
                case 'messages':
                    await this.showMessages();
                    break;
                case 'notifications':
                    await this.showNotifications();
                    break;
                case 'people':
                    this.showPeople();
                    break;
                case 'user-profile':
                    if (params.userId) {
                        await this.showUserProfile(params.userId);
                    }
                    break;
                case 'book-detail':
                    if (params.bookAsin) {
                        const book = this.books.find(b => b.asin === params.bookAsin);
                        if (book) {
                            this.showBookDetailPage(book);
                        }
                    }
                    break;
                case 'conversation':
                    if (params.userId) {
                        await this.showConversation(params.userId);
                    }
                    break;
                default:
                    this.showAllBooks();
            }
        } finally {
            // Reset flag after navigation completes
            setTimeout(() => {
                this.isNavigatingBack = false;
            }, 100);
        }
    }
    
    switchProfileTab(tab) {
        const tabAbout = document.getElementById('tab-about');
        const tabComments = document.getElementById('tab-comments');
        const contentAbout = document.getElementById('tab-content-about');
        const contentComments = document.getElementById('tab-content-comments');
        
        if (tab === 'about') {
            if (tabAbout) {
                tabAbout.classList.add('active');
                tabAbout.style.borderBottomColor = '#667eea';
                tabAbout.style.color = '#667eea';
                tabAbout.style.fontWeight = '600';
            }
            if (tabComments) {
                tabComments.classList.remove('active');
                tabComments.style.borderBottomColor = 'transparent';
                tabComments.style.color = '#7f8c8d';
                tabComments.style.fontWeight = '500';
            }
            if (contentAbout) contentAbout.style.display = 'block';
            if (contentComments) contentComments.style.display = 'none';
        } else if (tab === 'comments') {
            if (tabAbout) {
                tabAbout.classList.remove('active');
                tabAbout.style.borderBottomColor = 'transparent';
                tabAbout.style.color = '#7f8c8d';
                tabAbout.style.fontWeight = '500';
            }
            if (tabComments) {
                tabComments.classList.add('active');
                tabComments.style.borderBottomColor = '#667eea';
                tabComments.style.color = '#667eea';
                tabComments.style.fontWeight = '600';
            }
            if (contentAbout) contentAbout.style.display = 'none';
            if (contentComments) contentComments.style.display = 'block';
            
            // Load comments when switching to comments tab
            const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            if (userData.id) {
                this.loadUserComments(userData.id);
            }
        }
    }
    
    async showNotifications() {
        this.currentViewMode = 'notifications';
        this.pushToHistory('notifications', {});
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        // Update active nav
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf notifications-view';
        
        bookshelf.innerHTML = `
            <div class="notifications-page">
                <div class="notifications-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecf1;">
                    <h2 style="margin: 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">Notifications</h2>
                    <button id="mark-all-read-btn-notifications" style="padding: 0.5rem 1rem; background: #667eea; border: none; border-radius: 6px; color: white; font-weight: 500; font-size: 0.85rem; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#5568d3';" onmouseout="this.style.background='#667eea';">
                        Mark all as read
                    </button>
                </div>
                
                <div id="notifications-list-page" style="max-height: 600px; overflow-y: auto;">
                    <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
                        <p>Loading notifications...</p>
                    </div>
                </div>
            </div>
        `;
        
        // Load notifications
        await this.loadNotificationsPage();
        
        // Mark all as read button
        const markAllReadBtn = document.getElementById('mark-all-read-btn-notifications');
        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', async () => {
                await this.markAllNotificationsRead();
                await this.loadNotificationsPage();
            });
        }
    }
    
    async loadNotificationsPage() {
        const notificationsList = document.getElementById('notifications-list-page');
        if (!notificationsList) return;
        
        const token = localStorage.getItem('bookbar_token');
        if (!token) {
            notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to see notifications</p></div>';
            return;
        }
        
        try {
            const response = await fetch('/api/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const notifications = data.notifications || [];
                
                if (notifications.length === 0) {
                    notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No notifications yet</p></div>';
                } else {
                    notificationsList.innerHTML = notifications.map(notif => `
                        <div class="notification-item" data-notification-id="${notif.id}" style="padding: 1rem; margin-bottom: 0.75rem; background: ${notif.is_read ? '#f8f9fa' : '#ffffff'}; border-left: 4px solid ${notif.is_read ? '#95a5a6' : '#667eea'}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: all 0.2s;" 
                             onmouseover="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'; this.style.transform='translateX(4px)'"
                             onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'; this.style.transform='translateX(0)'"
                             onclick="window.bookshelf.markNotificationAsRead(${notif.id}); window.bookshelf.loadNotificationsPage();">
                            <div style="display: flex; align-items: start; gap: 1rem;">
                                <div style="flex: 1;">
                                    <p style="margin: 0; color: #2c3e50; font-size: 0.95rem; line-height: 1.5;">${this.escapeHtml(notif.message)}</p>
                                    <p style="margin: 0.5rem 0 0 0; color: #7f8c8d; font-size: 0.85rem;">${this.formatDate(notif.createdAt)}</p>
                                    ${notif.type === 'message' && notif.related_user_id ? `<p style="margin: 0.5rem 0 0 0;"><a href="#" onclick="event.preventDefault(); window.bookshelf.markNotificationAsRead(${notif.id}); window.bookshelf.showConversation(${notif.related_user_id}); return false;" style="color: #667eea; text-decoration: none; font-size: 0.85rem;">View message →</a></p>` : ''}
                                    ${notif.type === 'follow' && notif.related_user_id ? `<p style="margin: 0.5rem 0 0 0;"><a href="#" onclick="event.preventDefault(); window.bookshelf.showUserProfile(${notif.related_user_id}); return false;" style="color: #667eea; text-decoration: none; font-size: 0.85rem;">View profile →</a></p>` : ''}
                                </div>
                                ${!notif.is_read ? '<div style="width: 10px; height: 10px; background: #667eea; border-radius: 50%; flex-shrink: 0; margin-top: 0.25rem;"></div>' : ''}
                            </div>
                        </div>
                    `).join('');
                }
            } else {
                notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Failed to load notifications</p></div>';
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading notifications</p></div>';
        }
    }
    
    async loadNotifications() {
        const notificationsList = document.getElementById('notifications-list');
        if (!notificationsList) return;
        
        const token = localStorage.getItem('bookbar_token');
        if (!token) {
            notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to see notifications</p></div>';
            return;
        }
        
        try {
            const response = await fetch('/api/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const notifications = data.notifications || [];
                
                if (notifications.length === 0) {
                    notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No notifications yet</p></div>';
                } else {
                    notificationsList.innerHTML = notifications.map(notif => `
                        <div class="notification-item" data-notification-id="${notif.id}" style="padding: 1rem; margin-bottom: 0.75rem; background: ${notif.is_read ? '#f8f9fa' : '#ffffff'}; border-left: 4px solid ${notif.is_read ? '#95a5a6' : '#667eea'}; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: all 0.2s;" 
                             onmouseover="this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'; this.style.transform='translateX(4px)'"
                             onmouseout="this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'; this.style.transform='translateX(0)'"
                             onclick="window.bookshelf.markNotificationAsRead(${notif.id})">
                            <div style="display: flex; align-items: start; gap: 1rem;">
                                <div style="flex: 1;">
                                    <p style="margin: 0; color: #2c3e50; font-size: 0.95rem; line-height: 1.5;">${this.escapeHtml(notif.message)}</p>
                                    <p style="margin: 0.5rem 0 0 0; color: #7f8c8d; font-size: 0.85rem;">${this.formatDate(notif.createdAt)}</p>
                                    ${notif.type === 'follow' && notif.related_user_id ? `<p style="margin: 0.5rem 0 0 0;"><a href="#" onclick="event.preventDefault(); window.bookshelf.showUserProfile(${notif.related_user_id}); return false;" style="color: #667eea; text-decoration: none; font-size: 0.85rem;">View profile →</a></p>` : ''}
                                </div>
                                ${!notif.is_read ? '<div style="width: 10px; height: 10px; background: #667eea; border-radius: 50%; flex-shrink: 0; margin-top: 0.25rem;"></div>' : ''}
                            </div>
                        </div>
                    `).join('');
                }
                
                // Update follower count if profile is visible
                if (this.currentViewMode === 'profile') {
                    await this.updateFollowerCounts();
                }
            } else {
                notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Failed to load notifications</p></div>';
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            notificationsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading notifications</p></div>';
        }
    }
    
    async markNotificationAsRead(notificationId) {
        const token = localStorage.getItem('bookbar_token');
        if (!token) return;
        
        try {
            const response = await fetch(`/api/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                // Reload notifications
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    async markAllNotificationsRead() {
        const token = localStorage.getItem('bookbar_token');
        if (!token) return;
        
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                // Reload notifications
                await this.loadNotifications();
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    }
    
    startNotificationPolling() {
        // Only poll if user is logged in
        const token = localStorage.getItem('bookbar_token');
        if (!token) return;
        
        // Clear any existing interval
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
        }
        
        // Check for new notifications every 10 seconds
        this.notificationCheckInterval = setInterval(async () => {
            await this.checkForNewNotifications();
        }, 10000); // 10 seconds
        
        // Check immediately on start
        this.checkForNewNotifications();
    }
    
    stopNotificationPolling() {
        if (this.notificationCheckInterval) {
            clearInterval(this.notificationCheckInterval);
            this.notificationCheckInterval = null;
        }
    }
    
    async checkForNewNotifications() {
        const token = localStorage.getItem('bookbar_token');
        if (!token) {
            this.stopNotificationPolling();
            return;
        }
        
        try {
            const response = await fetch('/api/notifications', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const notifications = data.notifications || [];
                
                // Filter for unread notifications
                const unreadNotifications = notifications.filter(n => !n.is_read);
                
                // Check if there are new notifications since last check
                if (this.lastNotificationCheck !== null && unreadNotifications.length > 0) {
                    const newNotifications = unreadNotifications.filter(n => {
                        const notifTime = new Date(n.createdAt).getTime();
                        return notifTime > this.lastNotificationCheck;
                    });
                    
                    // Show toast for new message notifications
                    newNotifications.forEach(notif => {
                        if (notif.type === 'message') {
                            this.showNotificationToast(notif);
                        }
                    });
                } else if (this.lastNotificationCheck === null && unreadNotifications.length > 0) {
                    // First check - don't show notifications, just set the timestamp
                    // This prevents showing old notifications on page load
                }
                
                // Update last check time
                if (unreadNotifications.length > 0) {
                    const latestTime = Math.max(...unreadNotifications.map(n => new Date(n.createdAt).getTime()));
                    if (this.lastNotificationCheck === null) {
                        // First check - set to latest notification time so we only show new ones
                        this.lastNotificationCheck = latestTime;
                    } else {
                        // Update to latest time
                        this.lastNotificationCheck = latestTime;
                    }
                } else {
                    // No unread notifications - set to current time
                    if (this.lastNotificationCheck === null) {
                        this.lastNotificationCheck = Date.now();
                    }
                }
            }
        } catch (error) {
            console.error('Error checking for notifications:', error);
        }
    }
    
    showNotificationToast(notification) {
        // Remove any existing toast
        const existingToast = document.getElementById('notification-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.id = 'notification-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-left: 4px solid #667eea;
            border-radius: 8px;
            padding: 1rem 1.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        if (!document.getElementById('notification-toast-style')) {
            style.id = 'notification-toast-style';
            document.head.appendChild(style);
        }
        
        const messagePreview = notification.message.length > 60 
            ? notification.message.substring(0, 60) + '...' 
            : notification.message;
        
        toast.innerHTML = `
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="flex: 1;">
                    <p style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 0.95rem; font-weight: 600;">💬 New Message</p>
                    <p style="margin: 0; color: #495057; font-size: 0.9rem; line-height: 1.4;">${this.escapeHtml(messagePreview)}</p>
                    ${notification.related_user_id ? `
                        <button onclick="window.bookshelf.showConversation(${notification.related_user_id}); document.getElementById('notification-toast').remove();" 
                                style="margin-top: 0.75rem; padding: 0.5rem 1rem; background: #667eea; border: none; border-radius: 6px; color: white; font-size: 0.85rem; cursor: pointer; font-weight: 500;">
                            View Message
                        </button>
                    ` : ''}
                </div>
                <button onclick="document.getElementById('notification-toast').remove();" 
                        style="background: none; border: none; color: #7f8c8d; font-size: 1.2rem; cursor: pointer; padding: 0; line-height: 1;">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
    
    async showFollowersList(userId) {
        this.currentViewMode = 'followers';
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf followers-view';
        
        bookshelf.innerHTML = `
            <div class="followers-page">
                <div class="followers-header" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecf1;">
                    <h2 style="margin: 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">Followers</h2>
                </div>
                
                <div id="followers-list" style="display: grid; gap: 1rem;">
                    <div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Loading followers...</p></div>
                </div>
            </div>
        `;
        
        try {
            const response = await fetch(`/api/users/${userId}/followers`);
            
            if (!response.ok) {
                if (response.status === 404 || response.status === 0) {
                    document.getElementById('followers-list').innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No followers yet</p></div>';
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const followers = data.followers || [];
            
            const followersList = document.getElementById('followers-list');
            if (!followersList) return;
            
            if (followers.length === 0) {
                followersList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No followers yet</p></div>';
                return;
            }
            
            // Get current user ID
            const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            const currentUserId = currentUser.id;
            
            // Load follow status for each follower
            const followersWithStatus = await Promise.all(followers.map(async (follower) => {
                if (follower.id === currentUserId) {
                    return { ...follower, isFollowing: false, isSelf: true };
                }
                const isFollowing = await this.checkFollowStatus(follower.id);
                return { ...follower, isFollowing, isSelf: false };
            }));
            
            followersList.innerHTML = followersWithStatus.map(follower => {
                const username = follower.username || follower.name || 'Unknown';
                const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
                const isFollowing = follower.isFollowing;
                const isSelf = follower.isSelf;
                
                return `
                    <div class="follower-card" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 1.5rem; transition: all 0.2s;" 
                         onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'"
                         onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
                        <div class="user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; font-family: 'Cinzel', serif; flex-shrink: 0; cursor: pointer;" 
                             onclick="window.bookshelf.showUserProfile(${follower.id})">
                            ${avatarLetter}
                        </div>
                        <div style="flex: 1; cursor: pointer;" onclick="window.bookshelf.showUserProfile(${follower.id})">
                            <h3 style="margin: 0 0 0.25rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">${this.escapeHtml(username)}</h3>
                            ${follower.bio ? `<p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${this.escapeHtml(follower.bio)}</p>` : ''}
                        </div>
                        ${!isSelf ? `
                            <button class="btn-follow-follower" data-user-id="${follower.id}" data-is-following="${isFollowing}" 
                                    style="padding: 0.5rem 1.5rem; background: ${isFollowing ? '#6c757d' : '#667eea'}; border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
                                    onmouseover="if (this.getAttribute('data-is-following') === 'true') { this.style.background='#dc3545'; this.textContent='Unfollow'; } else { this.style.background='#5568d3'; }"
                                    onmouseout="if (this.getAttribute('data-is-following') === 'true') { this.style.background='#6c757d'; this.textContent='Following'; } else { this.style.background='#667eea'; }">
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');
            
            // Attach follow button listeners
            followersList.querySelectorAll('.btn-follow-follower').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const targetUserId = parseInt(btn.getAttribute('data-user-id'));
                    const isFollowing = btn.getAttribute('data-is-following') === 'true';
                    await this.toggleFollow(targetUserId, btn, isFollowing);
                });
            });
        } catch (error) {
            console.error('Error loading followers:', error);
            const followersList = document.getElementById('followers-list');
            if (followersList) {
                followersList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading followers. Please check if server is running.</p></div>';
            }
        }
    }
    
    async showFollowingList(userId) {
        this.currentViewMode = 'following';
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf following-view';
        
        bookshelf.innerHTML = `
            <div class="following-page">
                <div class="following-header" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecf1;">
                    <h2 style="margin: 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">Following</h2>
                </div>
                
                <div id="following-list" style="display: grid; gap: 1rem;">
                    <div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Loading following...</p></div>
                </div>
            </div>
        `;
        
        try {
            const response = await fetch(`/api/users/${userId}/following`);
            
            if (!response.ok) {
                if (response.status === 404 || response.status === 0) {
                    document.getElementById('following-list').innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Not following anyone yet</p></div>';
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const following = data.following || [];
            
            const followingList = document.getElementById('following-list');
            if (!followingList) return;
            
            if (following.length === 0) {
                followingList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Not following anyone yet</p></div>';
                return;
            }
            
            // Get current user ID
            const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            const currentUserId = currentUser.id;
            
            // Load follow status for each following user
            const followingWithStatus = await Promise.all(following.map(async (user) => {
                if (user.id === currentUserId) {
                    return { ...user, isFollowing: false, isSelf: true };
                }
                const isFollowing = await this.checkFollowStatus(user.id);
                return { ...user, isFollowing, isSelf: false };
            }));
            
            followingList.innerHTML = followingWithStatus.map(user => {
                const username = user.username || user.name || 'Unknown';
                const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
                const isFollowing = user.isFollowing;
                const isSelf = user.isSelf;
                
                return `
                    <div class="following-card" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 1.5rem; transition: all 0.2s;" 
                         onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'"
                         onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
                        <div class="user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; font-family: 'Cinzel', serif; flex-shrink: 0; cursor: pointer;" 
                             onclick="window.bookshelf.showUserProfile(${user.id})">
                            ${avatarLetter}
                        </div>
                        <div style="flex: 1; cursor: pointer;" onclick="window.bookshelf.showUserProfile(${user.id})">
                            <h3 style="margin: 0 0 0.25rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">${this.escapeHtml(username)}</h3>
                            ${user.bio ? `<p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${this.escapeHtml(user.bio)}</p>` : ''}
                        </div>
                        ${!isSelf ? `
                            <button class="btn-follow-following" data-user-id="${user.id}" data-is-following="${isFollowing}" 
                                    style="padding: 0.5rem 1.5rem; background: ${isFollowing ? '#6c757d' : '#667eea'}; border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; flex-shrink: 0;"
                                    onmouseover="if (this.getAttribute('data-is-following') === 'true') { this.style.background='#dc3545'; this.textContent='Unfollow'; } else { this.style.background='#5568d3'; }"
                                    onmouseout="if (this.getAttribute('data-is-following') === 'true') { this.style.background='#6c757d'; this.textContent='Following'; } else { this.style.background='#667eea'; }">
                                ${isFollowing ? 'Following' : 'Follow'}
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');
            
            // Attach follow button listeners
            followingList.querySelectorAll('.btn-follow-following').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const targetUserId = parseInt(btn.getAttribute('data-user-id'));
                    const isFollowing = btn.getAttribute('data-is-following') === 'true';
                    await this.toggleFollow(targetUserId, btn, isFollowing);
                });
            });
        } catch (error) {
            console.error('Error loading following:', error);
            const followingList = document.getElementById('following-list');
            if (followingList) {
                followingList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading following. Please check if server is running.</p></div>';
            }
        }
    }
    
    async showUserProfile(userId) {
        this.currentViewMode = 'user-profile';
        this.pushToHistory('user-profile', { userId });
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf user-profile-view';
        
        try {
            // Get user info
            const userResponse = await fetch(`/api/users/${userId}`);
            const userData = await userResponse.json();
            const user = userData.user;
            
            if (!user) {
                bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>User not found</p></div>';
                return;
            }
            
            // Get followers/following count
            const [followersRes, followingRes] = await Promise.all([
                fetch(`/api/users/${userId}/followers-count`),
                fetch(`/api/users/${userId}/following-count`)
            ]);
            
            let followers = 0;
            let following = 0;
            
            if (followersRes.ok) {
                const data = await followersRes.json();
                followers = data.count || 0;
            }
            
            if (followingRes.ok) {
                const data = await followingRes.json();
                following = data.count || 0;
            }
            
            const username = user.username || user.name || 'User';
            const email = user.email || '';
            const bio = user.bio || '';
            
            // Check if this is current user's own profile
            const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            const currentUserId = currentUser.id;
            const isOwnProfile = parseInt(userId) === currentUserId;
            
            // Check follow status if not own profile
            let isFollowing = false;
            let isMutualFollow = false;
            if (!isOwnProfile) {
                isFollowing = await this.checkFollowStatus(userId);
                // Check if mutual follow (both following each other)
                if (isFollowing) {
                    isMutualFollow = await this.checkMutualFollow(userId);
                }
            }
            
            bookshelf.innerHTML = `
                <div class="profile-page">
                    <div class="profile-header">
                        <div class="profile-avatar-large">
                            ${(username[0] || 'U').toUpperCase()}
                        </div>
                        <div class="profile-info">
                            <h2 style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">${this.escapeHtml(username)}</h2>
                            <p style="margin: 0 0 1rem 0; color: #7f8c8d; font-size: 0.95rem;">${this.escapeHtml(email)}</p>
                            <div class="profile-stats" style="display: flex; gap: 2rem; margin-top: 1rem;">
                                <div class="stat-item" style="cursor: pointer;" onclick="window.bookshelf.showFollowersList(${userId})">
                                    <span class="stat-value" style="cursor: pointer; text-decoration: underline;">${followers}</span>
                                    <span class="stat-label">Followers</span>
                                </div>
                                <div class="stat-item" style="cursor: pointer;" onclick="window.bookshelf.showFollowingList(${userId})">
                                    <span class="stat-value" style="cursor: pointer; text-decoration: underline;">${following}</span>
                                    <span class="stat-label">Following</span>
                                </div>
                            </div>
                            ${!isOwnProfile ? `
                                <div style="margin-top: 1.5rem; display: flex; gap: 1rem; align-items: center;">
                                    <button class="btn-follow-profile" data-user-id="${userId}" data-is-following="${isFollowing}" 
                                            style="padding: 0.75rem 2rem; background: ${isFollowing ? '#6c757d' : '#667eea'}; border: none; border-radius: 10px; color: white; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);"
                                            onmouseover="if (this.getAttribute('data-is-following') === 'true') { this.style.background='#dc3545'; this.textContent='Unfollow'; this.style.boxShadow='0 4px 12px rgba(220, 53, 69, 0.3)'; } else { this.style.background='#5568d3'; this.style.boxShadow='0 6px 16px rgba(102, 126, 234, 0.4)'; }"
                                            onmouseout="if (this.getAttribute('data-is-following') === 'true') { this.style.background='#6c757d'; this.textContent='Following'; this.style.boxShadow='0 4px 12px rgba(108, 117, 125, 0.3)'; } else { this.style.background='#667eea'; this.style.boxShadow='0 4px 12px rgba(102, 126, 234, 0.3)'; }">
                                        ${isFollowing ? 'Following' : 'Follow'}
                                    </button>
                                    ${isMutualFollow ? `
                                        <button class="btn-message-profile" data-user-id="${userId}" data-username="${this.escapeHtml(username)}"
                                                style="padding: 0.75rem 1.5rem; background: #28a745; border: none; border-radius: 10px; color: white; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3); display: flex; align-items: center; gap: 0.5rem;"
                                                onmouseover="this.style.background='#218838'; this.style.boxShadow='0 6px 16px rgba(40, 167, 69, 0.4)';"
                                                onmouseout="this.style.background='#28a745'; this.style.boxShadow='0 4px 12px rgba(40, 167, 69, 0.3)';">
                                            <span style="font-size: 1.2rem;">💬</span>
                                            <span>Message</span>
                                        </button>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${bio ? `
                        <div class="profile-about-section" style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e8ecf1;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                                <h3 style="margin: 0; color: #2c3e50; font-size: 1.4rem; font-weight: 600; letter-spacing: -0.5px;">About</h3>
                            </div>
                            
                            <div class="bio-display" style="padding: 1.5rem; background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%); border-left: 4px solid #667eea; border-radius: 8px; color: #495057; line-height: 1.8; white-space: pre-wrap; font-size: 0.95rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                                ${this.escapeHtml(bio)}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Attach follow button listener if not own profile
            if (!isOwnProfile) {
                const followBtn = bookshelf.querySelector('.btn-follow-profile');
                if (followBtn) {
                    followBtn.addEventListener('click', async (e) => {
                        const targetUserId = parseInt(followBtn.getAttribute('data-user-id'));
                        const isFollowing = followBtn.getAttribute('data-is-following') === 'true';
                        await this.toggleFollow(targetUserId, followBtn, isFollowing);
                        
                        // Check mutual follow status after follow/unfollow
                        const newIsFollowing = followBtn.getAttribute('data-is-following') === 'true';
                        if (newIsFollowing) {
                            const newIsMutual = await this.checkMutualFollow(targetUserId);
                            // Reload profile to show/hide message button
                            if (newIsMutual !== isMutualFollow) {
                                await this.showUserProfile(targetUserId);
                            }
                        } else {
                            // If unfollowed, hide message button by reloading
                            if (isMutualFollow) {
                                await this.showUserProfile(targetUserId);
                            }
                        }
                        
                        // Update follower count after follow/unfollow
                        const [followersRes] = await Promise.all([
                            fetch(`/api/users/${targetUserId}/followers-count`)
                        ]);
                        if (followersRes.ok) {
                            const data = await followersRes.json();
                            const statItems = bookshelf.querySelectorAll('.stat-value');
                            if (statItems.length > 0) {
                                statItems[0].textContent = data.count || 0;
                            }
                        }
                    });
                }
                
                // Attach message button listener if mutual follow
                const messageBtn = bookshelf.querySelector('.btn-message-profile');
                if (messageBtn) {
                    messageBtn.addEventListener('click', async (e) => {
                        const targetUserId = parseInt(messageBtn.getAttribute('data-user-id'));
                        // Navigate to messages and open conversation with this user
                        await this.showConversation(targetUserId);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading user profile</p></div>';
        }
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 7) {
            return date.toLocaleDateString();
        } else if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'Just now';
        }
    }
    
    async updateFollowerCounts() {
        const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
        const userId = userData.id;
        
        if (!userId) return;
        
        try {
            const [followersRes, followingRes] = await Promise.all([
                fetch(`/api/users/${userId}/followers-count`).catch(err => {
                    console.error('Error fetching followers count:', err);
                    return { ok: false, status: 0 };
                }),
                fetch(`/api/users/${userId}/following-count`).catch(err => {
                    console.error('Error fetching following count:', err);
                    return { ok: false, status: 0 };
                })
            ]);
            
            if (followersRes.ok) {
                try {
                    const data = await followersRes.json();
                    const followersCount = document.getElementById('followers-count');
                    if (followersCount) {
                        followersCount.textContent = data.count || 0;
                    }
                } catch (err) {
                    console.error('Error parsing followers count response:', err);
                }
            } else {
                console.error('Followers count response not ok:', followersRes.status);
            }
            
            if (followingRes.ok) {
                try {
                    const data = await followingRes.json();
                    const followingCount = document.getElementById('following-count');
                    if (followingCount) {
                        followingCount.textContent = data.count || 0;
                    }
                } catch (err) {
                    console.error('Error parsing following count response:', err);
                }
            } else {
                console.error('Following count response not ok:', followingRes.status);
            }
        } catch (error) {
            console.error('Error updating follower counts:', error);
        }
    }
    
    showSettings() {
        this.currentViewMode = 'settings';
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        // Update active nav
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf settings-view';
        
        const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
        const currentUsername = userData.username || userData.name || 'User';
        
        bookshelf.innerHTML = `
            <div class="settings-page">
                <div class="settings-header" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecf1;">
                    <h2 style="margin: 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">Settings</h2>
                </div>
                
                <div class="settings-content">
                    <!-- Username Section -->
                    <div class="settings-section" style="margin-bottom: 2.5rem; padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <h3 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 1.3rem; font-weight: 600;">Change Username</h3>
                        <p style="margin: 0 0 1rem 0; color: #7f8c8d; font-size: 0.9rem;">Current username: <strong style="color: #2c3e50;">${this.escapeHtml(currentUsername)}</strong></p>
                        
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="new-username" style="display: block; margin-bottom: 0.5rem; color: #2c3e50; font-weight: 500; font-size: 0.95rem;">New Username</label>
                            <input type="text" id="new-username" placeholder="Enter new username" value=""
                                   style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #e8ecf1; border-radius: 8px; font-size: 0.95rem; transition: all 0.3s; box-sizing: border-box;"
                                   onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'"
                                   onblur="this.style.borderColor='#e8ecf1'; this.style.boxShadow='none'">
                            <div id="username-error" class="field-error" style="display: none; color: #e74c3c; font-size: 0.85rem; margin-top: 0.5rem;"></div>
                        </div>
                        
                        <button id="save-username-btn" class="btn btn-primary" 
                                style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.95rem; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 12px rgba(102, 126, 234, 0.4)'"
                                onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px rgba(102, 126, 234, 0.3)'">
                            Save Username
                        </button>
                    </div>
                    
                    <!-- Password Section -->
                    <div class="settings-section" style="padding: 1.5rem; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                        <h3 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 1.3rem; font-weight: 600;">Change Password</h3>
                        
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="current-password" style="display: block; margin-bottom: 0.5rem; color: #2c3e50; font-weight: 500; font-size: 0.95rem;">Current Password <span style="color: #e74c3c;">*</span></label>
                            <input type="password" id="current-password" placeholder="Enter your current password to enable new password fields" value="" required
                                   style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #e8ecf1; border-radius: 8px; font-size: 0.95rem; transition: all 0.3s; box-sizing: border-box;"
                                   onfocus="this.style.borderColor='#667eea'; this.style.boxShadow='0 0 0 3px rgba(102, 126, 234, 0.1)'"
                                   onblur="this.style.borderColor='#e8ecf1'; this.style.boxShadow='none'">
                            <div id="current-password-error" class="field-error" style="display: none; color: #e74c3c; font-size: 0.85rem; margin-top: 0.5rem;"></div>
                            <div id="current-password-success" class="field-success" style="display: none; color: #4caf50; font-size: 0.85rem; margin-top: 0.5rem;">✓ Password verified. You can now change your password.</div>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="new-password" style="display: block; margin-bottom: 0.5rem; color: #2c3e50; font-weight: 500; font-size: 0.95rem;">New Password</label>
                            <input type="password" id="new-password" placeholder="Enter new password (min. 6 characters)" 
                                   style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #e8ecf1; border-radius: 8px; font-size: 0.95rem; transition: all 0.3s; box-sizing: border-box; background: #f5f5f5;"
                                   disabled>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="confirm-password" style="display: block; margin-bottom: 0.5rem; color: #2c3e50; font-weight: 500; font-size: 0.95rem;">Confirm New Password</label>
                            <input type="password" id="confirm-password" placeholder="Confirm new password" 
                                   style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #e8ecf1; border-radius: 8px; font-size: 0.95rem; transition: all 0.3s; box-sizing: border-box; background: #f5f5f5;"
                                   disabled>
                            <div id="password-error" class="field-error" style="display: none; color: #e74c3c; font-size: 0.85rem; margin-top: 0.5rem;"></div>
                        </div>
                        
                        <button id="save-password-btn" class="btn btn-primary" 
                                style="padding: 0.75rem 1.5rem; background: #95a5a6; border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.95rem; cursor: not-allowed; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 6px rgba(149, 165, 166, 0.3);"
                                disabled>
                            Change Password
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Event listeners
        const saveUsernameBtn = document.getElementById('save-username-btn');
        const savePasswordBtn = document.getElementById('save-password-btn');
        const usernameError = document.getElementById('username-error');
        const passwordError = document.getElementById('password-error');
        const currentPasswordInput = document.getElementById('current-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const currentPasswordError = document.getElementById('current-password-error');
        const currentPasswordSuccess = document.getElementById('current-password-success');
        
        let passwordVerified = false;
        let passwordCheckTimeout;
        
        // Real-time password verification
        if (currentPasswordInput) {
            currentPasswordInput.addEventListener('input', async (e) => {
                clearTimeout(passwordCheckTimeout);
                const currentPassword = e.target.value.trim();
                
                // Hide previous messages
                if (currentPasswordError) currentPasswordError.style.display = 'none';
                if (currentPasswordSuccess) currentPasswordSuccess.style.display = 'none';
                
                // Disable new password fields by default
                passwordVerified = false;
                if (newPasswordInput) {
                    newPasswordInput.disabled = true;
                    newPasswordInput.style.background = '#f5f5f5';
                }
                if (confirmPasswordInput) {
                    confirmPasswordInput.disabled = true;
                    confirmPasswordInput.style.background = '#f5f5f5';
                }
                if (savePasswordBtn) {
                    savePasswordBtn.disabled = true;
                    savePasswordBtn.style.background = '#95a5a6';
                    savePasswordBtn.style.cursor = 'not-allowed';
                }
                
                // If empty, don't check
                if (!currentPassword) {
                    return;
                }
                
                // Debounce: wait 500ms after user stops typing
                passwordCheckTimeout = setTimeout(async () => {
                    try {
                        const token = localStorage.getItem('bookbar_token');
                        if (!token) {
                            console.error('No token found');
                            if (currentPasswordError) {
                                currentPasswordError.textContent = 'Please log in first';
                                currentPasswordError.style.display = 'block';
                            }
                            return;
                        }
                        
                        const response = await fetch('/api/users/verify-password', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({ currentPassword })
                        });
                        
                        if (!response.ok) {
                            console.error('Verify password response not ok:', response.status);
                            if (currentPasswordError) {
                                currentPasswordError.textContent = 'Failed to verify password. Please try again.';
                                currentPasswordError.style.display = 'block';
                            }
                            return;
                        }
                        
                        const result = await response.json();
                        console.log('Verify password result:', result);
                        
                        if (result.success && result.valid) {
                            // Password is correct - enable new password fields
                            passwordVerified = true;
                            if (currentPasswordSuccess) currentPasswordSuccess.style.display = 'block';
                            if (currentPasswordError) currentPasswordError.style.display = 'none';
                            
                            if (newPasswordInput) {
                                newPasswordInput.disabled = false;
                                newPasswordInput.style.background = 'white';
                                newPasswordInput.removeAttribute('readonly');
                            }
                            if (confirmPasswordInput) {
                                confirmPasswordInput.disabled = false;
                                confirmPasswordInput.style.background = 'white';
                                confirmPasswordInput.removeAttribute('readonly');
                            }
                            if (savePasswordBtn) {
                                savePasswordBtn.disabled = false;
                                savePasswordBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                                savePasswordBtn.style.cursor = 'pointer';
                            }
                        } else {
                            // Password is incorrect
                            passwordVerified = false;
                            if (currentPasswordError) {
                                currentPasswordError.textContent = 'Current password is incorrect';
                                currentPasswordError.style.display = 'block';
                            }
                            if (currentPasswordSuccess) currentPasswordSuccess.style.display = 'none';
                        }
                    } catch (error) {
                        console.error('Error verifying password:', error);
                        // On error, don't enable fields
                        passwordVerified = false;
                        if (currentPasswordError) {
                            currentPasswordError.textContent = 'Error verifying password. Please check if server is running.';
                            currentPasswordError.style.display = 'block';
                        }
                    }
                }, 500);
            });
        }
        
        if (saveUsernameBtn) {
            saveUsernameBtn.addEventListener('click', async () => {
                const newUsername = document.getElementById('new-username')?.value.trim();
                
                if (!newUsername) {
                    if (usernameError) {
                        usernameError.textContent = 'Please enter a new username';
                        usernameError.style.display = 'block';
                    }
                    return;
                }
                
                if (newUsername === currentUsername) {
                    if (usernameError) {
                        usernameError.textContent = 'New username must be different from current username';
                        usernameError.style.display = 'block';
                    }
                    return;
                }
                
                if (usernameError) usernameError.style.display = 'none';
                
                try {
                    const token = localStorage.getItem('bookbar_token');
                    const response = await fetch('/api/users/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ username: newUsername })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        // Update localStorage
                        const updatedUser = { ...userData, username: newUsername, name: newUsername };
                        localStorage.setItem('bookbar_user', JSON.stringify(updatedUser));
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;';
                        successMsg.textContent = '✅ Username updated successfully!';
                        document.body.appendChild(successMsg);
                        setTimeout(() => successMsg.remove(), 3000);
                        
                        // Reload settings page to show new username
                        this.showSettings();
                    } else {
                        if (usernameError) {
                            usernameError.textContent = result.error || 'Failed to update username';
                            usernameError.style.display = 'block';
                        }
                    }
                } catch (error) {
                    console.error('Error updating username:', error);
                    if (usernameError) {
                        usernameError.textContent = 'An error occurred. Please try again.';
                        usernameError.style.display = 'block';
                    }
                }
            });
        }
        
        if (savePasswordBtn) {
            savePasswordBtn.addEventListener('click', async () => {
                const currentPassword = currentPasswordInput?.value.trim() || '';
                const newPassword = newPasswordInput?.value || '';
                const confirmPassword = confirmPasswordInput?.value || '';
                
                if (passwordError) passwordError.style.display = 'none';
                if (currentPasswordError) currentPasswordError.style.display = 'none';
                
                // Current password is required
                if (!currentPassword) {
                    if (currentPasswordError) {
                        currentPasswordError.textContent = 'Current password is required';
                        currentPasswordError.style.display = 'block';
                    }
                    return;
                }
                
                // Check if password is verified
                if (!passwordVerified) {
                    if (passwordError) {
                        passwordError.textContent = 'Please verify your current password first';
                        passwordError.style.display = 'block';
                    }
                    return;
                }
                
                if (!newPassword || !confirmPassword) {
                    if (passwordError) {
                        passwordError.textContent = 'New password and confirmation are required';
                        passwordError.style.display = 'block';
                    }
                    return;
                }
                
                if (newPassword.length < 6) {
                    if (passwordError) {
                        passwordError.textContent = 'New password must be at least 6 characters long';
                        passwordError.style.display = 'block';
                    }
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    if (passwordError) {
                        passwordError.textContent = 'New passwords do not match';
                        passwordError.style.display = 'block';
                    }
                    return;
                }
                
                try {
                    const token = localStorage.getItem('bookbar_token');
                    const response = await fetch('/api/users/password', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ 
                            currentPassword, 
                            newPassword 
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        // Clear password fields
                        if (currentPasswordInput) currentPasswordInput.value = '';
                        if (newPasswordInput) newPasswordInput.value = '';
                        if (confirmPasswordInput) confirmPasswordInput.value = '';
                        
                        // Reset state
                        passwordVerified = false;
                        if (currentPasswordSuccess) currentPasswordSuccess.style.display = 'none';
                        if (currentPasswordError) currentPasswordError.style.display = 'none';
                        
                        // Disable fields again
                        if (newPasswordInput) {
                            newPasswordInput.disabled = true;
                            newPasswordInput.style.background = '#f5f5f5';
                        }
                        if (confirmPasswordInput) {
                            confirmPasswordInput.disabled = true;
                            confirmPasswordInput.style.background = '#f5f5f5';
                        }
                        if (savePasswordBtn) {
                            savePasswordBtn.disabled = true;
                            savePasswordBtn.style.background = '#95a5a6';
                            savePasswordBtn.style.cursor = 'not-allowed';
                        }
                        
                        // Show success message
                        const successMsg = document.createElement('div');
                        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10000;';
                        successMsg.textContent = '✅ Password changed successfully!';
                        document.body.appendChild(successMsg);
                        setTimeout(() => successMsg.remove(), 3000);
                    } else {
                        if (passwordError) {
                            passwordError.textContent = result.error || 'Failed to change password';
                            passwordError.style.display = 'block';
                        }
                    }
                } catch (error) {
                    console.error('Error changing password:', error);
                    if (passwordError) {
                        passwordError.textContent = 'An error occurred. Please try again.';
                        passwordError.style.display = 'block';
                    }
                }
            });
        }
    }
    
    showPeople() {
        // Show search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'block';
        
        this.currentViewMode = 'people';
        this.pushToHistory('people', {});
        
        // Update active nav
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        const navPeople = document.getElementById('nav-people');
        if (navPeople) navPeople.classList.add('active');
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf people-view';
        
        bookshelf.innerHTML = `
            <div class="people-page" style="max-width: 800px; margin: 0 auto;">
                <div class="people-header" style="margin-bottom: 2rem;">
                    <h2 style="margin: 0 0 1rem 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">Find People</h2>
                </div>
                <div id="people-results" class="people-results" style="display: grid; gap: 1rem;">
                    <div style="text-align: center; padding: 3rem; color: #7f8c8d;">
                        <p style="font-size: 1.1rem;">Loading users...</p>
                    </div>
                </div>
                <div id="people-pagination" style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 2rem;">
                </div>
            </div>
        `;
        
        // Load all users immediately
        this.currentPeoplePage = 1;
        this.loadAllUsers(1);
    }
    
    async loadAllUsers(page = 1) {
        const resultsDiv = document.getElementById('people-results');
        if (!resultsDiv) {
            console.error('people-results div not found!');
            return;
        }
        
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;">Loading users...</div>';
        
        try {
            const token = localStorage.getItem('bookbar_token');
            const response = await fetch(`/api/users?page=${page}&limit=20`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            
            let users = [];
            let total = 0;
            let totalPages = 1;
            
            try {
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
                        users = data.users || [];
                        total = data.total || 0;
                        totalPages = Math.ceil(total / (data.limit || 20));
                    } else {
                        console.log('Server returned HTML instead of JSON, using demo mode');
                        users = [];
                    }
                } else if (response.status === 401 || response.status === 403) {
                    console.log('Not authenticated, using demo mode');
                    users = [];
                } else {
                    console.log('Response not OK, using demo mode');
                    users = [];
                }
            } catch (parseError) {
                console.log('Error parsing response, using demo mode:', parseError);
                users = [];
            }
            
            // If no users from API, use demo mode
            if (users.length === 0) {
                const demoUsers = [
                    { id: 1, username: 'booklover123', name: 'Book Lover', email: 'booklover@example.com', bio: 'Fantasy and sci-fi enthusiast' },
                    { id: 2, username: 'reader2024', name: 'Reader 2024', email: 'reader@example.com', bio: 'Love mystery novels' },
                    { id: 3, username: 'literaturefan', name: 'Literature Fan', email: 'litfan@example.com', bio: 'Classic literature collector' },
                    { id: 4, username: 'rüya', name: 'Rüya', email: 'ruya@example.com', bio: 'Book enthusiast' }
                ];
                users = demoUsers;
                total = demoUsers.length;
                totalPages = 1;
            }
            
            if (users.length === 0) {
                resultsDiv.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #7f8c8d;">
                        <p style="font-size: 1.1rem;">No users found</p>
                    </div>
                `;
                return;
            }
            
            resultsDiv.innerHTML = users.filter(user => user && (user.id || user.username || user.name)).map(user => {
                const username = user.username || user.name || 'Unknown';
                const userId = user.id || 0;
                const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
                
                return `
                <div class="user-card" data-user-id="${userId}" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 1.5rem; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" 
                     onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                    <div class="user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; font-family: 'Cinzel', serif; flex-shrink: 0;">
                        ${avatarLetter}
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 0.25rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">${this.escapeHtml(username)}</h3>
                        ${user.bio ? `<p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${this.escapeHtml(user.bio)}</p>` : ''}
                    </div>
                    <button class="btn-follow" data-user-id="${userId}" data-is-following="false" style="padding: 0.5rem 1.5rem; background: #667eea; border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;">
                        Follow
                    </button>
                </div>
            `;
            }).join('');
            
            // Add click handlers for user cards (open profile)
            resultsDiv.querySelectorAll('.user-card').forEach(card => {
                card.addEventListener('click', async (e) => {
                    if (e.target.classList.contains('btn-follow') || e.target.closest('.btn-follow')) {
                        return;
                    }
                    const userId = parseInt(card.getAttribute('data-user-id'));
                    if (userId) {
                        await this.showUserProfile(userId);
                    }
                });
            });
            
            // Add click handlers for follow buttons
            resultsDiv.querySelectorAll('.btn-follow').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const userId = parseInt(btn.getAttribute('data-user-id'));
                    const isFollowing = btn.getAttribute('data-is-following') === 'true';
                    await this.toggleFollow(userId, btn, isFollowing);
                });
            });
            
            // Check follow status for each user
            const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            if (currentUser.id && users && users.length > 0) {
                const followStatusPromises = users
                    .filter(user => user && user.id)
                    .map(async (user) => {
                        const btn = resultsDiv.querySelector(`.btn-follow[data-user-id="${user.id}"]`);
                        if (btn) {
                            try {
                                const isFollowing = await this.checkFollowStatus(user.id);
                                btn.setAttribute('data-is-following', isFollowing ? 'true' : 'false');
                                if (isFollowing) {
                                    btn.textContent = 'Following';
                                    btn.style.background = '#95a5a6';
                                }
                            } catch (error) {
                                console.error(`Error checking follow status for user ${user.id}:`, error);
                            }
                        }
                    });
                await Promise.all(followStatusPromises);
            }
            
            // Update pagination
            this.updatePeoplePagination(page, totalPages);
            
        } catch (error) {
            console.error('Error loading users:', error);
            resultsDiv.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #e74c3c;">
                    <p style="font-size: 1.1rem;">Error loading users. Please try again.</p>
                </div>
            `;
        }
    }
    
    updatePeoplePagination(currentPage, totalPages) {
        const paginationDiv = document.getElementById('people-pagination');
        if (!paginationDiv || totalPages <= 1) {
            if (paginationDiv) paginationDiv.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button id="people-prev" ${currentPage === 1 ? 'disabled' : ''} 
                    style="padding: 0.5rem 1rem; border: 1px solid #e8ecf1; border-radius: 8px; background: ${currentPage === 1 ? '#f5f5f5' : 'white'}; color: ${currentPage === 1 ? '#bdc3c7' : '#2c3e50'}; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'}; font-size: 0.9rem;">
                Previous
            </button>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                paginationHTML += `
                    <button class="people-page-btn" data-page="${i}" 
                            style="padding: 0.5rem 1rem; border: 1px solid #e8ecf1; border-radius: 8px; background: ${i === currentPage ? '#667eea' : 'white'}; color: ${i === currentPage ? 'white' : '#2c3e50'}; cursor: pointer; font-size: 0.9rem; font-weight: ${i === currentPage ? '600' : '400'};">
                        ${i}
                    </button>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                paginationHTML += `<span style="padding: 0.5rem; color: #7f8c8d;">...</span>`;
            }
        }
        
        // Next button
        paginationHTML += `
            <button id="people-next" ${currentPage === totalPages ? 'disabled' : ''} 
                    style="padding: 0.5rem 1rem; border: 1px solid #e8ecf1; border-radius: 8px; background: ${currentPage === totalPages ? '#f5f5f5' : 'white'}; color: ${currentPage === totalPages ? '#bdc3c7' : '#2c3e50'}; cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'}; font-size: 0.9rem;">
                Next
            </button>
        `;
        
        paginationDiv.innerHTML = paginationHTML;
        
        // Add event listeners
        const prevBtn = document.getElementById('people-prev');
        const nextBtn = document.getElementById('people-next');
        const pageBtns = document.querySelectorAll('.people-page-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    this.currentPeoplePage = currentPage - 1;
                    this.loadAllUsers(this.currentPeoplePage);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    this.currentPeoplePage = currentPage + 1;
                    this.loadAllUsers(this.currentPeoplePage);
                }
            });
        }
        
        pageBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.getAttribute('data-page'));
                if (page !== currentPage) {
                    this.currentPeoplePage = page;
                    this.loadAllUsers(this.currentPeoplePage);
                }
            });
        });
    }
    
    async searchUsers(query) {
        console.log('searchUsers called with query:', query);
        const resultsDiv = document.getElementById('people-results');
        if (!resultsDiv) {
            console.error('people-results div not found!');
            return;
        }
        
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;">Searching...</div>';
        
        try {
            // Try API first
            const token = localStorage.getItem('bookbar_token');
            const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            
            let users = [];
            try {
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
                        users = data.users || [];
                    } else {
                        // Server returned HTML instead of JSON (probably an error page)
                        console.log('Server returned HTML instead of JSON, using demo mode');
                        users = [];
                    }
                } else if (response.status === 401 || response.status === 403) {
                    // Not authenticated - use demo mode
                    console.log('Not authenticated, using demo mode');
                    users = [];
                } else {
                    // For other errors, use demo mode
                    console.log('Response not OK, using demo mode');
                    users = [];
                }
            } catch (parseError) {
                // Error parsing response, use demo mode
                console.log('Error parsing response, using demo mode:', parseError);
                users = [];
            }
            
            // If no users from API, use demo mode
            if (users.length === 0) {
                // Demo mode - create mock users
                const demoUsers = [
                    { id: 1, username: 'booklover123', name: 'Book Lover', email: 'booklover@example.com', bio: 'Fantasy and sci-fi enthusiast' },
                    { id: 2, username: 'reader2024', name: 'Reader 2024', email: 'reader@example.com', bio: 'Love mystery novels' },
                    { id: 3, username: 'literaturefan', name: 'Literature Fan', email: 'litfan@example.com', bio: 'Classic literature collector' },
                    { id: 4, username: 'rüya', name: 'Rüya', email: 'ruya@example.com', bio: 'Book enthusiast' }
                ];
                
                users = demoUsers.filter(user => 
                    user.username.toLowerCase().includes(query.toLowerCase()) ||
                    (user.name && user.name.toLowerCase().includes(query.toLowerCase()))
                );
            }
            
            if (users.length === 0) {
                resultsDiv.innerHTML = `
                    <div style="text-align: center; padding: 3rem; color: #7f8c8d;">
                        <p style="font-size: 1.1rem;">No users found matching "${query}"</p>
                    </div>
                `;
                return;
            }
            
            resultsDiv.innerHTML = users.filter(user => user && (user.id || user.username || user.name)).map(user => {
                const username = user.username || user.name || 'Unknown';
                const userId = user.id || 0;
                const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
                
                return `
                <div class="user-card" data-user-id="${userId}" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 1.5rem; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" 
                     onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                    <div class="user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; font-family: 'Cinzel', serif; flex-shrink: 0;">
                        ${avatarLetter}
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 0.25rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">${this.escapeHtml(username)}</h3>
                        ${user.bio ? `<p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${this.escapeHtml(user.bio)}</p>` : ''}
                    </div>
                    <button class="btn-follow" data-user-id="${userId}" data-is-following="false" style="padding: 0.5rem 1.5rem; background: #667eea; border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;">
                        Follow
                    </button>
                </div>
            `;
            }).join('');
            
            // Add click handlers for user cards (open profile)
            resultsDiv.querySelectorAll('.user-card').forEach(card => {
                card.addEventListener('click', async (e) => {
                    // Don't open profile if clicking on the follow button
                    if (e.target.classList.contains('btn-follow') || e.target.closest('.btn-follow')) {
                        return;
                    }
                    const userId = parseInt(card.getAttribute('data-user-id'));
                    if (userId) {
                        await this.showUserProfile(userId);
                    }
                });
            });
            
            // Add click handlers for follow buttons
            resultsDiv.querySelectorAll('.btn-follow').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent card click event
                    const userId = parseInt(btn.getAttribute('data-user-id'));
                    const isFollowing = btn.getAttribute('data-is-following') === 'true';
                    await this.toggleFollow(userId, btn, isFollowing);
                });
            });
            
            // Check follow status for each user
            const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            if (currentUser.id && users && users.length > 0) {
                // Check follow status for all users in parallel
                const followStatusPromises = users
                    .filter(user => user && user.id)
                    .map(async (user) => {
                        const btn = resultsDiv.querySelector(`.btn-follow[data-user-id="${user.id}"]`);
                        if (btn) {
                            try {
                                const isFollowing = await this.checkFollowStatus(user.id);
                                btn.setAttribute('data-is-following', isFollowing ? 'true' : 'false');
                                if (isFollowing) {
                                    btn.textContent = 'Following';
                                    btn.style.background = '#95a5a6';
                                }
                            } catch (error) {
                                console.error(`Error checking follow status for user ${user.id}:`, error);
                            }
                        }
                    });
                await Promise.all(followStatusPromises);
            }
        } catch (error) {
            console.error('Error searching users:', error);
            
            // On error, use demo mode
            const demoUsers = [
                { id: 1, username: 'booklover123', name: 'Book Lover', email: 'booklover@example.com', bio: 'Fantasy and sci-fi enthusiast' },
                { id: 2, username: 'reader2024', name: 'Reader 2024', email: 'reader@example.com', bio: 'Love mystery novels' },
                { id: 3, username: 'literaturefan', name: 'Literature Fan', email: 'litfan@example.com', bio: 'Classic literature collector' },
                { id: 4, username: 'rüya', name: 'Rüya', email: 'ruya@example.com', bio: 'Book enthusiast' }
            ];
            
            const filteredUsers = demoUsers.filter(user => 
                user.username.toLowerCase().includes(query.toLowerCase()) ||
                (user.name && user.name.toLowerCase().includes(query.toLowerCase()))
            );
            
            if (filteredUsers.length > 0) {
                resultsDiv.innerHTML = filteredUsers
                    .filter(user => user && (user.id || user.username || user.name))
                    .map(user => {
                        const username = user.username || user.name || 'Unknown';
                        const userId = user.id || 0;
                        const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
                        
                        return `
                    <div class="user-card" data-user-id="${userId}" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 1.5rem; transition: transform 0.2s, box-shadow 0.2s; cursor: pointer;" 
                         onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
                         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'">
                        <div class="user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; font-family: 'Cinzel', serif; flex-shrink: 0;">
                            ${avatarLetter}
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 0.25rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">${this.escapeHtml(username)}</h3>
                            ${user.bio ? `<p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${this.escapeHtml(user.bio)}</p>` : ''}
                        </div>
                        <button class="btn-follow" data-user-id="${userId}" data-is-following="false" style="padding: 0.5rem 1.5rem; background: #667eea; border: none; border-radius: 8px; color: white; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background 0.2s;">
                            Follow
                        </button>
                    </div>
                `;
                    }).join('');
                
                // Add click handlers for user cards (open profile) in demo mode
                resultsDiv.querySelectorAll('.user-card').forEach(card => {
                    card.addEventListener('click', async (e) => {
                        // Don't open profile if clicking on the follow button
                        if (e.target.classList.contains('btn-follow') || e.target.closest('.btn-follow')) {
                            return;
                        }
                        const userId = parseInt(card.getAttribute('data-user-id'));
                        if (userId) {
                            await this.showUserProfile(userId);
                        }
                    });
                });
                
                // Add click handlers for follow buttons in demo mode
                resultsDiv.querySelectorAll('.btn-follow').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        e.stopPropagation(); // Prevent card click event
                        const userId = parseInt(btn.getAttribute('data-user-id'));
                        const isFollowing = btn.getAttribute('data-is-following') === 'true';
                        await this.toggleFollow(userId, btn, isFollowing);
                    });
                });
            } else {
                resultsDiv.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;">No users found matching your search.</div>';
            }
        }
    }
    
    async checkFollowStatus(userId) {
        const token = localStorage.getItem('bookbar_token');
        if (!token) return false;
        
        try {
            const response = await fetch(`/api/users/${userId}/follow-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.isFollowing || false;
            }
        } catch (error) {
            console.error('Error checking follow status:', error);
        }
        return false;
    }
    
    async checkMutualFollow(userId) {
        const token = localStorage.getItem('bookbar_token');
        if (!token) return false;
        
        try {
            const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
            const currentUserId = currentUser.id;
            
            // Check if I follow them
            const iFollowRes = await fetch(`/api/users/${userId}/follow-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // Check if they follow me by checking my followers list
            const myFollowersRes = await fetch(`/api/users/${currentUserId}/followers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            let iFollow = false;
            let theyFollow = false;
            
            if (iFollowRes.ok) {
                const data = await iFollowRes.json();
                iFollow = data.isFollowing || false;
            }
            
            if (myFollowersRes.ok) {
                const data = await myFollowersRes.json();
                const followers = data.followers || [];
                theyFollow = followers.some(f => f.id === parseInt(userId));
            }
            
            return iFollow && theyFollow;
        } catch (error) {
            console.error('Error checking mutual follow:', error);
        }
        return false;
    }
    
    async toggleFollow(userId, button, isFollowing) {
        const token = localStorage.getItem('bookbar_token');
        if (!token) {
            alert('Please log in to follow users');
            return;
        }
        
        console.log('Toggle follow - userId:', userId, 'isFollowing:', isFollowing, 'token exists:', !!token);
        
        const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
        const currentUserId = currentUser.id;
        
        try {
            if (isFollowing) {
                // Unfollow
                const response = await fetch(`/api/users/${userId}/follow`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    button.textContent = 'Follow';
                    button.style.background = '#667eea';
                    button.setAttribute('data-is-following', 'false');
                    
                    // Update follower count in profile if visible
                    await this.updateFollowerCounts();
                    
                    // If we're viewing the unfollowed user's profile, refresh it
                    if (this.currentViewMode === 'profile' && currentUserId === userId) {
                        await this.showProfile();
                    }
                    
                    // If we're viewing the unfollowed user's profile (they were following us), update their profile too
                    if (this.currentViewMode === 'user-profile' && userId !== currentUserId) {
                        await this.showUserProfile(userId);
                    }
                } else if (response.status === 404) {
                    // API not available, use demo mode
                    button.textContent = 'Follow';
                    button.style.background = '#667eea';
                    button.setAttribute('data-is-following', 'false');
                } else {
                    const error = await response.json().catch(() => ({ error: 'Failed to unfollow user' }));
                    alert(error.error || 'Failed to unfollow user');
                }
            } else {
                // Follow
                const response = await fetch(`/api/users/${userId}/follow`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    button.textContent = 'Following';
                    button.style.background = '#95a5a6';
                    button.setAttribute('data-is-following', 'true');
                    
                    // Update follower count for the followed user (userId) if their profile is visible
                    // If we're viewing the followed user's profile, update their follower count
                    if (this.currentViewMode === 'user-profile' && userId !== currentUserId) {
                        await this.showUserProfile(userId);
                    }
                    
                    // If we're viewing our own profile, update our counts
                    if (this.currentViewMode === 'profile') {
                        await this.updateFollowerCounts();
                        await this.showProfile();
                    }
                } else if (response.status === 404) {
                    // API not available - don't update UI, show error
                    alert('Server is not running. Please start the server to save follow relationships.');
                    console.error('Follow API endpoint not found. Server may not be running.');
                    return;
                } else {
                    try {
                        const error = await response.json();
                        alert(error.error || 'Failed to follow user');
                    } catch (e) {
                        // If response is not JSON, might be HTML error page
                        if (response.status === 404) {
                            // API not available, use demo mode
                            button.textContent = 'Following';
                            button.style.background = '#95a5a6';
                            button.setAttribute('data-is-following', 'true');
                            console.log('API not available, using demo mode for follow');
                        } else {
                            alert('Failed to follow user. Please try again.');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            // On network error, show error message
            alert('Network error. Please check if the server is running and try again.');
        }
    }
    
    async loadUserComments(userId) {
        const commentsList = document.getElementById('comments-list');
        if (!commentsList) return;
        
        commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Loading comments...</p></div>';
        
        try {
            const token = localStorage.getItem('bookbar_token');
            if (!token) {
                commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to view comments</p></div>';
                return;
            }
            
            const response = await fetch(`/api/users/${userId}/comments`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            let comments = [];
            if (response.ok) {
                const data = await response.json();
                comments = data.comments || [];
            } else if (response.status === 401 || response.status === 403) {
                commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to view comments</p></div>';
                return;
            } else {
                console.error('Error loading comments:', response.status, response.statusText);
                commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading comments. Please try again.</p></div>';
                return;
            }
            
            if (comments.length === 0) {
                commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No comments yet</p></div>';
                return;
            }
            
            commentsList.innerHTML = comments.map(comment => `
                <div class="comment-item" style="background: white; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-left: 4px solid #667eea;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0; color: #2c3e50; font-size: 1.1rem; font-weight: 600;">${this.escapeHtml(comment.book_title || 'Unknown Book')}</h4>
                            <p style="margin: 0; color: #7f8c8d; font-size: 0.85rem;">${this.formatDate(comment.createdAt)}</p>
                        </div>
                        <button class="delete-user-comment-btn" data-comment-id="${comment.id}" style="padding: 0.5rem 1rem; background: #e74c3c; border: none; border-radius: 6px; color: white; font-size: 0.85rem; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#c0392b';" onmouseout="this.style.background='#e74c3c';">Delete</button>
                    </div>
                    <p style="margin: 0; color: #495057; line-height: 1.6; white-space: pre-wrap;">${this.escapeHtml(comment.comment)}</p>
                </div>
            `).join('');
            
            // Attach delete button listeners for user comments
            commentsList.querySelectorAll('.delete-user-comment-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const commentId = e.target.dataset.commentId;
                    await this.deleteComment(commentId);
                    // Reload comments
                    await this.loadUserComments(userId);
                });
            });
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading comments. Please check if server is running.</p></div>';
        }
    }
    
    async deleteComment(commentId) {
        try {
            // First, get comment info to find the book
            const token = localStorage.getItem('bookbar_token');
            let bookId = null;
            let bookAsin = null;
            
            if (token) {
                try {
                    const commentRes = await fetch(`/api/comments/${commentId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (commentRes.ok) {
                        const commentData = await commentRes.json();
                        bookId = commentData.comment?.book_id;
                        // Get book ASIN from book_id
                        if (bookId) {
                            const bookRes = await fetch(`/api/books/${bookId}`);
                            if (bookRes.ok) {
                                const bookData = await bookRes.json();
                                bookAsin = bookData.book?.asin;
                            }
                        }
                    }
                } catch (err) {
                    console.error('Error fetching comment info:', err);
                }
            }
            
            const response = await fetch(`/api/comments/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('bookbar_token')}`
                }
            });
            
            if (response.ok) {
                // Delete from localStorage as well
                if (bookAsin && this.userData.notes[bookAsin]) {
                    this.userData.notes[bookAsin].memo = '';
                    this.saveUserData();
                }
                
                const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
                await this.loadUserComments(userData.id);
                
                // If book detail page is open, refresh it (not modal)
                if (this.currentViewMode === 'book-detail' && bookAsin) {
                    const book = this.books.find(b => b.asin === bookAsin);
                    if (book) {
                        this.showBookDetailPage(book);
                    }
                }
            } else {
                console.error('Failed to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    }
    
    async showMessages() {
        this.currentViewMode = 'messages';
        this.pushToHistory('messages', {});
        
        // Hide search bar
        const searchBox = document.querySelector('.search-box');
        if (searchBox) searchBox.style.display = 'none';
        
        // Update active nav
        document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
        const navMessages = document.getElementById('nav-messages');
        if (navMessages) navMessages.classList.add('active');
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        bookshelf.innerHTML = '';
        bookshelf.className = 'bookshelf messages-view';
        
        const userData = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
        const userId = userData.id;
        
        if (!userId) {
            bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to view messages</p></div>';
            return;
        }
        
        try {
            const token = localStorage.getItem('bookbar_token');
            if (!token) {
                bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to view messages</p></div>';
                return;
            }
            
            const response = await fetch('/api/messages', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            let conversations = [];
            if (response.ok) {
                try {
                    const data = await response.json();
                    conversations = data.conversations || [];
                } catch (err) {
                    console.error('Error parsing messages response:', err);
                    bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading messages. Please try again.</p></div>';
                    return;
                }
            } else if (response.status === 401 || response.status === 403) {
                bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>Please log in to view messages</p></div>';
                return;
            } else {
                console.error('Error loading messages:', response.status, response.statusText);
                bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading messages. Please check if server is running.</p></div>';
                return;
            }
            
            bookshelf.innerHTML = `
                <div class="messages-page">
                    <div class="messages-header" style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecf1;">
                        <h2 style="margin: 0; color: #2c3e50; font-size: 1.8rem; font-weight: 600;">Messages</h2>
                        <p style="margin: 0.5rem 0 0 0; color: #7f8c8d; font-size: 0.95rem;">You can only message users who follow you back</p>
                    </div>
                    
                    <div id="conversations-list" style="display: grid; gap: 1rem;">
                        ${conversations.length === 0 ? 
                            '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No messages yet. Start following users who follow you back to start messaging!</p></div>' :
                            conversations.map(conv => {
                                const otherUser = conv.otherUser;
                                if (!otherUser) return '';
                                const username = otherUser.username || otherUser.name || 'Unknown';
                                const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
                                return `
                                    <div class="conversation-card" style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; align-items: center; gap: 1.5rem; cursor: pointer; transition: all 0.2s;" 
                                         onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'"
                                         onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'"
                                         onclick="window.bookshelf.showConversation(${otherUser.id})">
                                        <div class="user-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; color: white; font-family: 'Cinzel', serif; flex-shrink: 0;">
                                            ${avatarLetter}
                                        </div>
                                        <div style="flex: 1;">
                                            <h3 style="margin: 0 0 0.25rem 0; color: #2c3e50; font-size: 1.2rem; font-weight: 600;">${this.escapeHtml(username)}</h3>
                                            <p style="margin: 0; color: #7f8c8d; font-size: 0.9rem;">${this.escapeHtml(conv.lastMessage || 'No messages yet')}</p>
                                        </div>
                                        ${conv.unreadCount > 0 ? `<span style="background: #667eea; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">${conv.unreadCount}</span>` : ''}
                                    </div>
                                `;
                            }).filter(html => html).join('')
                        }
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error loading messages:', error);
            bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading messages. Please check if server is running.</p></div>';
        }
    }
    
    async showConversation(userId) {
        this.currentViewMode = 'conversation';
        this.pushToHistory('conversation', { userId });
        
        const bookshelf = document.getElementById('bookshelf');
        if (!bookshelf) return;
        
        try {
            const [userRes, messagesRes] = await Promise.all([
                fetch(`/api/users/${userId}`),
                fetch(`/api/messages/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('bookbar_token')}`
                    }
                })
            ]);
            
            if (!userRes.ok || !messagesRes.ok) {
                if (messagesRes.status === 403) {
                    bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>You can only message users who follow you back</p></div>';
                    return;
                }
            }
            
            const userData = await userRes.json();
            const user = userData.user;
            const messagesData = await messagesRes.json();
            const messages = messagesData.messages || [];
            
            const username = user.username || user.name || 'Unknown';
            const avatarLetter = username && username.length > 0 ? username[0].toUpperCase() : 'U';
            
            bookshelf.innerHTML = `
                <div class="conversation-page">
                    <div class="conversation-header" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 2px solid #e8ecf1; display: flex; align-items: center; gap: 1rem;">
                        <button onclick="window.bookshelf.showMessages()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #667eea;">←</button>
                        <div class="user-avatar" style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; color: white; font-family: 'Cinzel', serif;">
                            ${avatarLetter}
                        </div>
                        <h2 style="margin: 0; color: #2c3e50; font-size: 1.5rem; font-weight: 600;">${this.escapeHtml(username)}</h2>
                    </div>
                    
                    <div id="messages-list" style="max-height: 500px; overflow-y: auto; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        ${messages.length === 0 ? 
                            '<div style="text-align: center; padding: 2rem; color: #7f8c8d;"><p>No messages yet. Start the conversation!</p></div>' :
                            messages.map(msg => {
                                const currentUser = JSON.parse(localStorage.getItem('bookbar_user') || '{}');
                                const isSent = msg.sender_id == currentUser.id;
                                return `
                                    <div style="display: flex; justify-content: ${isSent ? 'flex-end' : 'flex-start'}; margin-bottom: 1rem;">
                                        <div style="max-width: 70%; padding: 0.75rem 1rem; background: ${isSent ? '#667eea' : 'white'}; color: ${isSent ? 'white' : '#2c3e50'}; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                            <p style="margin: 0; font-size: 0.95rem; line-height: 1.5;">${this.escapeHtml(msg.content)}</p>
                                            <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; opacity: 0.7;">${this.formatDate(msg.createdAt)}</p>
                                        </div>
                                    </div>
                                `;
                            }).join('')
                        }
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="message-input" placeholder="Type a message..." style="flex: 1; padding: 0.75rem 1rem; border: 2px solid #e8ecf1; border-radius: 8px; font-size: 0.95rem;" onkeypress="if(event.key === 'Enter') window.bookshelf.sendMessage(${userId})">
                        <button onclick="window.bookshelf.sendMessage(${userId})" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; font-weight: 500; cursor: pointer;">Send</button>
                    </div>
                </div>
            `;
            
            // Scroll to bottom
            const messagesList = document.getElementById('messages-list');
            if (messagesList) {
                messagesList.scrollTop = messagesList.scrollHeight;
            }
        } catch (error) {
            console.error('Error loading conversation:', error);
            bookshelf.innerHTML = '<div style="text-align: center; padding: 2rem; color: #e74c3c;"><p>Error loading conversation</p></div>';
        }
    }
    
    async sendMessage(userId) {
        const input = document.getElementById('message-input');
        const content = input?.value.trim();
        
        if (!content) return;
        
        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('bookbar_token')}`
                },
                body: JSON.stringify({ receiver_id: userId, content })
            });
            
            if (response.ok) {
                input.value = '';
                await this.showConversation(userId);
            } else {
                const error = await response.json().catch(() => ({ error: 'Failed to send message' }));
                if (response.status === 403) {
                    alert('You can only message users who follow you back');
                } else {
                    alert(error.error || 'Failed to send message');
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message');
        }
    }
    
    handleLogout() {
        localStorage.removeItem('bookbar_token');
        localStorage.removeItem('bookbar_user');
        this.updateAuthUI();
        window.location.reload();
    }
}

// Lazy Loading for Images
class LazyLoader {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        this.observer.unobserve(img);
                    }
                });
            },
            { rootMargin: '50px' }
        );
    }

    observe() {
        document.querySelectorAll('.lazy').forEach(img => {
            this.observer.observe(img);
        });
    }
}

// Global utility functions
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            alert('URL copied to clipboard!');
        }).catch(() => {
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        alert('URL copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy: ', err);
        alert('Copy failed. Please manually select and copy the URL.');
    }
    document.body.removeChild(textArea);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bookshelf = new VirtualBookshelf();
    window.lazyLoader = new LazyLoader();

    // Bookshelf management event listeners are handled in setupEventListeners

    // Set up mutation observer to handle dynamically added images
    const mutationObserver = new MutationObserver(() => {
        window.lazyLoader.observe();
    });

    mutationObserver.observe(document.getElementById('bookshelf'), {
        childList: true,
        subtree: true
    });
});