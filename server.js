// BookBar - Node.js Backend Server (MySQL Edition)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bookbar-secret-key';

// Aiven Bağlantı Bilgileri (Global Değişkenler)
const DB_HOST = 'mysql-2e9d0ad1-ozenirruya-11db.f.aivencloud.com';
const DB_USER = 'avnadmin';
const DB_PASSWORD = 'AVNS_TIDKZUD69cYtVvIiQKt';
const DB_NAME = 'defaultdb';
const DB_PORT = 25372;

let pool;

// --- MIDDLEWARE (Sadece bir kez tanımlıyoruz) ---
app.use(cors({
    origin: "https://bookbar.store", // GitHub Pages adresin
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname)); 
// ------------------------------------------------

async function initializeDatabase() {
    try {
        // Aiven'da veritabanı zaten var (defaultdb), o yüzden CREATE DATABASE kısmını geçebiliriz
        // Direkt pool oluşturuyoruz:
        pool = mysql.createPool({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            port: DB_PORT,
            ssl: {
                rejectUnauthorized: false // Aiven için ŞART
            },
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        console.log('✅ Connected to Aiven MySQL');
        
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await connection.end();

        // Create pool bound to the database
        pool = mysql.createPool({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            database: DB_NAME,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Create tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                bio TEXT,
                avatar TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        // Update avatar column to TEXT if it exists as VARCHAR (for existing databases)
        try {
            await pool.query('ALTER TABLE users MODIFY COLUMN avatar TEXT');
        } catch (error) {
            // Column might not exist or already be TEXT, ignore error
            if (error.code !== 'ER_BAD_FIELD_ERROR' && error.code !== 'ER_DUP_FIELDNAME') {
                console.warn('Could not update avatar column (may already be TEXT):', error.message);
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS books (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                book_id INT UNSIGNED NOT NULL,
                user_id INT UNSIGNED NOT NULL,
                rating TINYINT UNSIGNED NOT NULL,
                comment TEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_review (book_id, user_id),
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                book_id INT UNSIGNED NOT NULL,
                user_id INT UNSIGNED NOT NULL,
                comment TEXT NOT NULL,
                rating TINYINT UNSIGNED,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_comment (book_id, user_id),
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        // Add rating column if it doesn't exist (for existing databases)
        try {
            await pool.query('ALTER TABLE comments ADD COLUMN rating TINYINT UNSIGNED');
        } catch (error) {
            // Column already exists, ignore error
            if (error.code !== 'ER_DUP_FIELDNAME') {
                console.warn('Could not add rating column (may already exist):', error.message);
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                book_id INT UNSIGNED NOT NULL,
                user_id INT UNSIGNED NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_favorite (book_id, user_id),
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                sender_id INT UNSIGNED NOT NULL,
                receiver_id INT UNSIGNED NOT NULL,
                content TEXT NOT NULL,
                is_read TINYINT(1) DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS book_requests (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                book_id INT UNSIGNED NOT NULL,
                requester_id INT UNSIGNED NOT NULL,
                owner_id INT UNSIGNED NOT NULL,
                status ENUM('pending', 'accepted', 'rejected', 'returned') DEFAULT 'pending',
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
                FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS followers (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                follower_id INT UNSIGNED NOT NULL,
                following_id INT UNSIGNED NOT NULL,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_follow (follower_id, following_id),
                FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id INT UNSIGNED NOT NULL,
                type VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                related_user_id INT UNSIGNED,
                is_read TINYINT(1) DEFAULT 0,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('✅ Connected to MySQL database');
        console.log('✅ Database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
        process.exit(1);
    }
}

// Helper to run queries safely
async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('AuthenticateToken - Path:', req.path, 'Method:', req.method, 'Has token:', !!token);

    if (!token) {
        console.log('No token provided for:', req.method, req.path);
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
    const { name, username, email, password, bio } = req.body;

    if (!name || !username || !email || !password) {
        return res.status(400).json({ error: 'Name, username, email and password are required' });
    }

    try {
        // Check if username already exists
        const [usernameCheck] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (usernameCheck.length > 0) {
            return res.status(409).json({ error: 'This username is already registered.' });
        }

        // Check if email already exists
        const [emailCheck] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        if (emailCheck.length > 0) {
            return res.status(409).json({ error: 'This email is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (name, username, email, password, bio) VALUES (?, ?, ?, ?, ?)',
            [name, username, email, hashedPassword, bio || null]
        );

        const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET);
        res.status(201).json({
            success: true,
            token,
            user: { id: result.insertId, name, username, email, bio }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already registered' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const users = await query('SELECT id, name, username, email, password, bio, avatar, createdAt FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        delete user.password;

        res.json({
            success: true,
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const users = await query(
            'SELECT id, name, username, email, bio, avatar, createdAt FROM users WHERE id = ?',
            [req.user.id]
        );
        const user = users[0];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Fetch current user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ==================== BOOKS ROUTES ====================

const BOOK_BASE_QUERY = `
    SELECT 
        b.*,
        u.name AS owner_name,
        COALESCE(r.avg_rating, 0) AS avg_rating,
        COALESCE(r.review_count, 0) AS review_count,
        COALESCE(f.favorite_count, 0) AS favorite_count
    FROM books b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN (
        SELECT book_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
        FROM reviews
        GROUP BY book_id
    ) r ON b.id = r.book_id
    LEFT JOIN (
        SELECT book_id, COUNT(*) AS favorite_count
        FROM favorites
        GROUP BY book_id
    ) f ON b.id = f.book_id
`;

// Get all books
app.get('/api/books', async (req, res) => {
    try {
        const books = await query(`${BOOK_BASE_QUERY} ORDER BY b.createdAt DESC`);
        res.json({ books });
    } catch (error) {
        console.error('Fetch books error:', error);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// Search books by title and/or author
// IMPORTANT: This must come BEFORE /api/books/:id to avoid route conflicts
app.get('/api/books/search', async (req, res) => {
    const { title, author } = req.query;
    
    try {
        let books;
        
        if (title && author) {
            // First try exact match
            books = await query(
                `${BOOK_BASE_QUERY} WHERE b.title = ? AND b.author = ? LIMIT 10`,
                [title, author]
            );
            
            // If no exact match, try case-insensitive exact match
            if (books.length === 0) {
                books = await query(
                    `${BOOK_BASE_QUERY} WHERE LOWER(b.title) = LOWER(?) AND LOWER(b.author) = LOWER(?) LIMIT 10`,
                    [title, author]
                );
            }
            
            // If still no match, try LIKE (partial match)
            if (books.length === 0) {
                books = await query(
                    `${BOOK_BASE_QUERY} WHERE b.title LIKE ? AND b.author LIKE ? LIMIT 10`,
                    [`%${title}%`, `%${author}%`]
                );
            }
            
            // If still no match, try title only (author might be slightly different)
            if (books.length === 0) {
                books = await query(
                    `${BOOK_BASE_QUERY} WHERE b.title = ? LIMIT 10`,
                    [title]
                );
            }
        } else if (title) {
            // First try exact match
            books = await query(
                `${BOOK_BASE_QUERY} WHERE b.title = ? LIMIT 10`,
                [title]
            );
            
            // If no exact match, try LIKE
            if (books.length === 0) {
                books = await query(
                    `${BOOK_BASE_QUERY} WHERE b.title LIKE ? LIMIT 10`,
                    [`%${title}%`]
                );
            }
        } else if (author) {
            // First try exact match
            books = await query(
                `${BOOK_BASE_QUERY} WHERE b.author = ? LIMIT 10`,
                [author]
            );
            
            // If no exact match, try LIKE
            if (books.length === 0) {
                books = await query(
                    `${BOOK_BASE_QUERY} WHERE b.author LIKE ? LIMIT 10`,
                    [`%${author}%`]
                );
            }
        } else {
            return res.status(400).json({ error: 'Title or author parameter required' });
        }
        
        res.json({ books });
    } catch (error) {
        console.error('Search books error:', error);
        res.status(500).json({ error: 'Failed to search books' });
    }
});

// Get single book
app.get('/api/books/:id', async (req, res) => {
    const identifier = req.params.id;

    try {
        // Check if identifier is numeric (ID) or string (ASIN)
        const isNumeric = /^\d+$/.test(identifier);
        
        let books;
        if (isNumeric) {
            // Search by ID first, then ASIN
            books = await query(
                `${BOOK_BASE_QUERY} WHERE b.id = ? LIMIT 1`,
                [identifier]
            );
            // If not found by ID, try ASIN
            if (books.length === 0) {
                books = await query(
                    `${BOOK_BASE_QUERY} WHERE b.asin = ? LIMIT 1`,
                    [identifier]
                );
            }
        } else {
            // Search by ASIN
            books = await query(
                `${BOOK_BASE_QUERY} WHERE b.asin = ? LIMIT 1`,
                [identifier]
            );
        }
        
        const book = books[0];

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json({ book });
    } catch (error) {
        console.error('Fetch book error:', error);
        res.status(500).json({ error: 'Failed to fetch book' });
    }
});

// Create book (authenticated)
app.post('/api/books', authenticateToken, async (req, res) => {
    const { asin, title, author, description, genre, cover_image } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        const [result] = await pool.execute(
            'INSERT INTO books (asin, title, author, description, genre, cover_image, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [asin || null, title, author || null, description || null, genre || null, cover_image || null, req.user.id]
        );

        const books = await query(`${BOOK_BASE_QUERY} WHERE b.id = ?`, [result.insertId]);
        res.status(201).json({ book: books[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Book with this ASIN already exists' });
        }
        console.error('Create book error:', error);
        res.status(500).json({ error: 'Failed to create book' });
    }
});

// Update book (authenticated, owner only)
app.put('/api/books/:id', authenticateToken, async (req, res) => {
    const { title, author, description, genre, cover_image } = req.body;

    try {
        const books = await query('SELECT user_id FROM books WHERE id = ?', [req.params.id]);
        const book = books[0];

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }
        if (book.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to update this book' });
        }

        await pool.execute(
            'UPDATE books SET title = ?, author = ?, description = ?, genre = ?, cover_image = ? WHERE id = ?',
            [title, author, description, genre, cover_image, req.params.id]
        );

        const updated = await query(`${BOOK_BASE_QUERY} WHERE b.id = ?`, [req.params.id]);
        res.json({ book: updated[0] });
    } catch (error) {
        console.error('Update book error:', error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// Delete book (authenticated, owner only)
app.delete('/api/books/:id', authenticateToken, async (req, res) => {
    try {
        const books = await query('SELECT user_id FROM books WHERE id = ?', [req.params.id]);
        const book = books[0];

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }
        if (book.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this book' });
        }

        await pool.execute('DELETE FROM books WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Book deleted' });
    } catch (error) {
        console.error('Delete book error:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// Import books from JSON (authenticated)
app.post('/api/books/import', authenticateToken, async (req, res) => {
    const { books } = req.body;

    if (!Array.isArray(books) || books.length === 0) {
        return res.status(400).json({ error: 'Books array is required' });
    }

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    for (const [index, bookData] of books.entries()) {
        const coverImage = bookData.cover_image || bookData.cover_image_url || null;
        const { asin, title, author, description, genre, average_rating } = bookData;

        if (!title) {
            results.failed++;
            results.errors.push({ index, error: 'Title is required' });
            continue;
        }

        try {
            const [result] = await pool.execute(
                'INSERT INTO books (asin, title, author, description, genre, cover_image, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [asin || null, title, author || null, description || null, genre || null, coverImage, req.user.id]
            );

            results.success++;

            if (average_rating && result.insertId) {
                const rating = Math.round(average_rating);
                if (rating >= 1 && rating <= 5) {
                    await pool.execute(
                        `INSERT INTO reviews (book_id, user_id, rating)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE rating = VALUES(rating), createdAt = CURRENT_TIMESTAMP`,
                        [result.insertId, req.user.id, rating]
                    );
                }
            }
        } catch (error) {
            results.failed++;
            const errorMessage = error.code === 'ER_DUP_ENTRY'
                ? 'Book already exists (duplicate ASIN or title)'
                : error.message;
            results.errors.push({ index, title, error: errorMessage });
        }
    }

    res.json(results);
});

// ==================== REVIEWS ROUTES ====================

// Get reviews for a book
app.get('/api/books/:bookId/reviews', authenticateTokenOptional, async (req, res) => {
    try {
        const reviews = await query(
            `SELECT r.*, u.name AS user_name, u.avatar
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             WHERE r.book_id = ?
             ORDER BY r.createdAt DESC`,
            [req.params.bookId]
        );

        // Ensure rating is numeric
        reviews.forEach(review => review.rating = Number(review.rating));

        res.json({ reviews });
    } catch (error) {
        console.error('Fetch reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Create/Update review (authenticated)
app.post('/api/books/:bookId/reviews', authenticateToken, async (req, res) => {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        await pool.execute(
            `INSERT INTO reviews (book_id, user_id, rating, comment)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                rating = VALUES(rating),
                comment = VALUES(comment),
                createdAt = CURRENT_TIMESTAMP`,
            [req.params.bookId, req.user.id, rating, comment || null]
        );

        const reviews = await query(
            `SELECT r.*, u.name AS user_name, u.avatar
             FROM reviews r
             JOIN users u ON r.user_id = u.id
             WHERE r.book_id = ? AND r.user_id = ?
             LIMIT 1`,
            [req.params.bookId, req.user.id]
        );

        const review = reviews[0];
        if (review) {
            review.rating = Number(review.rating);
        }

        res.status(201).json({ review });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ error: 'Failed to save review' });
    }
});

// ==================== FAVORITES ROUTES ====================

// Get user's favorites
app.get('/api/users/:userId/favorites', authenticateToken, async (req, res) => {
    if (parseInt(req.params.userId, 10) !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    try {
        const books = await query(
            `${BOOK_BASE_QUERY}
             JOIN favorites fav ON fav.book_id = b.id
             WHERE fav.user_id = ?
             ORDER BY fav.createdAt DESC`,
            [req.user.id]
        );

        res.json({ books });
    } catch (error) {
        console.error('Fetch favorites error:', error);
        res.status(500).json({ error: 'Failed to fetch favorites' });
    }
});

// Add to favorites
app.post('/api/books/:bookId/favorite', authenticateToken, async (req, res) => {
    try {
        await pool.execute(
            'INSERT IGNORE INTO favorites (book_id, user_id) VALUES (?, ?)',
            [req.params.bookId, req.user.id]
        );
        res.json({ success: true, message: 'Book added to favorites' });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// Remove from favorites
app.delete('/api/books/:bookId/favorite', authenticateToken, async (req, res) => {
    try {
        await pool.execute(
            'DELETE FROM favorites WHERE book_id = ? AND user_id = ?',
            [req.params.bookId, req.user.id]
        );
        res.json({ success: true, message: 'Book removed from favorites' });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// ==================== MESSAGES ROUTES ====================

// Helper to allow optional auth (for review listing)
function authenticateTokenOptional(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return next();
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (!err) {
            req.user = user;
        }
        next();
    });
}

// Old message endpoints removed - using the new ones below with mutual follow checks

// ==================== BOOK REQUESTS ROUTES ====================

// Get user's book requests
app.get('/api/requests', authenticateToken, async (req, res) => {
    const { type = 'sent' } = req.query;

    try {
        let requests;
        if (type === 'sent') {
            requests = await query(
                `SELECT br.*, b.title, b.cover_image, u.name AS owner_name
                 FROM book_requests br
                 JOIN books b ON br.book_id = b.id
                 JOIN users u ON br.owner_id = u.id
                 WHERE br.requester_id = ?
                 ORDER BY br.createdAt DESC`,
                [req.user.id]
            );
        } else {
            requests = await query(
                `SELECT br.*, b.title, b.cover_image, u.name AS requester_name
                 FROM book_requests br
                 JOIN books b ON br.book_id = b.id
                 JOIN users u ON br.requester_id = u.id
                 WHERE br.owner_id = ?
                 ORDER BY br.createdAt DESC`,
                [req.user.id]
            );
        }

        res.json({ requests });
    } catch (error) {
        console.error('Fetch requests error:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Create book request
app.post('/api/books/:bookId/request', authenticateToken, async (req, res) => {
    try {
        const books = await query('SELECT user_id FROM books WHERE id = ?', [req.params.bookId]);
        const book = books[0];

        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }
        if (book.user_id === req.user.id) {
            return res.status(400).json({ error: 'Cannot request your own book' });
        }

        await pool.execute(
            'INSERT INTO book_requests (book_id, requester_id, owner_id) VALUES (?, ?, ?)',
            [req.params.bookId, req.user.id, book.user_id]
        );

        res.status(201).json({ success: true, message: 'Request sent' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Request already exists' });
        }
        console.error('Create request error:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// Update request status (accept/reject/returned)
app.put('/api/requests/:requestId', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const allowed = ['accepted', 'rejected', 'returned'];

    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const requests = await query(
            'SELECT owner_id FROM book_requests WHERE id = ?',
            [req.params.requestId]
        );
        const request = requests[0];

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (request.owner_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await pool.execute(
            'UPDATE book_requests SET status = ? WHERE id = ?',
            [status, req.params.requestId]
        );

        res.json({ success: true, message: 'Request updated' });
    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({ error: 'Failed to update request' });
    }
});

// ==================== USER PROFILE ROUTES ====================

// Update user profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
    const { bio, username, avatar } = req.body;
    
    try {
        if (bio !== undefined) {
            await pool.execute(
                'UPDATE users SET bio = ? WHERE id = ?',
                [bio || null, req.user.id]
            );
        }
        
        if (username !== undefined && username.trim() !== '') {
            // Check if username is already taken
            const [existing] = await pool.execute(
                'SELECT id FROM users WHERE username = ? AND id != ?',
                [username.trim(), req.user.id]
            );
            
            if (existing.length > 0) {
                return res.status(409).json({ error: 'Username is already taken' });
            }
            
            await pool.execute(
                'UPDATE users SET username = ? WHERE id = ?',
                [username.trim(), req.user.id]
            );
        }
        
        if (avatar !== undefined) {
            // Accept avatar as URL or base64 data URL
            await pool.execute(
                'UPDATE users SET avatar = ? WHERE id = ?',
                [avatar || null, req.user.id]
            );
        }
        
        // Return updated user
        const [users] = await pool.execute(
            'SELECT id, name, username, email, bio, avatar, createdAt FROM users WHERE id = ?',
            [req.user.id]
        );
        
        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Update profile error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username is already taken' });
        }
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Verify current password
app.post('/api/users/verify-password', authenticateToken, async (req, res) => {
    const { currentPassword } = req.body;
    
    if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
    }
    
    try {
        // Get current user with password
        const [users] = await pool.execute(
            'SELECT id, password FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[0];
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (isValidPassword) {
            res.json({ success: true, valid: true });
        } else {
            res.json({ success: true, valid: false });
        }
    } catch (error) {
        console.error('Verify password error:', error);
        res.status(500).json({ error: 'Failed to verify password' });
    }
});

// Change password
app.put('/api/users/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
    }
    
    if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
    }
    
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }
    
    try {
        // Get current user with password
        const [users] = await pool.execute(
            'SELECT id, password FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const user = users[0];
        
        // Verify current password (required)
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        await pool.execute(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.user.id]
        );
        
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Search users (optional auth for demo mode)
app.get('/api/users/search', async (req, res) => {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }
    
    try {
        // Check if user is authenticated
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = decoded;
                
                // User is authenticated, search database
                const [users] = await pool.execute(
                    'SELECT id, name, username, email, bio, avatar, createdAt FROM users WHERE username LIKE ? OR name LIKE ? LIMIT 20',
                    [`%${q}%`, `%${q}%`]
                );
                
                return res.json({ success: true, users });
            } catch (jwtError) {
                // Invalid token, continue to demo mode
                console.log('Invalid token, using demo mode');
            }
        }
        
        // Demo mode or no token - return empty results (client will use demo data)
        res.json({ success: true, users: [] });
    } catch (error) {
        console.error('Search users error:', error);
        // On error, return empty results (client will use demo data)
        res.json({ success: true, users: [] });
    }
});

// Check username availability
app.get('/api/auth/check-username', async (req, res) => {
    const { username } = req.query;
    
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        res.json({ taken: users.length > 0 });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: 'Failed to check username' });
    }
});

// Check email availability
app.get('/api/auth/check-email', async (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    try {
        const [users] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        
        res.json({ taken: users.length > 0 });
    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({ error: 'Failed to check email' });
    }
});

// ==================== FOLLOWERS ROUTES ====================

// Follow a user
app.post('/api/users/:userId/follow', authenticateToken, async (req, res) => {
    console.log('Follow endpoint called - userId:', req.params.userId, 'followerId:', req.user?.id);
    const { userId } = req.params;
    const followerId = req.user.id;
    
    if (parseInt(userId) === followerId) {
        return res.status(400).json({ error: 'Cannot follow yourself' });
    }
    
    try {
        // Check if user exists
        const [users] = await pool.execute('SELECT id, username, name FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const followingUser = users[0];
        
        // Check if already following
        const [existing] = await pool.execute(
            'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
            [followerId, userId]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Already following this user' });
        }
        
        // Add follow relationship
        await pool.execute(
            'INSERT INTO followers (follower_id, following_id) VALUES (?, ?)',
            [followerId, userId]
        );
        
        // Get follower info for notification
        const [followerInfo] = await pool.execute('SELECT username, name FROM users WHERE id = ?', [followerId]);
        const follower = followerInfo[0];
        const followerName = follower.username || follower.name || 'Someone';
        
        // Create notification for the followed user
        await pool.execute(
            'INSERT INTO notifications (user_id, type, message, related_user_id) VALUES (?, ?, ?, ?)',
            [userId, 'follow', `${followerName} started following you`, followerId]
        );
        
        res.json({ success: true, message: 'User followed successfully' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Already following this user' });
        }
        console.error('Follow user error:', error);
        res.status(500).json({ error: 'Failed to follow user' });
    }
});

// Unfollow a user
app.delete('/api/users/:userId/follow', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    const followerId = req.user.id;
    
    try {
        await pool.execute(
            'DELETE FROM followers WHERE follower_id = ? AND following_id = ?',
            [followerId, userId]
        );
        
        res.json({ success: true, message: 'User unfollowed successfully' });
    } catch (error) {
        console.error('Unfollow user error:', error);
        res.status(500).json({ error: 'Failed to unfollow user' });
    }
});

// Check if following a user
app.get('/api/users/:userId/follow-status', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    const followerId = req.user.id;
    
    try {
        const [follows] = await pool.execute(
            'SELECT id FROM followers WHERE follower_id = ? AND following_id = ?',
            [followerId, userId]
        );
        
        res.json({ isFollowing: follows.length > 0 });
    } catch (error) {
        console.error('Check follow status error:', error);
        res.status(500).json({ error: 'Failed to check follow status' });
    }
});

// Get followers count
app.get('/api/users/:userId/followers-count', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const [count] = await pool.execute(
            'SELECT COUNT(*) as count FROM followers WHERE following_id = ?',
            [userId]
        );
        
        res.json({ count: count[0].count });
    } catch (error) {
        console.error('Get followers count error:', error);
        res.status(500).json({ error: 'Failed to get followers count' });
    }
});

// Get following count
app.get('/api/users/:userId/following-count', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const [count] = await pool.execute(
            'SELECT COUNT(*) as count FROM followers WHERE follower_id = ?',
            [userId]
        );
        
        res.json({ count: count[0].count });
    } catch (error) {
        console.error('Get following count error:', error);
        res.status(500).json({ error: 'Failed to get following count' });
    }
});

// Get followers list
app.get('/api/users/:userId/followers', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const [followers] = await pool.execute(
            `SELECT u.id, u.username, u.name, u.email, u.bio, u.avatar, f.createdAt
             FROM followers f
             INNER JOIN users u ON f.follower_id = u.id
             WHERE f.following_id = ?
             ORDER BY f.createdAt DESC`,
            [userId]
        );
        
        res.json({ followers });
    } catch (error) {
        console.error('Get followers list error:', error);
        res.status(500).json({ error: 'Failed to get followers list' });
    }
});

// Get following list
app.get('/api/users/:userId/following', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const [following] = await pool.execute(
            `SELECT u.id, u.username, u.name, u.email, u.bio, u.avatar, f.createdAt
             FROM followers f
             INNER JOIN users u ON f.following_id = u.id
             WHERE f.follower_id = ?
             ORDER BY f.createdAt DESC`,
            [userId]
        );
        
        res.json({ following });
    } catch (error) {
        console.error('Get following list error:', error);
        res.status(500).json({ error: 'Failed to get following list' });
    }
});

// Get user by ID
app.get('/api/users/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const [users] = await pool.execute(
            'SELECT id, username, name, email, bio, avatar, createdAt FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user: users[0] });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Get user comments
app.get('/api/users/:userId/comments', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    
    // Only allow users to see their own comments
    if (parseInt(userId) !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [comments] = await pool.execute(
            `SELECT c.*, b.title AS book_title, b.asin
             FROM comments c
             INNER JOIN books b ON c.book_id = b.id
             WHERE c.user_id = ?
             ORDER BY c.createdAt DESC`,
            [userId]
        );
        
        res.json({ comments });
    } catch (error) {
        console.error('Get user comments error:', error);
        res.status(500).json({ error: 'Failed to get user comments' });
    }
});

// ==================== COMMENTS ROUTES ====================

// Create/Update comment
app.post('/api/comments', authenticateToken, async (req, res) => {
    const { book_id, comment, rating } = req.body;
    
    if (!book_id) {
        return res.status(400).json({ error: 'Book ID is required' });
    }
    
    if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
    }
    
    // Validate rating if provided (1-5)
    if (rating !== undefined && rating !== null) {
        const ratingNum = parseInt(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
    }
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'User authentication required' });
    }
    
    try {
        // Check if book exists
        const [books] = await pool.execute('SELECT id FROM books WHERE id = ?', [book_id]);
        if (books.length === 0) {
            console.error(`Book not found: book_id=${book_id}`);
            return res.status(404).json({ error: 'Book not found' });
        }
        
        // Insert or update comment
        const ratingValue = rating !== undefined && rating !== null ? parseInt(rating) : null;
        await pool.execute(
            `INSERT INTO comments (book_id, user_id, comment, rating)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                comment = VALUES(comment),
                rating = VALUES(rating),
                createdAt = CURRENT_TIMESTAMP`,
            [book_id, req.user.id, comment.trim(), ratingValue]
        );
        
        const [newComment] = await pool.execute(
            `SELECT c.*, b.title AS book_title
             FROM comments c
             INNER JOIN books b ON c.book_id = b.id
             WHERE c.book_id = ? AND c.user_id = ?
             LIMIT 1`,
            [book_id, req.user.id]
        );
        
        if (!newComment || newComment.length === 0) {
            console.error(`Comment not found after insert: book_id=${book_id}, user_id=${req.user.id}`);
            return res.status(500).json({ error: 'Comment saved but not found' });
        }
        
        res.status(201).json({ comment: newComment[0] });
    } catch (error) {
        console.error('Create comment error:', error);
        console.error('Error details:', {
            book_id,
            user_id: req.user?.id,
            error_message: error.message,
            error_code: error.code
        });
        res.status(500).json({ 
            error: 'Failed to save comment',
            details: error.message 
        });
    }
});

// Get comment by ID
app.get('/api/comments/:commentId', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    
    try {
        const [comments] = await pool.execute(
            `SELECT c.*, b.title AS book_title, b.asin
             FROM comments c
             INNER JOIN books b ON c.book_id = b.id
             WHERE c.id = ?`,
            [commentId]
        );
        
        if (comments.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        res.json({ comment: comments[0] });
    } catch (error) {
        console.error('Get comment error:', error);
        res.status(500).json({ error: 'Failed to get comment' });
    }
});

// Get comments for a book
app.get('/api/books/:bookId/comments', authenticateTokenOptional, async (req, res) => {
    const { bookId } = req.params;
    
    try {
        const [comments] = await pool.execute(
            `SELECT c.*, u.username, u.name
             FROM comments c
             INNER JOIN users u ON c.user_id = u.id
             WHERE c.book_id = ?
             ORDER BY c.createdAt DESC`,
            [bookId]
        );
        
        res.json({ comments });
    } catch (error) {
        console.error('Get book comments error:', error);
        res.status(500).json({ error: 'Failed to get book comments' });
    }
});

// Delete comment
app.delete('/api/comments/:commentId', authenticateToken, async (req, res) => {
    const { commentId } = req.params;
    
    try {
        // Check if comment exists and belongs to user
        const [comments] = await pool.execute(
            'SELECT user_id FROM comments WHERE id = ?',
            [commentId]
        );
        
        if (comments.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        if (comments[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await pool.execute('DELETE FROM comments WHERE id = ?', [commentId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ==================== MESSAGES ROUTES ====================

// Get conversations (list of users you've messaged or received messages from - only mutual follows)
app.get('/api/messages', authenticateToken, async (req, res) => {
    try {
        // First, get all conversations
        const [conversations] = await pool.execute(
            `SELECT 
                CASE 
                    WHEN m.sender_id = ? THEN m.receiver_id
                    ELSE m.sender_id
                END AS other_user_id,
                MAX(m.createdAt) AS last_message_time,
                SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) AS unread_count
             FROM messages m
             WHERE m.sender_id = ? OR m.receiver_id = ?
             GROUP BY other_user_id
             ORDER BY last_message_time DESC`,
            [req.user.id, req.user.id, req.user.id, req.user.id]
        );
        
        // Filter to only mutual follows
        const mutualFollows = await Promise.all(
            conversations.map(async (conv) => {
                // Check if mutual follow exists
                const [iFollow] = await pool.execute(
                    'SELECT COUNT(*) as count FROM followers WHERE follower_id = ? AND following_id = ?',
                    [req.user.id, conv.other_user_id]
                );
                const [theyFollow] = await pool.execute(
                    'SELECT COUNT(*) as count FROM followers WHERE follower_id = ? AND following_id = ?',
                    [conv.other_user_id, req.user.id]
                );
                
                const isMutual = iFollow[0]?.count > 0 && theyFollow[0]?.count > 0;
                
                if (!isMutual) return null;
                
                const [users] = await pool.execute(
                    'SELECT id, username, name FROM users WHERE id = ?',
                    [conv.other_user_id]
                );
                
                const [lastMessage] = await pool.execute(
                    `SELECT content FROM messages
                     WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                     ORDER BY createdAt DESC LIMIT 1`,
                    [req.user.id, conv.other_user_id, conv.other_user_id, req.user.id]
                );
                
                return {
                    otherUser: users[0],
                    lastMessage: lastMessage[0]?.content || '',
                    unreadCount: conv.unread_count || 0
                };
            })
        );
        
        // Filter out null values
        const validConversations = mutualFollows.filter(conv => conv !== null);
        
        res.json({ conversations: validConversations });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Get messages with a specific user (only if mutual follow)
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Check if mutual follow exists
        const [iFollow] = await pool.execute(
            'SELECT COUNT(*) as count FROM followers WHERE follower_id = ? AND following_id = ?',
            [req.user.id, userId]
        );
        const [theyFollow] = await pool.execute(
            'SELECT COUNT(*) as count FROM followers WHERE follower_id = ? AND following_id = ?',
            [userId, req.user.id]
        );
        
        const isMutual = iFollow[0]?.count > 0 && theyFollow[0]?.count > 0;
        
        if (!isMutual) {
            return res.status(403).json({ error: 'You can only message users who follow you back' });
        }
        
        const [messages] = await pool.execute(
            `SELECT * FROM messages
             WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
             ORDER BY createdAt ASC`,
            [req.user.id, userId, userId, req.user.id]
        );
        
        // Mark messages as read
        await pool.execute(
            'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
            [req.user.id, userId]
        );
        
        res.json({ messages });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Send message (only if mutual follow)
app.post('/api/messages', authenticateToken, async (req, res) => {
    const { receiver_id, content } = req.body;
    
    if (!receiver_id || !content || !content.trim()) {
        return res.status(400).json({ error: 'Receiver ID and content are required' });
    }
    
    if (parseInt(receiver_id) === req.user.id) {
        return res.status(400).json({ error: 'Cannot send message to yourself' });
    }
    
    try {
        // Check if receiver exists
        const [users] = await pool.execute('SELECT id FROM users WHERE id = ?', [receiver_id]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if mutual follow exists
        const [iFollow] = await pool.execute(
            'SELECT COUNT(*) as count FROM followers WHERE follower_id = ? AND following_id = ?',
            [req.user.id, receiver_id]
        );
        const [theyFollow] = await pool.execute(
            'SELECT COUNT(*) as count FROM followers WHERE follower_id = ? AND following_id = ?',
            [receiver_id, req.user.id]
        );
        
        const isMutual = iFollow[0]?.count > 0 && theyFollow[0]?.count > 0;
        
        if (!isMutual) {
            return res.status(403).json({ error: 'You can only message users who follow you back' });
        }
        
        const [result] = await pool.execute(
            'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
            [req.user.id, receiver_id, content.trim()]
        );
        
        const [message] = await pool.execute('SELECT * FROM messages WHERE id = ?', [result.insertId]);
        
        // Create notification for receiver
        try {
            const [senderInfo] = await pool.execute(
                'SELECT name, username FROM users WHERE id = ?',
                [req.user.id]
            );
            const senderName = senderInfo[0]?.name || senderInfo[0]?.username || 'Someone';
            const messagePreview = content.trim().length > 50 ? content.trim().substring(0, 50) + '...' : content.trim();
            
            await pool.execute(
                'INSERT INTO notifications (user_id, type, message, related_user_id) VALUES (?, ?, ?, ?)',
                [receiver_id, 'message', `${senderName} sent you a message: "${messagePreview}"`, req.user.id]
            );
        } catch (notifError) {
            // Don't fail the message send if notification creation fails
            console.error('Error creating message notification:', notifError);
        }
        
        res.status(201).json({ message: message[0] });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ==================== NOTIFICATIONS ROUTES ====================

// Get user notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const [notifications] = await pool.execute(
            `SELECT n.*, u.username, u.name 
             FROM notifications n 
             LEFT JOIN users u ON n.related_user_id = u.id 
             WHERE n.user_id = ? 
             ORDER BY n.createdAt DESC 
             LIMIT 50`,
            [req.user.id]
        );
        
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});

// Mark notification as read
app.put('/api/notifications/:notificationId/read', authenticateToken, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [req.params.notificationId, req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [req.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`🚀 BookBar server running on http://localhost:${PORT}`);
        console.log(`📚 API endpoints available at http://localhost:${PORT}/api`);
    });
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        if (pool) {
            await pool.end();
            console.log('✅ Database connection closed');
        }
    } catch (error) {
        console.error('Error closing database connection:', error);
    } finally {
        process.exit(0);
    }
});

