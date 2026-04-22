/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - DATABASE INITIALIZER v4.0.0
 * Auto-healing schema + safe transactions + production ready
 * ============================================================================
 */

const db = require('../config/db');

const initializeDatabase = async () => {
    const client = await db.getClient();

    try {
        console.log('[DB_INIT] Iniciando auditoria e sincronização do banco...');

        await client.query('BEGIN');

        // ===============================
        // USERS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                avatar_url TEXT,
                university_name VARCHAR(255),
                referral_code VARCHAR(50) UNIQUE,
                points_total INTEGER DEFAULT 0,
                theme_pref VARCHAR(20) DEFAULT 'dark',
                phone_number VARCHAR(50),
                biography TEXT,
                isactive BOOLEAN DEFAULT true,
                recovery_token VARCHAR(100),
                recovery_expires TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ===============================
        // REELS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS reels (
                id SERIAL PRIMARY KEY,
                author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                drive_file_id TEXT NOT NULL,
                thumbnail_id TEXT,
                title VARCHAR(255),
                description TEXT,
                duration INTEGER DEFAULT 0,
                views_count INTEGER DEFAULT 0,
                likes_count INTEGER DEFAULT 0,
                comments_count INTEGER DEFAULT 0,
                reposts_count INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ===============================
        // LIKES
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, reel_id)
            );
        `);

        // ===============================
        // FOLLOWS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(follower_id, following_id)
            );
        `);

        // ===============================
        // COMMENTS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ===============================
        // CHAT ROOMS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                is_group BOOLEAN DEFAULT false,
                last_message_preview TEXT,
                last_activity TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ===============================
        // CHAT PARTICIPANTS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_participants (
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                unread_count INTEGER DEFAULT 0,
                PRIMARY KEY (room_id, user_id)
            );
        `);

        // ===============================
        // CHAT MESSAGES
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                media_url TEXT,
                type VARCHAR(20) DEFAULT 'text',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ===============================
        // ECONOMIA / PONTOS
        // ===============================
        await client.query(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                reason VARCHAR(255) NOT NULL,
                reference_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // ===============================
        // INDEXES (PERFORMANCE)
        // ===============================
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_reels_author ON reels(author_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_reel ON comments(reel_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_likes_reel ON likes(reel_id);`);

        // ===============================
        // SEED INICIAL (ADMIN)
        // ===============================
        await client.query(`
            INSERT INTO users (full_name, email, password_hash, isactive)
            VALUES ('Admin VlogStudents', 'admin@vlogstudents.com', 'hashed_password', true)
            ON CONFLICT (email) DO NOTHING;
        `);

        await client.query('COMMIT');

        console.log('[DB_INIT] Banco pronto, validado e otimizado com sucesso 🚀');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DB_INIT ERROR] Falha crítica:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = initializeDatabase;
