/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - DATABASE ORCHESTRATOR v10.0.0 (AUTO-HEALING FULL)
 * SCHEMA SYNC | MIGRATIONS | INDEXES | PERFORMANCE | ZERO BUG INIT
 * ============================================================================
 */

const db = require('../config/db');

const initializeDatabase = async () => {
    const client = await db.getClient();
    console.log('[DB_INIT] 🔍 Iniciando auditoria completa do banco...');

    try {
        await client.query('BEGIN');

        /**
         * =========================================================================
         * 🔐 EXTENSIONS
         * =========================================================================
         */
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

        /**
         * =========================================================================
         * 👤 USERS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                avatar_url TEXT,
                university_name VARCHAR(255),
                referral_code VARCHAR(50) UNIQUE NOT NULL,
                points_total INTEGER DEFAULT 0 CHECK (points_total >= 0),
                theme_pref VARCHAR(20) DEFAULT 'dark',
                phone_number VARCHAR(50),
                biography TEXT,
                isactive BOOLEAN DEFAULT true,
                recovery_token VARCHAR(255),
                recovery_expires TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /**
         * =========================================================================
         * 🎥 REELS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS reels (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 🔥 AUTO HEAL (CASO JÁ TENHA TABELA ANTIGA)
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;`);
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;`);
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS duration INT DEFAULT 0;`);
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;`);

        /**
         * =========================================================================
         * ❤️ LIKES
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reel_id INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, reel_id)
            );
        `);

        /**
         * =========================================================================
         * 🤝 FOLLOWS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(follower_id, following_id)
            );
        `);

        /**
         * =========================================================================
         * 💬 CHAT ROOMS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                is_group BOOLEAN DEFAULT false,
                last_message_preview TEXT,
                last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 🔥 AUTO HEAL CHAT
        await client.query(`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;`);
        await client.query(`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_message_preview TEXT;`);

        /**
         * =========================================================================
         * 👥 CHAT PARTICIPANTS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_participants (
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (room_id, user_id)
            );
        `);

        /**
         * =========================================================================
         * ✉️ CHAT MESSAGES
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                media_url TEXT,
                type VARCHAR(20) DEFAULT 'text',
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /**
         * =========================================================================
         * 💰 POINT TRANSACTIONS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                reason VARCHAR(255) NOT NULL,
                reference_id VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /**
         * =========================================================================
         * 💬 COMMENTS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /**
         * =========================================================================
         * ⚡ INDEXES (PERFORMANCE CRÍTICA)
         * =========================================================================
         */

        console.log('[DB_INIT] ⚡ Criando índices...');

        // USERS
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_points ON users(points_total DESC);`);

        // REELS
        await client.query(`CREATE INDEX IF NOT EXISTS idx_reels_author ON reels(author_id);`);

        // CHAT
        await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);`);

        // COMMENTS
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_reel ON comments(reel_id);`);

        // ECONOMY
        await client.query(`CREATE INDEX IF NOT EXISTS idx_points_user_id ON point_transactions(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_points_created ON point_transactions(created_at);`);

        await client.query('COMMIT');

        console.log('✅ [DB_INIT] Banco pronto para produção (ZERO BUG MODE)');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [DB_INIT_FATAL]', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = initializeDatabase;
