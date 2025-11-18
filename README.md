# BookBar - Social Book Sharing Platform

BookBar is a social book management and sharing platform designed for book lovers. Share your books, rate them, add favorites, and connect with other readers through messaging.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [Technologies](#technologies)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

- 👤 **User System**: Registration, login, profile management with avatar upload
- 📚 **Book Management**: Add, edit, delete, and search books
- ⭐ **Rating & Comments**: Rate books with 1-5 stars and write comments
- ❤️ **Favorites**: Add books to your favorites list
- 💬 **Messaging**: Private messaging with mutual followers
- 🔔 **Notifications**: Real-time notifications for messages and interactions
- 👥 **Social Features**: Follow/unfollow users, view followers and following
- 🌐 **Internationalization**: Support for English and Czech languages
- 📱 **Responsive Design**: Works on desktop and mobile devices

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed on your computer:

1. **Node.js** (v14 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`
   - Verify npm: `npm --version`

2. **MySQL** (v8.0 or higher)
   - Download from: https://dev.mysql.com/downloads/mysql/
   - Or use XAMPP/WAMP which includes MySQL
   - Verify installation: `mysql --version`

3. **Git** (optional, for cloning from GitHub)
   - Download from: https://git-scm.com/downloads
   - Verify installation: `git --version`

---

## 📥 Installation

### Step 1: Clone or Download the Project

**Option A: Clone from GitHub**
```bash
git clone https://github.com/yourusername/BookBar.git
cd BookBar/bookbar
```

**Option B: Download ZIP**
1. Download the project as ZIP from GitHub
2. Extract the ZIP file
3. Navigate to the `bookbar` folder in your terminal/command prompt

### Step 2: Install Dependencies

Open your terminal/command prompt in the `bookbar` directory and run:

```bash
npm install
```

This will install all required packages listed in `package.json`:
- express
- mysql2
- bcryptjs
- jsonwebtoken
- cors
- body-parser

**Expected output:**
```
added 150 packages in 30s
```

---

## 🗄️ Database Setup

### Step 1: Start MySQL Server

**Windows:**
- If using XAMPP: Start MySQL from XAMPP Control Panel
- If using standalone MySQL: Start MySQL service from Services

**macOS:**
```bash
brew services start mysql
# or
sudo /usr/local/mysql/support-files/mysql.server start
```

**Linux:**
```bash
sudo systemctl start mysql
# or
sudo service mysql start
```

### Step 2: Create MySQL User (Optional but Recommended)

Open MySQL command line or MySQL Workbench and run:

```sql
CREATE USER 'bookbar_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON bookbar.* TO 'bookbar_user'@'localhost';
FLUSH PRIVILEGES;
```

**Note:** You can skip this step if you want to use the default `root` user.

### Step 3: Configure Database Connection

The application will automatically create the database and tables on first run. However, you need to configure the connection settings.

**Option A: Environment Variables (Recommended)**

Create a `.env` file in the `bookbar` directory:

```bash
# Windows (Command Prompt)
copy nul .env

# Windows (PowerShell)
New-Item .env

# macOS/Linux
touch .env
```

Add the following content to `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=bookbar
PORT=3000
JWT_SECRET=your-secret-key-change-in-production
```

**Replace:**
- `your_mysql_password` with your MySQL root password (or the password you set in Step 2)
- `your-secret-key-change-in-production` with a strong random string

**Option B: Edit server.js Directly (Not Recommended for Production)**

If you don't use environment variables, edit `server.js` lines 14-17:

```javascript
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'your_password_here';
const DB_NAME = process.env.DB_NAME || 'bookbar';
```

**⚠️ Important:** Never commit `.env` file or hardcoded passwords to GitHub!

---

## ⚙️ Configuration

### Install dotenv (for .env file support)

If you want to use `.env` file, install dotenv:

```bash
npm install dotenv
```

Then add this line at the very top of `server.js` (before other requires):

```javascript
require('dotenv').config();
```

---

## 🚀 Running the Project

### Step 1: Start the Server

**Development Mode (with auto-restart):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

**Expected output:**
```
Server running on http://localhost:3000
Database initialized successfully
Tables created successfully
```

### Step 2: Open in Browser

Open your web browser and navigate to:

```
http://localhost:3000
```

You should see the BookBar homepage.

### Step 3: Create Your First Account

1. Click **"SIGN UP"** button
2. Fill in the registration form:
   - Name
   - Email
   - Password
   - Bio (optional)
3. Click **"Register"**
4. You will be automatically logged in

---

## 📁 Project Structure

```
bookbar/
├── server.js              # Backend Express server
├── index.html             # Main HTML file
├── bookshelf.js           # Frontend JavaScript (main application logic)
├── bookshelf.css          # Stylesheet
├── translations.js        # Internationalization (i18n)
├── book-manager.js        # Book data management
├── package.json           # Node.js dependencies
├── .env                   # Environment variables (create this)
├── data/                  # Data files
│   ├── fantasy-books.json # Sample book data
│   └── covers/            # Book cover images
└── covers/                # Additional cover images
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Books
- `GET /api/books` - Get all books
- `GET /api/books/:id` - Get book by ID
- `GET /api/books/search?title=...&author=...` - Search books
- `POST /api/books` - Create new book (authenticated)
- `PUT /api/books/:id` - Update book (authenticated)
- `DELETE /api/books/:id` - Delete book (authenticated)

### Comments
- `GET /api/books/:bookId/comments` - Get book comments
- `POST /api/comments` - Add comment with rating (authenticated)
- `DELETE /api/comments/:id` - Delete comment (authenticated)

### Users
- `GET /api/users/:userId` - Get user profile
- `GET /api/users/:userId/followers` - Get user followers
- `GET /api/users/:userId/following` - Get users following
- `PUT /api/users/profile` - Update profile (authenticated)
- `POST /api/users/:userId/follow` - Follow user (authenticated)
- `DELETE /api/users/:userId/follow` - Unfollow user (authenticated)

### Messages
- `GET /api/messages?userId=...` - Get messages (mutual follow required)
- `POST /api/messages` - Send message (mutual follow required)

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

### Favorites
- `GET /api/users/:userId/favorites` - Get user favorites
- `POST /api/books/:bookId/favorite` - Add to favorites (authenticated)
- `DELETE /api/books/:bookId/favorite` - Remove from favorites (authenticated)

---

## 🛠️ Technologies

**Backend:**
- Node.js
- Express.js
- MySQL (mysql2/promise)
- JWT Authentication
- bcryptjs (password hashing)

**Frontend:**
- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Browser History API
- LocalStorage

**Database:**
- MySQL 8.0+
- InnoDB Engine
- UTF8MB4 Character Set

---

## 🔍 Troubleshooting

### Problem: "Cannot connect to MySQL"

**Solution:**
1. Verify MySQL is running: `mysql --version`
2. Check your MySQL password in `.env` or `server.js`
3. Test connection manually:
   ```bash
   mysql -u root -p
   ```
4. Ensure MySQL service is started

### Problem: "Port 3000 already in use"

**Solution:**
1. Find process using port 3000:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /F /PID <PID_NUMBER>
   
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9
   ```
2. Or change port in `.env`: `PORT=3001`

### Problem: "Module not found" errors

**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules
npm install
```

### Problem: Database tables not created

**Solution:**
1. Check MySQL connection settings
2. Ensure database user has CREATE privileges
3. Check server console for error messages
4. Manually create database:
   ```sql
   CREATE DATABASE bookbar CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### Problem: "JWT_SECRET" error

**Solution:**
1. Add `JWT_SECRET` to `.env` file
2. Use a strong random string (at least 32 characters)
3. Restart the server

### Problem: CORS errors in browser

**Solution:**
- CORS is already configured in `server.js`
- Ensure you're accessing via `http://localhost:3000` (not `file://`)
- Check browser console for specific error messages

### Problem: Images not loading

**Solution:**
1. Check if `data/covers/` folder exists
2. Verify image paths in `fantasy-books.json`
3. Check browser console for 404 errors

---

## 📝 Additional Notes

### Default Database Credentials

If you haven't configured `.env`, the default values are:
- Host: `localhost`
- User: `root`
- Password: `964100` (⚠️ Change this!)
- Database: `bookbar`

### First Run

On first run, the application will:
1. Create the `bookbar` database (if it doesn't exist)
2. Create all required tables automatically
3. Set up foreign key relationships
4. Be ready to use immediately

### Development vs Production

**Development:**
- Use `npm run dev` for auto-restart on file changes
- Install nodemon: `npm install -g nodemon`

**Production:**
- Use environment variables for all sensitive data
- Change JWT_SECRET to a strong random string
- Use a strong MySQL password
- Enable HTTPS
- Set up proper error logging

---

## 📄 License

MIT License

---

## 👥 Support

If you encounter any issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review server console for error messages
3. Check browser console (F12) for frontend errors
4. Verify all prerequisites are installed correctly

---

## 🎓 For Teachers/Examiners

This project demonstrates:
- Full-stack web development (Node.js + Express + MySQL)
- RESTful API design
- JWT authentication
- Database design and relationships
- Frontend JavaScript (ES6+)
- Internationalization (i18n)
- Responsive web design
- Real-time features (notifications, messaging)

**Key Files to Review:**
- `server.js` - Backend API and database logic
- `bookshelf.js` - Frontend application logic
- `PROJECT_DOCUMENTATION.md` - Complete project documentation
- Database schema in `server.js` (initializeDatabase function)

**To Test the Application:**
1. Follow the installation steps above
2. Create a test account
3. Add a book
4. Write a comment with rating
5. Follow another user
6. Send a message (requires mutual follow)
7. Test language switching (English ↔ Czech)

---

**Happy Reading! 📚**
