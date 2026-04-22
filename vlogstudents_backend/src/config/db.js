/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - DATABASE CONFIG v3.0.0
 * Neon PostgreSQL Pool Manager (Production Ready)
 * ============================================================================
 */

const { Pool } = require('pg');
const env = require('./env');

// ===============================
// CONFIGURAÇÃO DO POOL (NEON)
// ===============================
const pool = new Pool({
    connectionString: env.DATABASE_URL,

    ssl: {
        rejectUnauthorized: false // obrigatório para Neon/Supabase
    },

    max: 20, // conexões simultâneas
    idleTimeoutMillis: 30000, // fecha conexões ociosas
    connectionTimeoutMillis: 10000, // tempo para conectar (Neon pode "acordar")
    statement_timeout: 30000, // timeout de queries
});

// ===============================
// EVENTOS DO POOL
// ===============================
pool.on('connect', () => {
    console.log('[DATABASE] Conectado ao Neon com sucesso');
});

pool.on('error', (err) => {
    console.error('[DATABASE ERROR] Erro inesperado no pool:', err.message);
});

pool.on('acquire', () => {
    if (env.NODE_ENV !== 'production') {
        console.log('[DATABASE] Cliente adquirido do pool');
    }
});

// ===============================
// FUNÇÃO SEGURA DE QUERY (COM LOG)
// ===============================
const query = async (text, params = []) => {
    try {
        const start = Date.now();
        const res = await pool.query(text, params);
        const duration = Date.now() - start;

        if (env.NODE_ENV !== 'production') {
            console.log('[QUERY]', {
                text: text.substring(0, 80),
                duration: `${duration}ms`,
                rows: res.rowCount
            });
        }

        return res;
    } catch (error) {
        console.error('[QUERY ERROR]', error.message);
        throw error;
    }
};

// ===============================
// CLIENTE MANUAL (TRANSAÇÕES)
// ===============================
const getClient = async () => {
    const client = await pool.connect();

    const originalRelease = client.release;

    client.release = () => {
        if (env.NODE_ENV !== 'production') {
            console.log('[DATABASE] Cliente liberado');
        }
        return originalRelease.apply(client);
    };

    return client;
};

// ===============================
// HEALTH CHECK (IMPORTANTE)
// ===============================
const healthCheck = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('[DATABASE] Health check OK');
        return true;
    } catch (error) {
        console.error('[DATABASE] Health check FAIL:', error.message);
        return false;
    }
};

// ===============================
module.exports = {
    query,
    getClient,
    pool,
    healthCheck
};
