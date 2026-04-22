/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SUPABASE CONFIG v2.0.0
 * Storage + Client Manager (Production Ready)
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// ===============================
// CONFIGURAÇÃO DO CLIENTE
// ===============================
const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false, // backend não precisa de sessão
            autoRefreshToken: false
        },
        global: {
            headers: {
                'x-application-name': 'vlogstudents-backend'
            }
        }
    }
);

// ===============================
// CONFIG STORAGE
// ===============================
const BUCKET_NAME = 'vlogstudents_media';

// Referência direta ao bucket
const storage = supabase.storage.from(BUCKET_NAME);

// ===============================
// FUNÇÕES UTILITÁRIAS
// ===============================

// Upload de arquivo
const uploadFile = async (path, fileBuffer, contentType) => {
    try {
        const { data, error } = await storage.upload(path, fileBuffer, {
            contentType,
            upsert: false
        });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('[SUPABASE UPLOAD ERROR]', error.message);
        throw error;
    }
};

// Gerar URL pública
const getPublicUrl = (path) => {
    try {
        const { data } = storage.getPublicUrl(path);
        return data.publicUrl;
    } catch (error) {
        console.error('[SUPABASE URL ERROR]', error.message);
        throw error;
    }
};

// Deletar arquivo
const deleteFile = async (path) => {
    try {
        const { error } = await storage.remove([path]);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('[SUPABASE DELETE ERROR]', error.message);
        throw error;
    }
};

// ===============================
// LOG INICIAL
// ===============================
if (env.NODE_ENV !== 'production') {
    console.log('[SUPABASE] Cliente inicializado com sucesso');
}

// ===============================
module.exports = {
    supabase,
    storage,
    BUCKET_NAME,
    uploadFile,
    getPublicUrl,
    deleteFile
};
