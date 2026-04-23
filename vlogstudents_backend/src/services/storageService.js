/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - STORAGE SERVICE v4.0.0
 * MULTI-FORMAT MEDIA TRANSMISSION KERNEL (FINAL)
 * ============================================================================
 */

const { supabase, BUCKET_NAME } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class StorageService {

    /**
     * =========================================================================
     * 📤 UPLOAD INDUSTRIAL (BUFFER → SUPABASE)
     * =========================================================================
     * Suporta:
     * - Vídeos HD / Reels
     * - Imagens de alta resolução
     * - Upload seguro e rastreável
     *
     * @param {Object} file   -> req.file (multer)
     * @param {String} folder -> 'reels' | 'avatars' | 'chat'
     */
    async uploadFile(file, folder = 'misc') {
        try {
            // ===============================
            // 🔍 VALIDAÇÃO FORTE
            // ===============================
            if (!file || !file.buffer) {
                throw new Error('Falha na integridade do arquivo: buffer vazio.');
            }

            const fileExt = file.originalname?.split('.').pop() || 'bin';

            const fileName = `${folder}/${uuidv4()}_${Date.now()}.${fileExt}`;

            console.log('----------------------------------------------------');
            console.log(`[STORAGE] Upload iniciado`);
            console.log(`[FILE] ${fileName}`);
            console.log(`[SIZE] ${file.size} bytes`);
            console.log(`[TYPE] ${file.mimetype}`);
            console.log('----------------------------------------------------');

            // ===============================
            // 🚀 UPLOAD SUPABASE
            // ===============================
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype || 'application/octet-stream',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('[SUPABASE_UPLOAD_FAILED]', error);
                throw new Error(`Erro Supabase: ${error.message}`);
            }

            // ===============================
            // 🔗 URL PÚBLICA
            // ===============================
            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            if (!publicUrlData || !publicUrlData.publicUrl) {
                throw new Error('Falha ao gerar URL pública.');
            }

            console.log(`[STORAGE_SUCCESS] URL: ${publicUrlData.publicUrl}`);

            return {
                url: publicUrlData.publicUrl,
                path: data.path,
                fileName: fileName,
                size: file.size,
                mimetype: file.mimetype
            };

        } catch (err) {
            console.error('[STORAGE_SERVICE_CRITICAL]', err.message);
            throw err;
        }
    }

    /**
     * =========================================================================
     * 🗑 DELETE FILE
     * =========================================================================
     */
    async deleteFile(filePath) {
        try {
            if (!filePath) {
                throw new Error('Caminho do arquivo não fornecido.');
            }

            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([filePath]);

            if (error) {
                console.error('[SUPABASE_DELETE_ERROR]', error);
                throw error;
            }

            console.log(`[STORAGE] Arquivo removido → ${filePath}`);

            return true;

        } catch (error) {
            console.error('[STORAGE_DELETE_ERROR]', error.message);
            return false;
        }
    }

    /**
     * =========================================================================
     * 🔗 GET PUBLIC URL
     * =========================================================================
     */
    getPublicUrl(filePath) {
        try {
            if (!filePath) return null;

            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            return data?.publicUrl || null;

        } catch (error) {
            console.error('[STORAGE_URL_ERROR]', error.message);
            return null;
        }
    }

    /**
     * =========================================================================
     * 🧪 HEALTH CHECK (DEBUG AVANÇADO)
     * =========================================================================
     */
    async healthCheck() {
        try {
            const testPath = `health/test_${Date.now()}.txt`;

            await supabase.storage
                .from(BUCKET_NAME)
                .upload(testPath, Buffer.from('ok'), {
                    contentType: 'text/plain'
                });

            await supabase.storage
                .from(BUCKET_NAME)
                .remove([testPath]);

            console.log('[STORAGE_HEALTH] OK');
            return true;

        } catch (error) {
            console.warn('[STORAGE_HEALTH_WARNING]', error.message);
            return false;
        }
    }
}

module.exports = new StorageService();
