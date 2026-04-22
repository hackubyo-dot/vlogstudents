// FILE: src/config/db.js
const { Pool } = require('pg');
const env = require('./env');

/**
 * Configuração do Pool de conexões PostgreSQL
 * Otimizado para ambientes escaláveis como Render (Neon/RDS)
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessário para conexões seguras com Neon/Supabase DB
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('[DATABASE] Nova conexão estabelecida com o PostgreSQL.');
});

pool.on('error', (err) => {
  console.error('[DATABASE ERROR] Erro inesperado no pool de conexões:', err);
  // Não encerra o processo, permite que o Pool tente se recuperar
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};