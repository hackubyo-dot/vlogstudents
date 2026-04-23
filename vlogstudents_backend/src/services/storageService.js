/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - STORAGE SERVICE v3.0.0 (FINAL)
 * Upload + Delete + URL Handling (Supabase)
 * ============================================================================
 */

const { supabase, BUCKET_NAME } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class StorageService {

    /**
     * =========================================================================
     * 📤 UPLOAD DE ARQUIVO (MULTER BUFFER → SUPABASE)
     * =========================================================================
     * @param {Object} file  -> req.file (multer)
     * @param {String} folder -> 'reels' | 'avatars' | 'chat'
     */
    async uploadFile(file, folder = 'misc') {
        try {
            // ===============================
            // 🔍 VALIDAÇÃO
            // ===============================
            if (!file || !file.buffer) {
                throw new Error('Ficheiro inválido ou buffer vazio.');
            }

            const fileExt = file.originalname?.split('.').pop() || 'bin';

            const fileName = `${folder}/${uuidv4()}_${Date.now()}.${fileExt}`;

            console.log(`[STORAGE] Upload iniciado → ${BUCKET_NAME}/${fileName}`);

            // ===============================
            // 🚀 UPLOAD
            // ===============================
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype || 'application/octet-stream',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('[SUPABASE UPLOAD ERROR]', error);
                throw new Error(error.message);
            }

            // ===============================
            // 🔗 PUBLIC URL
            // ===============================
            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            if (!publicUrlData || !publicUrlData.publicUrl) {
                throw new Error('Falha ao gerar URL pública.');
            }

            console.log('[STORAGE] Upload concluído com sucesso');

            return {
                url: publicUrlData.publicUrl,
                path: data.path,
                size: file.size,
                mimetype: file.mimetype
            };

        } catch (error) {
            console.error('[STORAGE SERVICE ERROR]', error.message);
            throw error;
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
                console.error('[SUPABASE DELETE ERROR]', error);
                throw error;
            }

            console.log(`[STORAGE] Arquivo removido → ${filePath}`);

            return true;

        } catch (error) {
            console.error('[STORAGE DELETE ERROR]', error.message);
            return false;
        }
    }

    /**
     * =========================================================================
     * 🔁 GET PUBLIC URL (ÚTIL PARA REUSO)
     * =========================================================================
     */
    getPublicUrl(filePath) {
        try {
            const { data } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(filePath);

            return data.publicUrl;

        } catch (error) {
            console.error('[STORAGE URL ERROR]', error.message);
            return null;
        }
    }
}

module.exports = new StorageService();
