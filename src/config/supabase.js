const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Validação básica (evita bugs silenciosos)
if (!env.supabaseUrl || !env.supabaseKey) {
    console.error('[SUPABASE ERROR] Variáveis SUPABASE_URL ou SUPABASE_ANON_KEY não definidas.');
}

// Inicialização do client
const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: {
        persistSession: false // backend não precisa manter sessão
    }
});

/**
 * VlogStudents Storage Config
 * Bucket principal de mídia
 */
const storage = supabase.storage.from('vlogstudents_media');

module.exports = {
    supabase,
    storage
};