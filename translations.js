// BookBar Translation System
// Supports English and Czech languages

const translations = {
    en: {
        // Header & Navigation
        'nav.books': 'Book List',
        'nav.favorites': 'My Favorites',
        'nav.authors': 'Authors',
        'nav.community': 'Community',
        'nav.people': 'People',
        'nav.messages': 'Messages',
        'auth.login': 'LOG IN',
        'auth.signup': 'SIGN UP',
        'auth.logout': 'Logout',
        'user.profile': 'Profile',
        'user.notifications': 'Notifications',
        'user.settings': 'Settings',
        
        // Filters
        'filter.title': 'Filters',
        'filter.rating': 'Rating Filter',
        'filter.star': 'Star',
        'filter.stars': 'Stars',
        'filter.notRated': 'Not Rated',
        'filter.sortBy': 'Sort By',
        'filter.customOrder': 'Custom Order',
        'filter.dateAdded': 'Date Added',
        'filter.title': 'Title',
        'filter.author': 'Author',
        'filter.itemsPerPage': 'Items Per Page',
        'filter.books': 'Books',
        'filter.all': 'All',
        'filter.coverSize': 'Cover Size',
        'filter.small': 'Small',
        'filter.medium': 'Medium',
        'filter.large': 'Large',
        
        // Search
        'search.placeholder': 'Search by book title or author...',
        'search.noResults': 'No books found',
        
        // Book Details
        'book.title': 'Title',
        'book.author': 'Author',
        'book.description': 'Description',
        'book.genre': 'Genre',
        'book.rating': 'Rating',
        'book.comments': 'Comments',
        'book.addComment': 'Add your comment',
        'book.saveComment': 'Save Comment',
        'book.editComment': 'Edit Comment',
        'book.deleteComment': 'Delete Comment',
        'book.noComments': 'No comments yet',
        'book.addToFavorites': 'Add to Favorites',
        'book.removeFromFavorites': 'Remove from Favorites',
        
        // Profile
        'profile.title': 'Profile',
        'profile.bio': 'Bio',
        'profile.edit': 'Edit Profile',
        'profile.save': 'Save Changes',
        'profile.cancel': 'Cancel',
        'profile.followers': 'Followers',
        'profile.following': 'Following',
        'profile.follow': 'Follow',
        'profile.unfollow': 'Unfollow',
        'profile.message': 'Message',
        
        // Messages
        'messages.title': 'Messages',
        'messages.noMessages': 'No messages yet',
        'messages.send': 'Send',
        'messages.typeMessage': 'Type a message...',
        'messages.conversation': 'Conversation',
        
        // Notifications
        'notifications.title': 'Notifications',
        'notifications.noNotifications': 'No notifications',
        'notifications.markAllRead': 'Mark all as read',
        'notifications.viewMessage': 'View message →',
        
        // People
        'people.title': 'People',
        'people.search': 'Search users...',
        'people.noUsers': 'No users found',
        
        // Common
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.close': 'Close',
        'common.back': 'Back',
        'common.next': 'Next',
        'common.previous': 'Previous',
        'common.page': 'Page',
        'common.of': 'of',
        
        // Footer
        'footer.copyright': '© 2025 BookBar - Book Sharing Platform'
    },
    
    cs: {
        // Header & Navigation
        'nav.books': 'Seznam knih',
        'nav.favorites': 'Moje oblíbené',
        'nav.authors': 'Autoři',
        'nav.community': 'Komunita',
        'nav.people': 'Lidé',
        'nav.messages': 'Zprávy',
        'auth.login': 'PŘIHLÁSIT',
        'auth.signup': 'REGISTROVAT',
        'auth.logout': 'Odhlásit se',
        'user.profile': 'Profil',
        'user.notifications': 'Oznámení',
        'user.settings': 'Nastavení',
        
        // Filters
        'filter.title': 'Filtry',
        'filter.rating': 'Filtr hodnocení',
        'filter.star': 'Hvězda',
        'filter.stars': 'Hvězdy',
        'filter.notRated': 'Nehodnoceno',
        'filter.sortBy': 'Řadit podle',
        'filter.customOrder': 'Vlastní pořadí',
        'filter.dateAdded': 'Datum přidání',
        'filter.title': 'Název',
        'filter.author': 'Autor',
        'filter.itemsPerPage': 'Položek na stránku',
        'filter.books': 'Knihy',
        'filter.all': 'Vše',
        'filter.coverSize': 'Velikost obálky',
        'filter.small': 'Malá',
        'filter.medium': 'Střední',
        'filter.large': 'Velká',
        
        // Search
        'search.placeholder': 'Hledat podle názvu knihy nebo autora...',
        'search.noResults': 'Nebyly nalezeny žádné knihy',
        
        // Book Details
        'book.title': 'Název',
        'book.author': 'Autor',
        'book.description': 'Popis',
        'book.genre': 'Žánr',
        'book.rating': 'Hodnocení',
        'book.comments': 'Komentáře',
        'book.addComment': 'Přidat komentář',
        'book.saveComment': 'Uložit komentář',
        'book.editComment': 'Upravit komentář',
        'book.deleteComment': 'Smazat komentář',
        'book.noComments': 'Zatím žádné komentáře',
        'book.addToFavorites': 'Přidat do oblíbených',
        'book.removeFromFavorites': 'Odebrat z oblíbených',
        
        // Profile
        'profile.title': 'Profil',
        'profile.bio': 'Bio',
        'profile.edit': 'Upravit profil',
        'profile.save': 'Uložit změny',
        'profile.cancel': 'Zrušit',
        'profile.followers': 'Sledující',
        'profile.following': 'Sleduji',
        'profile.follow': 'Sledovat',
        'profile.unfollow': 'Přestat sledovat',
        'profile.message': 'Zpráva',
        
        // Messages
        'messages.title': 'Zprávy',
        'messages.noMessages': 'Zatím žádné zprávy',
        'messages.send': 'Odeslat',
        'messages.typeMessage': 'Napište zprávu...',
        'messages.conversation': 'Konverzace',
        
        // Notifications
        'notifications.title': 'Oznámení',
        'notifications.noNotifications': 'Žádná oznámení',
        'notifications.markAllRead': 'Označit vše jako přečtené',
        'notifications.viewMessage': 'Zobrazit zprávu →',
        
        // People
        'people.title': 'Lidé',
        'people.search': 'Hledat uživatele...',
        'people.noUsers': 'Nebyli nalezeni žádní uživatelé',
        
        // Common
        'common.loading': 'Načítání...',
        'common.error': 'Chyba',
        'common.success': 'Úspěch',
        'common.cancel': 'Zrušit',
        'common.save': 'Uložit',
        'common.delete': 'Smazat',
        'common.edit': 'Upravit',
        'common.close': 'Zavřít',
        'common.back': 'Zpět',
        'common.next': 'Další',
        'common.previous': 'Předchozí',
        'common.page': 'Stránka',
        'common.of': 'z',
        
        // Footer
        'footer.copyright': '© 2025 BookBar - Platforma pro sdílení knih'
    }
};

// Translation Manager Class
class TranslationManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('bookbar_language') || 'en';
        this.init();
    }
    
    init() {
        // Apply saved language on load
        this.setLanguage(this.currentLanguage);
    }
    
    getLanguage() {
        return this.currentLanguage;
    }
    
    setLanguage(lang) {
        if (!translations[lang]) {
            console.warn(`Language ${lang} not supported, defaulting to English`);
            lang = 'en';
        }
        
        this.currentLanguage = lang;
        localStorage.setItem('bookbar_language', lang);
        
        // Update all translatable elements
        this.updatePage();
        
        // Update language switcher UI
        this.updateLanguageSwitcher();
    }
    
    translate(key, defaultValue = key) {
        const lang = translations[this.currentLanguage];
        if (lang && lang[key]) {
            return lang[key];
        }
        // Fallback to English
        if (translations.en && translations.en[key]) {
            return translations.en[key];
        }
        return defaultValue;
    }
    
    t(key, defaultValue) {
        return this.translate(key, defaultValue);
    }
    
    updatePage() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const text = this.translate(key);
            if (element.tagName === 'INPUT' && element.type === 'text' || element.tagName === 'INPUT' && element.type === 'email' || element.tagName === 'INPUT' && element.type === 'password') {
                element.placeholder = text;
            } else if (element.tagName === 'INPUT' && element.type === 'button' || element.tagName === 'BUTTON') {
                element.textContent = text;
            } else {
                element.textContent = text;
            }
        });
        
        // Update title attributes
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.translate(key);
        });
        
        // Trigger custom event for dynamic content updates
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: this.currentLanguage } 
        }));
    }
    
    updateLanguageSwitcher() {
        const switcher = document.getElementById('language-switcher');
        if (switcher) {
            const currentLang = this.currentLanguage === 'en' ? 'EN' : 'CS';
            const otherLang = this.currentLanguage === 'en' ? 'CS' : 'EN';
            switcher.innerHTML = `
                <span class="current-lang">${currentLang}</span>
                <span class="lang-separator">/</span>
                <span class="other-lang">${otherLang}</span>
            `;
        }
    }
    
    toggleLanguage() {
        const newLang = this.currentLanguage === 'en' ? 'cs' : 'en';
        this.setLanguage(newLang);
    }
}

// Create global translation manager instance
window.translationManager = new TranslationManager();

