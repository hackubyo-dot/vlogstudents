/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - DATABASE ORCHESTRATOR (AUTO-HEALING)
 * Sincronização de Esquemas, Índices e Integridade Referencial
 * ============================================================================
 */
const db = require('../config/db');

const initializeDatabase = async () => {
    const client = await db.getClient();
    console.log('[DB_INIT] Iniciando Auditoria Estrutural no Neon...');

    try {
        await client.query('BEGIN');

        // 1. EXTENSÕES DE SEGURANÇA
        await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        // 2. TABELA DE USUÁRIOS (MASTER IDENTITY)
        console.log('[DB_INIT] Sincronizando: Tabela [users]');
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

        // 3. TABELA DE REELS (VIDEO CONTENT)
        console.log('[DB_INIT] Sincronizando: Tabela [reels]');
        await client.query(`
            CREATE TABLE IF NOT EXISTS reels (
                id SERIAL PRIMARY KEY,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                drive_file_id TEXT NOT NULL, -- URL DO SUPABASE STORAGE
                thumbnail_id TEXT,
                title VARCHAR(255) NOT NULL,
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

        // 4. TABELA DE LIKES (SOCIAL INTERACTION)
        console.log('[DB_INIT] Sincronizando: Tabela [likes]');
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reel_id INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, reel_id)
            );
        `);

        // 5. TABELA DE FOLLOWS (NETWORK)
        console.log('[DB_INIT] Sincronizando: Tabela [follows]');
        await client.query(`
            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(follower_id, following_id)
            );
        `);

        // 6. TABELA DE CHAT ROOMS (CONVERSATIONS)
        console.log('[DB_INIT] Sincronizando: Tabela [chat_rooms]');
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

        // 7. TABELA DE CHAT PARTICIPANTS
        console.log('[DB_INIT] Sincronizando: Tabela [chat_participants]');
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_participants (
                room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (room_id, user_id)
            );
        `);

        // 8. TABELA DE MENSAGENS (REALTIME DATA)
        console.log('[DB_INIT] Sincronizando: Tabela [chat_messages]');
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

        // 9. TABELA DE TRANSAÇÕES FINANCEIRAS (ECONOMY)
        console.log('[DB_INIT] Sincronizando: Tabela [point_transactions]');
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

        // 10. TABELA DE COMENTÁRIOS
        console.log('[DB_INIT] Sincronizando: Tabela [comments]');
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

        // 11. ÍNDICES DE PERFORMANCE (OTIMIZAÇÃO)
        console.log('[DB_INIT] Gerando índices de busca rápida...');
        await client.query('CREATE INDEX IF NOT EXISTS idx_reels_author ON reels(author_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_messages_room ON chat_messages(room_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_comments_reel ON comments(reel_id);');

        await client.query('COMMIT');
        console.log('[DB_INIT] Auditoria concluída. Banco de dados em estado operacional estável.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[DB_INIT FATAL ERROR] Falha na orquestração de banco:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = initializeDatabase;
