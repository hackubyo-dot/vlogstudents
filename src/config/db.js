const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Obrigatório para Neon/Supabase DB
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
    console.log('[DATABASE] Pool de conexão estabelecido com Neon.');
});

pool.on('error', (err) => {
    console.error('[DATABASE ERROR] Erro inesperado no pool:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool
};