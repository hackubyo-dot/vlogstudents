const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

module.exports = {
    // Servidor
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'production',

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // Supabase
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY,

    // Segurança
    jwtSecret: process.env.JWT_SECRET,

    // Google Cloud
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googleFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    // Tratamento para a chave privada com \n
    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
};