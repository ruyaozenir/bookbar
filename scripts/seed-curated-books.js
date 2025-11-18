/**
 * Seed curated books from fantasy-books.json into the MySQL database.
 * Usage: npm run seed:curated
 */

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '964100';
const DB_NAME = process.env.DB_NAME || 'bookbar';

function normalizeGenre(rawGenre, fallback = '') {
    if (!rawGenre) return fallback;
    const parts = rawGenre.split('/');
    return (parts[0] || fallback).trim();
}

async function loadCuratedData() {
    const candidatePaths = [
        path.resolve(__dirname, '..', 'data', 'fantasy-books.json'),
        path.resolve(__dirname, '..', 'fantasy-books.json')
    ];

    for (const candidate of candidatePaths) {
        try {
            const content = await fs.readFile(candidate, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            // Try next candidate
        }
    }

    throw new Error('fantasy-books.json not found in data/ or project root.');
}

function flattenBooks(curatedData) {
    const books = [];
    const now = new Date();

    Object.entries(curatedData).forEach(([category, entries]) => {
        if (!Array.isArray(entries)) {
            return;
        }

        entries.forEach((item) => {
            const asin = `curated-${item.id}`;
            books.push({
                asin,
                title: item.title || 'Untitled',
                author: item.author || 'Unknown',
                description: item.description || '',
                genre: normalizeGenre(item.genre, category),
                cover_image: item.cover_image_url || '',
                category,
                acquired_at: now
            });
        });
    });

    return books;
}

async function seedBooks(connection, books) {
    const insertSql = `
        INSERT INTO books (asin, title, author, description, genre, cover_image, user_id)
        VALUES (?, ?, ?, ?, ?, ?, NULL)
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            author = VALUES(author),
            description = VALUES(description),
            genre = VALUES(genre),
            cover_image = VALUES(cover_image)
    `;

    let inserted = 0;
    let updated = 0;

    for (const book of books) {
        const [result] = await connection.execute(insertSql, [
            book.asin,
            book.title,
            book.author,
            book.description,
            book.genre,
            book.cover_image
        ]);

        if (result.affectedRows === 1) {
            inserted += 1;
        } else if (result.affectedRows === 2) {
            updated += 1;
        }
    }

    return { inserted, updated };
}

async function main() {
    console.log('📚 Loading curated dataset...');
    const curatedData = await loadCuratedData();
    const books = flattenBooks(curatedData);

    console.log(`➡️  Preparing to seed ${books.length} books into MySQL...`);

    const connection = await mysql.createConnection({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        multipleStatements: false
    });

    try {
        await connection.beginTransaction();
        const { inserted, updated } = await seedBooks(connection, books);
        await connection.commit();

        console.log(`✅ Seeding completed. Inserted: ${inserted}, Updated: ${updated}`);
    } catch (error) {
        await connection.rollback();
        console.error('❌ Seeding failed, transaction rolled back.');
        throw error;
    } finally {
        await connection.end();
    }
}

main()
    .then(() => {
        console.log('🎉 Done.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error seeding curated books:', error.message);
        process.exit(1);
    });

