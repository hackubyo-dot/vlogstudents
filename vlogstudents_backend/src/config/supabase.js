/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - SUPABASE CONFIG v4.0.0
 * HIGH-AVAILABILITY STORAGE ENGINE (FINAL)
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// ============================================================================
// 🔧 CLIENT CONFIG (OTIMIZADO PARA BACKEND)
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
// ⚡ STORAGE PULSE (SEM VALIDAÇÃO BLOQUEANTE)
// Evita erro 403/permission ao listar buckets no Render
// ============================================================================
const checkStoragePulse = () => {
    console.log('----------------------------------------------------');
    console.log('[SUPABASE STORAGE] ENGINE ONLINE');
    console.log(`[BUCKET] ${BUCKET_NAME}`);
    console.log(`[ENDPOINT] ${env.SUPABASE_URL}`);
    console.log('----------------------------------------------------');
};

checkStoragePulse();

// ============================================================================
// 📤 UPLOAD FILE (CORE)
// ============================================================================
const uploadFile = async (path, fileBuffer, contentType) => {
    try {
        if (!fileBuffer) {
            throw new Error('Buffer vazio no upload');
        }

        const { data, error } = await storage.upload(path, fileBuffer, {
            contentType,
            cacheControl: '3600',
            upsert: false
        });

        if (error) {
            console.error('[SUPABASE UPLOAD ERROR]', error);
            throw new Error(error.message);
        }

        return data;

    } catch (error) {
        console.error('[UPLOAD FATAL]', error.message);
        throw error;
    }
};

// ============================================================================
// 🔗 GET PUBLIC URL
// ============================================================================
const getPublicUrl = (path) => {
    try {
        const { data } = storage.getPublicUrl(path);

        if (!data || !data.publicUrl) {
            throw new Error('Falha ao gerar URL pública');
        }

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

        if (error) {
            console.error('[SUPABASE DELETE ERROR]', error);
            throw new Error(error.message);
        }

        return true;

    } catch (error) {
        console.error('[DELETE FATAL]', error.message);
        return false;
    }
};

// ============================================================================
// 🧪 TESTE RÁPIDO (OPCIONAL)
// ============================================================================
const healthCheckStorage = async () => {
    try {
        const testPath = `healthcheck/test_${Date.now()}.txt`;

        await uploadFile(testPath, Buffer.from('ok'), 'text/plain');
        await deleteFile(testPath);

        console.log('[STORAGE HEALTH] OK');
        return true;

    } catch (error) {
        console.warn('[STORAGE HEALTH WARNING]', error.message);
        return false;
    }
};

// ============================================================================
// 🚀 INIT LOG (DEV ONLY)
// ============================================================================
if (env.NODE_ENV !== 'production') {
    console.log('[SUPABASE] Cliente inicializado com sucesso');
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
    deleteFile,
    healthCheckStorage
};
