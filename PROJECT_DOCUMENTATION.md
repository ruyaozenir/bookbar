# BookBar - Comprehensive Project Documentation

## 📖 Business Story

### Vision
BookBar is a social book management and sharing platform designed for book lovers. It enables users to organize their books, connect with other readers, rate books, and interact within a community.

### Mission
To bring together people who love reading, enriching the reading experience and facilitating book discovery. Enabling users to share the books they've read, discover new books, and connect with readers who share similar tastes.

### Target Audience
- Book lovers and reading enthusiasts
- Book collectors
- Book clubs and communities
- People seeking to discover new books
- Those who want to track their reading habits

### Core Value Proposition
1. **Personal Library Management**: Users can organize, categorize, and track their books
2. **Social Interaction**: Connect with other readers, messaging, and community building
3. **Book Discovery**: Discover new books through comments, ratings, and recommendations
4. **Rating System**: Contribute to community knowledge by rating books with stars and writing comments
5. **Multi-language Support**: Serve an international user base with English and Czech language support

### Market Positioning
BookBar positions itself as a comprehensive social reading platform that combines personal library management with social networking features. Unlike traditional book tracking apps, BookBar emphasizes community interaction, allowing users to follow each other, exchange messages, and share reading experiences.

### Business Model
- **Freemium Model**: Basic features free, premium features for advanced users
- **Affiliate Revenue**: Amazon affiliate links for book purchases
- **Future Monetization**: Premium subscriptions, sponsored book recommendations

---

## 🏗️ Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Browser     │  │   Mobile      │  │   Desktop    │     │
│  │   (Web App)   │  │   (Future)    │  │   (Future)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/HTTPS
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Frontend (bookshelf.js)                  │   │
│  │  - VirtualBookshelf Class                             │   │
│  │  - UI Rendering & Event Handling                      │   │
│  │  - Client-side State Management                        │   │
│  │  - Browser History Management                          │   │
│  │  - Translation Manager (i18n)                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ API Calls
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       API LAYER                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Express.js REST API (server.js)          │   │
│  │  - Authentication Endpoints                          │   │
│  │  - Books CRUD Operations                              │   │
│  │  - Comments & Ratings                                 │   │
│  │  - User Management                                    │   │
│  │  - Messaging System                                   │   │
│  │  - Notifications                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL Queries
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Business Rules & Validations             │   │
│  │  - Authentication & Authorization                    │   │
│  │  - Mutual Follow Validation                          │   │
│  │  - Rating Validation (1-5 stars)                      │   │
│  │  - Book Search Logic                                  │   │
│  │  - Notification Generation                           │   │
│  │  - Language Management                                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Data Access
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MySQL Database                           │   │
│  │  - users                                             │   │
│  │  - books                                             │   │
│  │  - comments (with ratings)                           │   │
│  │  - reviews                                           │   │
│  │  - favorites                                         │   │
│  │  - messages                                          │   │
│  │  - notifications                                     │   │
│  │  - followers                                         │   │
│  │  - book_requests                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**
- Vanilla JavaScript (ES6+)
- HTML5 & CSS3
- Browser History API
- LocalStorage for client-side caching
- Translation System (i18n) - English & Czech

**Backend:**
- Node.js
- Express.js
- MySQL (mysql2/promise)
- JWT Authentication
- bcryptjs for password hashing

**Database:**
- MySQL 8.0+
- InnoDB Engine
- UTF8MB4 Character Set

### Component Architecture

**Frontend Components:**
1. **VirtualBookshelf** (`bookshelf.js`): Main application controller
   - Manages application state
   - Handles UI rendering
   - Processes user interactions
   - Manages browser history
   - Coordinates with API

2. **TranslationManager** (`translations.js`): Internationalization
   - Language switching
   - Translation lookup
   - Dynamic content updates
   - LocalStorage persistence

3. **BookManager** (`book-manager.js`): Book data management
   - Book CRUD operations
   - Data loading and caching
   - Image URL generation
   - Amazon URL generation

4. **UserManager** (`bookshelf.js`): User authentication
   - Login/logout handling
   - Token management
   - User data caching

**Backend Components:**
1. **Express Server** (`server.js`): API server
   - Route handling
   - Middleware management
   - Database connection pooling
   - Error handling

2. **Database Layer**: MySQL
   - Connection pooling
   - Query execution
   - Transaction management

---

## 📱 App Architecture (Detailed)

### Application Structure

The BookBar application follows a **layered architecture** pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  HTML/CSS/JavaScript (Client-Side)                    │   │
│  │  - index.html (UI Structure)                         │   │
│  │  - bookshelf.css (Styling)                            │   │
│  │  - bookshelf.js (Main Application Logic)              │   │
│  │  - translations.js (i18n Support)                     │   │
│  │  - book-manager.js (Book Data Management)             │   │
│  │  - highlights.js (Kindle Highlights)                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Requests (REST API)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js Server (server.js)                        │   │
│  │  - RESTful API Endpoints                              │   │
│  │  - Authentication Middleware (JWT)                    │   │
│  │  - Request Validation                                 │   │
│  │  - Error Handling                                     │   │
│  │  - CORS Configuration                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL Queries
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Server-Side Business Rules                         │   │
│  │  - User Authentication & Authorization              │   │
│  │  - Mutual Follow Validation                         │   │
│  │  - Rating Validation (1-5 stars)                    │   │
│  │  - Book Search & Matching Logic                      │   │
│  │  - Notification Generation                          │   │
│  │  - Data Validation & Sanitization                    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Database Operations
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MySQL Database                                      │   │
│  │  - Connection Pooling                                │   │
│  │  - ACID Transactions                                │   │
│  │  - Foreign Key Constraints                          │   │
│  │  - Indexes for Performance                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

**File Structure:**
```
bookbar/
├── index.html              # Main HTML structure
├── bookshelf.css           # Global styles
├── bookshelf.js            # Main application logic (VirtualBookshelf class)
├── translations.js         # i18n translation system
├── book-manager.js         # Book data management
├── highlights.js           # Kindle highlights feature
├── static-bookshelf-generator.js  # Static page generation
└── server.js               # Backend API server
```

**Frontend Architecture Patterns:**

1. **MVC-like Pattern:**
   - **Model**: BookManager, UserManager (data management)
   - **View**: HTML templates, CSS styling
   - **Controller**: VirtualBookshelf class (orchestrates model and view)

2. **Module Pattern:**
   - Each JavaScript file is a self-contained module
   - Classes encapsulate functionality
   - Global namespace pollution minimized

3. **Event-Driven Architecture:**
   - User interactions trigger events
   - Event listeners handle actions
   - Custom events for language changes

4. **State Management:**
   - LocalStorage for persistence
   - In-memory state in VirtualBookshelf class
   - Browser History API for navigation state

### Backend Architecture

**File Structure:**
```
bookbar/
└── server.js               # Express.js server
    ├── Database Connection Pool
    ├── Middleware Stack
    ├── Route Handlers
    └── Error Handlers
```

**Backend Architecture Patterns:**

1. **RESTful API Design:**
   - Resource-based URLs (`/api/books`, `/api/users`)
   - HTTP methods (GET, POST, PUT, DELETE)
   - Stateless requests
   - JSON responses

2. **Middleware Pattern:**
   - Authentication middleware (JWT verification)
   - Error handling middleware
   - CORS middleware
   - Request logging

3. **Connection Pooling:**
   - MySQL connection pool for efficiency
   - Reusable database connections
   - Automatic connection management

4. **Error Handling:**
   - Centralized error handling
   - Consistent error response format
   - Error logging

### Data Flow Architecture

**Request Flow:**
```
User Action (Click, Form Submit)
    ↓
Frontend Event Handler (bookshelf.js)
    ↓
API Call (fetch to /api/...)
    ↓
Express Route Handler (server.js)
    ↓
Authentication Middleware (JWT check)
    ↓
Business Logic Validation
    ↓
Database Query (MySQL)
    ↓
Response (JSON)
    ↓
Frontend State Update
    ↓
UI Re-render
```

**Data Persistence Flow:**
```
User Data Changes
    ↓
Frontend State Update
    ↓
API Call to Backend
    ↓
Database Update
    ↓
Response Confirmation
    ↓
LocalStorage Update (optional)
    ↓
UI Update
```

### Security Architecture

1. **Authentication:**
   - JWT tokens for stateless authentication
   - Token stored in LocalStorage (client-side)
   - Token expiration (24 hours)
   - Password hashing with bcrypt

2. **Authorization:**
   - Role-based access control (future)
   - Resource ownership validation
   - Mutual follow requirement for messaging

3. **Data Protection:**
   - SQL injection prevention (parameterized queries)
   - XSS prevention (input sanitization)
   - CORS configuration
   - Input validation

### Scalability Architecture

1. **Horizontal Scaling:**
   - Stateless API design
   - Database connection pooling
   - No server-side session storage

2. **Performance Optimization:**
   - Client-side caching (LocalStorage)
   - Lazy loading for book lists
   - Image optimization
   - Database indexing

3. **Future Scalability:**
   - Microservices architecture (future)
   - Redis for caching (future)
   - CDN for static assets (future)
   - Load balancing (future)

---

## 📊 Use Cases

### UC1: User Registration
**Actor**: New User  
**Precondition**: User is not registered  
**Main Flow**:
1. User clicks "SIGN UP" button
2. User fills in registration form (name, email, password, bio)
3. System validates input
4. System creates user account
5. System logs user in automatically
6. User is redirected to home page

**Alternative Flow**:
- 3a. Validation fails → Show error message
- 4a. Email already exists → Show error message

### UC2: User Login
**Actor**: Registered User  
**Precondition**: User has an account  
**Main Flow**:
1. User clicks "LOG IN" button
2. User enters email and password
3. System validates credentials
4. System generates JWT token
5. System stores token in LocalStorage
6. User is redirected to home page

**Alternative Flow**:
- 3a. Invalid credentials → Show error message

### UC3: Add Book Comment with Rating
**Actor**: Logged-in User  
**Precondition**: User is logged in, viewing book details  
**Main Flow**:
1. User navigates to book detail page
2. User enters comment text
3. User selects rating (1-5 stars)
4. User clicks "Save Comment"
5. System validates comment and rating
6. System saves comment to database
7. System updates book display with new comment

**Alternative Flow**:
- 5a. Comment is empty → Show error message
- 6a. Book not found → Show error message

### UC4: Follow User
**Actor**: Logged-in User  
**Precondition**: User is logged in, viewing another user's profile  
**Main Flow**:
1. User navigates to another user's profile
2. User clicks "Follow" button
3. System creates follow relationship
4. System updates UI to show "Unfollow" button
5. System creates notification for followed user

**Alternative Flow**:
- 2a. User tries to follow themselves → Show error message
- 3a. Already following → Toggle to unfollow

### UC5: Send Message
**Actor**: Logged-in User  
**Precondition**: User is logged in, mutual follow exists  
**Main Flow**:
1. User navigates to another user's profile
2. User clicks "Message" button (visible only if mutual follow)
3. System opens conversation view
4. User types message
5. User clicks "Send"
6. System validates message
7. System saves message to database
8. System creates notification for receiver
9. System displays message in conversation

**Alternative Flow**:
- 2a. No mutual follow → Message button not visible
- 6a. Message is empty → Show error message

### UC6: Switch Language
**Actor**: Any User  
**Precondition**: None  
**Main Flow**:
1. User clicks language switcher (EN/CS) in header
2. System toggles language
3. System updates all UI text
4. System saves language preference to LocalStorage
5. System updates dynamic content (modals, dropdowns)

**Alternative Flow**:
- 1a. Translation key missing → Fallback to English

---

## ✅ Functional Requirements

### FR1: User Management
- **FR1.1**: Users must be able to register (email, username, password)
- **FR1.2**: Users must be able to log in (email/username + password)
- **FR1.3**: Users must be able to update profile information (bio, username)
- **FR1.4**: Users must be able to upload profile photo (base64 format)
- **FR1.5**: Users must be able to change password
- **FR1.6**: Users must be able to log out

### FR2: Book Management
- **FR2.1**: Users must be able to add books (title, author, description, genre, cover_image, ASIN)
- **FR2.2**: Users must be able to edit books
- **FR2.3**: Users must be able to delete books
- **FR2.4**: Users must be able to search books (title, author)
- **FR2.5**: Users must be able to filter books (rating, genre)
- **FR2.6**: Users must be able to sort books (title, author, date)
- **FR2.7**: Users must be able to view book detail page

### FR3: Comments & Ratings
- **FR3.1**: Users must be able to write comments on books
- **FR3.2**: Users must be able to rate books with 1-5 stars
- **FR3.3**: Users must be able to edit their own comments
- **FR3.4**: Users must be able to delete their own comments
- **FR3.5**: Comments must be displayed on book detail page
- **FR3.6**: Comments must show username and rating

### FR4: Favorites
- **FR4.1**: Users must be able to add books to favorites
- **FR4.2**: Users must be able to remove books from favorites
- **FR4.3**: Users must be able to view favorite books
- **FR4.4**: Favorite status must be shown on book cards

### FR5: Social Features
- **FR5.1**: Users must be able to follow other users
- **FR5.2**: Users must be able to unfollow users
- **FR5.3**: Users must be able to view followers list
- **FR5.4**: Users must be able to view following list
- **FR5.5**: Users must be able to view other users' profiles
- **FR5.6**: Users must be able to search users (username, name)

### FR6: Messaging
- **FR6.1**: Users must be able to send messages to users they mutually follow
- **FR6.2**: Users must be able to view their messages
- **FR6.3**: Users must be able to view message history
- **FR6.4**: Messages must trigger real-time notifications
- **FR6.5**: Messages must have read/unread status

### FR7: Notifications
- **FR7.1**: Users must receive notifications when receiving new messages
- **FR7.2**: Users must receive notifications when being followed
- **FR7.3**: Users must be able to view all notifications on notifications page
- **FR7.4**: Notifications must have read/unread status
- **FR7.5**: Notifications must be checked automatically (polling)

### FR8: Navigation
- **FR8.1**: Browser back/forward buttons must work
- **FR8.2**: URL hash must reflect current view
- **FR8.3**: Current view must be preserved on page refresh
- **FR8.4**: View transitions must be added to history

### FR9: Internationalization
- **FR9.1**: Users must be able to select language (English/Czech)
- **FR9.2**: Language selection must be displayed in header (EN/CS switcher)
- **FR9.3**: Language selection must be stored in LocalStorage
- **FR9.4**: All UI text must be displayed in selected language
- **FR9.5**: Language change must be applied instantly (no page refresh required)
- **FR9.6**: Dynamic content (modals, dropdowns, notifications) must be translated
- **FR9.7**: Default language must be English
- **FR9.8**: Supported languages: English (en), Czech (cs)

---

## 🔧 Non-Functional Requirements

### NFR1: Performance
- **NFR1.1**: Page load time must be < 2 seconds
- **NFR1.2**: API response time must be < 500ms
- **NFR1.3**: Book list must use lazy loading
- **NFR1.4**: Images must be optimized
- **NFR1.5**: Language change must be applied in < 100ms

### NFR2: Security
- **NFR2.1**: Passwords must be hashed with bcrypt
- **NFR2.2**: Authentication must use JWT tokens
- **NFR2.3**: SQL injection protection (parameterized queries)
- **NFR2.4**: XSS protection (input sanitization)
- **NFR2.5**: CORS policies must be configured

### NFR3: Scalability
- **NFR3.1**: Database connection pooling must be used
- **NFR3.2**: Stateless API design
- **NFR3.3**: Architecture must support horizontal scaling

### NFR4: Usability
- **NFR4.1**: Responsive design (mobile, tablet, desktop)
- **NFR4.2**: Intuitive navigation
- **NFR4.3**: Clear error messages
- **NFR4.4**: Loading indicators
- **NFR4.5**: Language switcher must be accessible and visible
- **NFR4.6**: Language change must remember user preference

### NFR5: Reliability
- **NFR5.1**: Database transaction support
- **NFR5.2**: Error handling and logging
- **NFR5.3**: Graceful degradation
- **NFR5.4**: Fallback mechanism if translation keys are missing

### NFR6: Maintainability
- **NFR6.1**: Clean code structure
- **NFR6.2**: Modular design
- **NFR6.3**: Comprehensive error logging
- **NFR6.4**: Translation files must be centralized and manageable

### NFR7: Internationalization
- **NFR7.1**: UTF-8 character support (for Czech characters)
- **NFR7.2**: Preparation for RTL (Right-to-Left) language support (future)
- **NFR7.3**: Translation keys must be consistent and meaningful
- **NFR7.4**: Adding new languages must be easy (modular structure)

---

## 💾 Database Architecture

### Schema Overview

```sql
-- Users Table
CREATE TABLE users (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Books Table
CREATE TABLE books (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    asin VARCHAR(20) UNIQUE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    description TEXT,
    genre VARCHAR(255),
    cover_image VARCHAR(1024),
    user_id INT UNSIGNED,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comments Table (with ratings)
CREATE TABLE comments (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    book_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    comment TEXT NOT NULL,
    rating TINYINT UNSIGNED, -- 1-5 stars
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_comment (book_id, user_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reviews Table
CREATE TABLE reviews (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    book_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_review (book_id, user_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Favorites Table
CREATE TABLE favorites (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    book_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_favorite (book_id, user_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Followers Table
CREATE TABLE followers (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    follower_id INT UNSIGNED NOT NULL,
    following_id INT UNSIGNED NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_follow (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages Table
CREATE TABLE messages (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    sender_id INT UNSIGNED NOT NULL,
    receiver_id INT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notifications Table
CREATE TABLE notifications (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'message', 'follow'
    message TEXT NOT NULL,
    related_user_id INT UNSIGNED,
    is_read TINYINT(1) DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Book Requests Table
CREATE TABLE book_requests (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    book_id INT UNSIGNED NOT NULL,
    requester_id INT UNSIGNED NOT NULL,
    owner_id INT UNSIGNED NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'returned') DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Indexes
- `users.email` - UNIQUE INDEX
- `users.username` - UNIQUE INDEX
- `books.asin` - UNIQUE INDEX
- `comments(book_id, user_id)` - UNIQUE INDEX
- `followers(follower_id, following_id)` - UNIQUE INDEX
- `messages(receiver_id, createdAt)` - INDEX for message queries
- `notifications(user_id, is_read, createdAt)` - INDEX for notification queries

### Relationships
- **users** → **books** (one-to-many)
- **users** → **comments** (one-to-many)
- **users** → **favorites** (one-to-many)
- **users** → **followers** (self-referential, many-to-many)
- **users** → **messages** (one-to-many, as sender and receiver)
- **users** → **notifications** (one-to-many)
- **books** → **comments** (one-to-many)
- **books** → **favorites** (one-to-many)

---

## 🔌 API Architecture

### API Endpoints

#### Authentication Endpoints
```
POST   /api/auth/register          - User registration
       Body: { name, email, password, bio? }
       Response: { token, user }

POST   /api/auth/login             - User login
       Body: { email, password }
       Response: { token, user }

GET    /api/auth/me                - Get current user
       Headers: Authorization: Bearer <token>
       Response: { user }

GET    /api/auth/check-username     - Check username availability
       Query: ?username=<username>
       Response: { available: boolean }

GET    /api/auth/check-email       - Check email availability
       Query: ?email=<email>
       Response: { available: boolean }
```

#### Books Endpoints
```
GET    /api/books                  - Get all books
       Query: ?page=1&limit=50
       Response: { books: [], total: number }

GET    /api/books/search           - Search books
       Query: ?title=<title>&author=<author>
       Response: { books: [] }

GET    /api/books/:id              - Get single book
       Response: { book }

POST   /api/books                  - Create book (authenticated)
       Headers: Authorization: Bearer <token>
       Body: { title, author, description?, genre?, cover_image?, asin? }
       Response: { book }

PUT    /api/books/:id              - Update book (authenticated)
       Headers: Authorization: Bearer <token>
       Body: { title?, author?, description?, genre?, cover_image? }
       Response: { book }

DELETE /api/books/:id              - Delete book (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }
```

#### Comments Endpoints
```
GET    /api/books/:bookId/comments - Get book comments
       Response: { comments: [] }

POST   /api/comments               - Create/update comment (authenticated)
       Headers: Authorization: Bearer <token>
       Body: { book_id, comment, rating? }
       Response: { comment }

GET    /api/comments/:commentId    - Get single comment
       Response: { comment }

DELETE /api/comments/:commentId    - Delete comment (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }
```

#### User Endpoints
```
GET    /api/users/:userId          - Get user profile
       Response: { user }

GET    /api/users/search           - Search users
       Query: ?q=<query>
       Response: { users: [] }

PUT    /api/users/profile          - Update profile (authenticated)
       Headers: Authorization: Bearer <token>
       Body: { bio?, username?, avatar? }
       Response: { user }

GET    /api/users/:userId/followers-count - Get followers count
       Response: { count: number }

GET    /api/users/:userId/following-count - Get following count
       Response: { count: number }

GET    /api/users/:userId/followers - Get followers list
       Response: { followers: [] }

GET    /api/users/:userId/following - Get following list
       Response: { following: [] }

GET    /api/users/:userId/follow-status - Check follow status
       Headers: Authorization: Bearer <token>
       Response: { isFollowing: boolean, isFollowedBy: boolean, isMutual: boolean }

POST   /api/users/:userId/follow   - Follow user (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }

DELETE /api/users/:userId/follow   - Unfollow user (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }
```

#### Messages Endpoints
```
GET    /api/messages               - Get conversations (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { conversations: [] }

GET    /api/messages/:userId       - Get messages with user (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { messages: [] }

POST   /api/messages               - Send message (authenticated, mutual follow required)
       Headers: Authorization: Bearer <token>
       Body: { receiver_id, content }
       Response: { message }
```

#### Notifications Endpoints
```
GET    /api/notifications           - Get notifications (authenticated)
       Headers: Authorization: Bearer <token>
       Query: ?unreadOnly=true
       Response: { notifications: [] }

PUT    /api/notifications/:id/read  - Mark as read (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }

PUT    /api/notifications/read-all - Mark all as read (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }
```

#### Favorites Endpoints
```
GET    /api/users/:userId/favorites - Get user favorites
       Response: { favorites: [] }

POST   /api/books/:bookId/favorite - Add to favorites (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }

DELETE /api/books/:bookId/favorite - Remove from favorites (authenticated)
       Headers: Authorization: Bearer <token>
       Response: { success: true }
```

### API Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": "Additional details"
}
```

### Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <token>
```

---

## 🧠 Business Logic

### Core Business Rules

1. **Authentication & Authorization**
   - JWT token required for protected endpoints
   - Token expiration: 24 hours (configurable)
   - Password hashing: bcrypt with 10 salt rounds
   - Token stored in LocalStorage on client side

2. **Messaging Rules**
   - Users can only message if mutual follow exists
   - Message notifications created automatically
   - Messages marked as read when viewed
   - Message content must not be empty

3. **Rating Rules**
   - Rating must be between 1-5 (TINYINT UNSIGNED)
   - Rating is optional (can comment without rating)
   - Rating displayed with stars (★/☆)
   - One rating per user per book

4. **Follow Rules**
   - Users cannot follow themselves
   - Follow relationship is bidirectional (follower_id, following_id)
   - Mutual follow required for messaging
   - Follow status checked before message send

5. **Book Search Rules**
   - Search by title (exact, case-insensitive, LIKE)
   - Search by author (exact, case-insensitive, LIKE)
   - Combined title+author search
   - ASIN search (fallback, less reliable)
   - Search results ordered by relevance

6. **Comment Rules**
   - One comment per user per book (ON DUPLICATE KEY UPDATE)
   - Comments can include rating
   - Users can edit/delete own comments
   - Comment text must not be empty
   - Comments displayed with username and timestamp

7. **Notification Rules**
   - Created on: new message, new follow
   - Polling interval: 10 seconds
   - Toast notification for new messages
   - Mark as read when viewed
   - Notification types: 'message', 'follow'

8. **Language Management Rules**
   - Default language: English (en)
   - Supported languages: English (en), Czech (cs)
   - Language preference stored in LocalStorage
   - Language change triggers immediate UI update
   - Fallback to English if translation key missing
   - All UI elements must support translation
   - Dynamic content (modals, dropdowns) must update on language change

### Validation Rules

**User Registration:**
- Email must be valid format
- Email must be unique
- Username must be unique
- Password must be at least 6 characters
- Name is required

**Book Creation:**
- Title is required
- ASIN must be unique (if provided)
- Cover image URL must be valid (if provided)

**Comment Creation:**
- Comment text is required
- Rating must be 1-5 (if provided)
- Book must exist
- User must be authenticated

**Message Sending:**
- Content is required
- Mutual follow must exist
- Receiver must exist
- User must be authenticated

---

## 🎯 Frontend Architecture

### Main Components

1. **VirtualBookshelf Class** (bookshelf.js)
   - State management
   - View rendering
   - Event handling
   - API communication
   - History management
   - Language change listener

2. **TranslationManager Class** (translations.js)
   - Language management
   - Translation lookup
   - Dynamic content updates
   - LocalStorage persistence
   - Event dispatching

3. **BookManager Class** (book-manager.js)
   - Book data loading
   - Image URL handling
   - Amazon URL generation
   - Book CRUD operations

4. **UserManager Class** (bookshelf.js)
   - Authentication
   - User data caching
   - Token management

### State Management

```javascript
{
  books: Array<Book>,
  userData: {
    id: Number,
    username: String,
    email: String,
    bio: String,
    avatar: String
  },
  currentViewMode: String, // 'all', 'profile', 'messages', etc.
  filteredBooks: Array<Book>,
  currentPage: Number,
  booksPerPage: Number,
  sortOrder: String,
  sortDirection: String,
  currentLanguage: String // 'en' or 'cs'
}
```

### Data Flow

```
User Action
    ↓
Event Handler
    ↓
API Call (fetch)
    ↓
Backend Processing
    ↓
Database Query
    ↓
Response
    ↓
State Update
    ↓
UI Re-render
    ↓
Translation Applied (if needed)
```

### Browser History Management

The application uses HTML5 History API for navigation:
- `pushState()` when navigating to new view
- `popstate` event listener for back/forward buttons
- URL hash reflects current view
- View state preserved on page refresh

---

## 🌐 Internationalization (i18n) Architecture

### Translation System

**File Structure:**
```
bookbar/
├── translations.js          # Translation manager & dictionary
├── index.html               # HTML with data-i18n attributes
├── bookshelf.js             # JavaScript with translation support
└── bookshelf.css            # Styles for language switcher
```

**Translation Keys Format:**
```
category.key
Examples:
- nav.books
- auth.login
- book.title
- profile.followers
```

**Supported Languages:**
- English (en) - Default
- Czech (cs)

**Implementation:**
1. **TranslationManager Class**: Centralized translation management
2. **data-i18n attributes**: HTML elements marked for translation
3. **Dynamic updates**: Event-driven translation updates
4. **LocalStorage**: Language preference persistence

**Usage Example:**
```javascript
// In HTML
<button data-i18n="auth.login">LOG IN</button>

// In JavaScript
const text = window.translationManager.t('auth.login', 'LOG IN');
```

**Language Switcher:**
- Located in header (right side)
- Format: "EN/CS" or "CS/EN"
- Click to toggle between languages
- Current language highlighted
- Preference saved to LocalStorage

---

## 📈 Future Enhancements

1. **Real-time Messaging**: WebSocket integration for instant messaging
2. **Book Recommendations**: AI-based book recommendations
3. **Reading Challenges**: Annual reading goals and challenges
4. **Book Clubs**: Group discussions and book clubs
5. **Export/Import**: Export library to CSV/JSON
6. **Mobile App**: React Native or Flutter mobile application
7. **Advanced Search**: Full-text search with Elasticsearch
8. **Social Sharing**: Share books on social media
9. **Reading Statistics**: Charts and graphs for reading habits
10. **Book Reviews**: Separate detailed review system
11. **Additional Languages**: German, French, Spanish, Turkish
12. **RTL Support**: Right-to-left language support (Arabic, Hebrew)
13. **Language Auto-detection**: Browser language detection

---

## 🔐 Security Considerations

1. **Authentication**: JWT tokens with expiration
2. **Password Security**: bcrypt hashing with salt
3. **SQL Injection**: Parameterized queries
4. **XSS Protection**: Input sanitization and escaping
5. **CORS**: Configured for specific origins
6. **Rate Limiting**: (To be implemented)
7. **HTTPS**: Required in production
8. **Input Validation**: Server-side validation
9. **Translation Security**: Sanitize translation keys to prevent XSS

---

## 📝 Conclusion

BookBar is a comprehensive social book management platform that combines personal library management with social networking features. The architecture is designed to be scalable, maintainable, and user-friendly, with a clear separation of concerns between frontend, backend, and database layers.

The platform enables book lovers to organize their reading, connect with other readers, discover new books, and build a community around shared reading interests. With the addition of internationalization support, BookBar now serves a global audience with English and Czech language options.

---

**Document Version**: 2.0  
**Last Updated**: 2024  
**Author**: BookBar Development Team

**Changelog:**
- v2.0: Added Internationalization (i18n) support for English and Czech languages
- v1.0: Initial documentation
