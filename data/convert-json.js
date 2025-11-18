// Script to convert JSON format
const fs = require('fs');
const path = require('path');

// File paths
const sourceFile = path.join(__dirname, '..', 'bookbar', 'fantasy-books.json');
const targetFile = path.join(__dirname, 'fantasy-books.json');

console.log('📖 Converting JSON file...');

try {
    // Read source file (clean BOM character)
    let content = fs.readFileSync(sourceFile, 'utf8');
    content = content.replace(/^\uFEFF/, '');
    
    // Parse JSON
    const books = JSON.parse(content);
    
    console.log(`✅ Found ${books.length} books`);
    
    // New format: { "fantasy": [...] }
    const output = {
        fantasy: books
    };
    
    // Write to target file
    fs.writeFileSync(targetFile, JSON.stringify(output, null, 2), 'utf8');
    
    console.log(`✅ JSON file updated: ${targetFile}`);
    console.log(`📚 Total ${books.length} books`);
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}

