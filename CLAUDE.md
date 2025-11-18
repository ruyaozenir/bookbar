# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Environment and Commands

### Local Development Server
```bash
# Start HTTP server (to avoid CORS restrictions)
python -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

Open `http://localhost:8000` in browser

### Highlights Feature Management
```bash
# Generate highlights index (if using highlights feature)
./scripts/generate-highlights-index.sh
```

## Architecture Overview

### Data Structure and Flow
This project is a **frontend-only web application** that does not require a backend server.

#### Main Components
- **VirtualBookshelf** (`bookshelf.js`): Main application class, UI control and business logic
- **BookManager** (`book-manager.js`): Book CRUD operations (Create, Read, Update, Delete)
- **HighlightsManager** (`highlights.js`): Display and management of Kindle highlights

#### Data Persistence Strategy
1. **Browser LocalStorage**: Saves user settings, star ratings, notes, bookshelf customizations
2. **GitHub Repository Files**: Persistent data files (`data/library.json`)
3. **Hybrid Loading**: LocalStorage priority, file loading as fallback

#### Core Data Files
- `data/library.json`: Integrated book data (book information + user data)
- `data/config.json`: Global settings such as affiliate IDs
- `data/highlights-index.json`: ASIN mapping for highlight files (auto-generated)

### Initialization Flow
1. `VirtualBookshelf.init()` initializes BookManager
2. `BookManager.initialize()` loads book data (LocalStorage → file)
3. User settings data restored from LocalStorage, or file loading if not available
4. UI rendering and event listener setup

### Key Features
- **Manual Book Addition**: Add books to library by manually entering ASIN, title, author
- **Settings Export**: Download LocalStorage data as `library.json`
- **Book Management**: Add, edit, delete books

### Bookshelf Management System
- Create multiple bookshelves for theme-based curation
- Public/private settings per bookshelf
- Drag & drop book reordering (custom order persistence)
- Star rating system (1-5 stars) and filtering
- Bookshelf preview and static page generation

### User Interface
- **Responsive Design**: Works on mobile, tablet, desktop
- **Interactive Elements**: Modal detail display, star ratings, search & filter
- **Book Display**: Cover images, titles, authors, ratings
- **Navigation**: Browser history support, URL hash management

### Important Notes
- **Auto-generated Files**: `data/highlights-index.json` is auto-generated, do not edit manually
- **LocalStorage Priority**: User data in LocalStorage takes precedence over file data
- **CORS**: When developing locally, use HTTP server to avoid CORS issues
