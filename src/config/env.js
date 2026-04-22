// FILE: src/config/env.js
const dotenv = require('dotenv');
const path = require('path');

// Carrega as variáveis de ambiente do arquivo .env na raiz
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'vlog_students_master_secret_key_2024',
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  BCRYPT_SALT: 12
};

// Validação crítica de variáveis obrigatórias para produção
const requiredEnvs = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
requiredEnvs.forEach((key) => {
  if (!process.env[key]) {
    console.error(`[FATAL] Variável de ambiente obrigatória ausente: ${key}`);
    process.exit(1);
  }
});

module.exports = environment;