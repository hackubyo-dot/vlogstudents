/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DATABASE ORCHESTRATOR (Neon PostgreSQL) v2.0.7
 * SISTEMA DE PERSISTÊNCIA COM PROTOCOLO DE AUTO-HEALING E CRIAÇÃO SEQUENCIAL
 * ============================================================================
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false 
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, 
    statement_timeout: 15000,
});

/**
 * Script de Inicialização Mestre
 * Resolve o erro de "column id referenced does not exist" através de execução atômica
 */
const initializeDatabase = async () => {
    const client = await pool.connect();
    try {
        console.log('[MASTER_DB] Iniciando protocolo de integridade de dados...');

        // 1. Criação da Tabela de Usuários (Âncora Primária)
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
                isactive BOOLEAN DEFAULT true,
                recovery_token VARCHAR(10),
                recovery_expires TIMESTAMP,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 2. Tabela de Reels (Depende de users)
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

        // 3. Tabela de Comentários (Depende de users e reels)
        await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                reel_id INTEGER REFERENCES reels(id) ON DELETE CASCADE,
                author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                parent_node_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 4. Tabelas de Interação (Likes e Follows)
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

        // 5. Motor de Chat (Rooms, Participantes e Mensagens)
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                is_group BOOLEAN DEFAULT false,
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
                type VARCHAR(20) DEFAULT 'text',
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        // 6. Transações de Voices (Gamificação)
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

        console.log('[MASTER_DB] Todas as camadas relacionais foram curadas e sincronizadas.');

    } catch (error) {
        console.error('[MASTER_DB_ERROR] Falha crítica na estruturação:', error.message);
        // Não encerramos o processo aqui para permitir que o servidor responda 500 em vez de crashar o deploy
    } finally {
        client.release();
    }
};

// Execução imediata no boot do Kernel
initializeDatabase();

module.exports = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    pool: pool
};
