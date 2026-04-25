/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - DATABASE ORCHESTRATOR v12.0.0 (ULTIMATE STABLE)
 * HARD RESET | AUTO-HEALING | STORIES ENGINE | AUDIO VOICES | TELEMETRY
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * ============================================================================
 */

const db = require('../config/db');

const initializeDatabase = async () => {
    const client = await db.getClient();
    console.log('[DB_INIT] 🔍 Iniciando reconstrução e auditoria da infraestrutura de dados...');

    try {
        await client.query('BEGIN');

        /**
         * =========================================================================
         * 🔐 EXTENSIONS & PRE-REQUISITES
         * =========================================================================
         */
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

        /**
         * =========================================================================
         * 👤 USERS (CENTRAL DE IDENTIDADE ACADÊMICA)
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
         * 🎥 REELS (VLOGS DO CAMPUS)
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

        // AUTO-HEAL REELS (Garantia de Colunas Críticas)
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS likes_count INT DEFAULT 0;`);
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS comments_count INT DEFAULT 0;`);
        await client.query(`ALTER TABLE reels ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);

        /**
         * =========================================================================
         * ❤️ LIKES & 🤝 FOLLOWS (SOCIAL GRAPH)
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
         * 💬 COMMUNICATIONS (CHAT SYSTEM)
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

        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_participants (
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (room_id, user_id)
            );
        `);

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
         * 💰 ECONOMY (POINT TRANSACTIONS)
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
         * 💬 COMMENTS (TEXT & AUDIO HYBRID)
         * FIX: Integridade de User_ID e colunas de Mídia
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                type VARCHAR(20) DEFAULT 'text',
                media_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // AUTO-HEAL COMMENTS (Correção de estrutura legada)
        await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
        await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'text';`);
        await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS media_url TEXT;`);

        /**
         * =========================================================================
         * 🔥 COMMENT REACTIONS
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS comment_reactions (
                id SERIAL PRIMARY KEY,
                comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reaction_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(comment_id, user_id)
            );
        `);

        /**
         * =========================================================================
         * ⏳ CAMPUS STATUS (STORIES SYSTEM)
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS campus_statuses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(20) NOT NULL, 
                content TEXT,
                media_url TEXT,
                background_color VARCHAR(20) DEFAULT '#000000',
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        /**
         * =========================================================================
         * 👁️ STATUS VIEWS (TELEMETRY ENGINE)
         * FIX: Resolve erro 42P01 (Undefined Table)
         * =========================================================================
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS status_views (
                id SERIAL PRIMARY KEY,
                status_id INTEGER NOT NULL REFERENCES campus_statuses(id) ON DELETE CASCADE,
                viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(status_id, viewer_id)
            );
        `);

        /**
         * =========================================================================
         * ⚡ INDEXES (OPTIMIZATION LAYER)
         * =========================================================================
         */
        console.log('[DB_INIT] ⚡ Injetando índices de alta performance...');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_reels_author ON reels(author_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_reel ON comments(reel_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_status_expires ON campus_statuses(expires_at);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_status_user ON campus_statuses(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_status_views_sid ON status_views(status_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_reactions_comment ON comment_reactions(comment_id);`);

        await client.query('COMMIT');
        console.log('✅ [DB_INIT] Infraestrutura v12.0.0 sincronizada com sucesso.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ [DB_INIT_FATAL] Erro catastrófico na orquestração:', error.message);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = initializeDatabase;
