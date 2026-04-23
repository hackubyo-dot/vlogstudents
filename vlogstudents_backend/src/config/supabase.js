/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SUPABASE CONFIG v3.0.0 (FINAL)
 * Storage + Client + Validation + Utilities
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// ============================================================================
// 🔧 CLIENT CONFIG
// ============================================================================
const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        },
        global: {
            headers: {
                'x-application-name': 'vlogstudents-backend'
            }
        }
    }
);

// ============================================================================
// 📦 STORAGE CONFIG
// ============================================================================
const BUCKET_NAME = 'vlogstudents_media';
const storage = supabase.storage.from(BUCKET_NAME);

// ============================================================================
// 🔍 CHECK BUCKET (CRÍTICO)
// ============================================================================
const ensureStorageReady = async () => {
    try {
        const { data: buckets, error } = await supabase.storage.listBuckets();

        if (error) throw error;

        const exists = buckets.find(b => b.id === BUCKET_NAME);

        if (!exists) {
            console.error('----------------------------------------------------');
            console.error(`[STORAGE ERROR] Bucket "${BUCKET_NAME}" NÃO EXISTE`);
            console.error('👉 Crie no Supabase Dashboard:');
            console.error(`Storage → New Bucket → Nome: ${BUCKET_NAME} → Público: SIM`);
            console.error('----------------------------------------------------');
        } else {
            console.log(`[STORAGE] Bucket "${BUCKET_NAME}" OK`);
        }

    } catch (e) {
        console.warn('[STORAGE WARNING] Não foi possível validar buckets (seguindo mesmo assim)');
    }
};

// Executa verificação ao iniciar
ensureStorageReady();

// ============================================================================
// 📤 UPLOAD FILE
// ============================================================================
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

// ============================================================================
// 🔗 GET PUBLIC URL
// ============================================================================
const getPublicUrl = (path) => {
    try {
        const { data } = storage.getPublicUrl(path);
        return data.publicUrl;

    } catch (error) {
        console.error('[SUPABASE URL ERROR]', error.message);
        throw error;
    }
};

// ============================================================================
// 🗑 DELETE FILE
// ============================================================================
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

// ============================================================================
// 🚀 INIT LOG
// ============================================================================
if (env.NODE_ENV !== 'production') {
    console.log('[SUPABASE] Cliente inicializado');
}

// ============================================================================
// 📦 EXPORTS
// ============================================================================
module.exports = {
    supabase,
    storage,
    BUCKET_NAME,
    uploadFile,
    getPublicUrl,
    deleteFile
};
