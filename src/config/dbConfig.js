/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DATABASE ORCHESTRATOR (Neon PostgreSQL)
 * SISTEMA DE PERSISTÊNCIA COM PROTOCOLO DE AUTO-HEALING
 * ============================================================================
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Necessário para conexões seguras com Neon/Render
    },
    max: 20, // Máximo de conexões simultâneas
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Script de Inicialização e Reparo de Esquema (Auto-Healing)
 * Executado no boot do servidor para garantir integridade relacional.
 */
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        console.log('[MASTER_DB] Iniciando auditoria de tabelas...');

        await client.query('BEGIN');

        // 1. Tabela de Usuários
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255),
                google_id VARCHAR(255) UNIQUE,
                avatar_url TEXT,
                university_name VARCHAR(255),
                referral_code VARCHAR(50) UNIQUE,
                points_total INTEGER DEFAULT 0,
                theme_pref VARCHAR(20) DEFAULT 'dark',
                phone_number VARCHAR(50),
                biography TEXT,
                isActive BOOLEAN DEFAULT true,
                recovery_token VARCHAR(10),
                recovery_expires TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Tabela de Reels (Vídeos)
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

        // 3. Tabelas de Interação (Likes/Seguidores)
        await client.query(`
            CREATE TABLE IF NOT EXISTS likes (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, reel_id)
            );

            CREATE TABLE IF NOT EXISTS follows (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(follower_id, following_id)
            );
        `);

        // 4. Estrutura de Chat (Salas e Mensagens)
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255), -- Nulo para DMs
                is_group BOOLEAN DEFAULT false,
                admin_id INTEGER REFERENCES users(id),
                last_message_preview TEXT,
                last_activity TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS chat_participants (
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                unread_count INTEGER DEFAULT 0,
                PRIMARY KEY (room_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
                sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT,
                media_id TEXT, -- Para imagens/vídeos no chat
                type VARCHAR(20) DEFAULT 'text',
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 5. Sistema de Voices (Points & Transactions)
        await client.query(`
            CREATE TABLE IF NOT EXISTS point_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                amount INTEGER NOT NULL,
                reason VARCHAR(100) NOT NULL,
                reference_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        await client.query('COMMIT');
        console.log('[MASTER_DB] Todas as tabelas verificadas e operacionais.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[MASTER_DB_FATAL] Erro na inicialização do esquema:', error.stack);
        process.exit(1);
    } finally {
        client.release();
    }
};

// Auto-execução no boot
initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
};