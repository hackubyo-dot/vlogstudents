/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - CLOUD STORAGE SERVICE
 * Integração Master com Supabase Storage (Imagens e Vídeos)
 * ============================================================================
 */
const { createClient } = require('@supabase/supabase-js');
const env = require('../config/env');
const { v4: uuidv4 } = require('uuid');

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const BUCKET_NAME = 'vlogstudents_media';

class StorageService {
    /**
     * Faz upload de buffers do Multer diretamente para a nuvem
     * @param {Object} file - Objeto de arquivo vindo do middleware upload
     * @param {String} folder - Diretório alvo ('reels' | 'avatars')
     */
    async uploadFile(file, folder) {
        try {
            if (!file) throw new Error('Buffer de arquivo ausente para upload.');

            const fileExt = file.originalname.split('.').pop();
            const fileName = `${folder}/${uuidv4()}_${Date.now()}.${fileExt}`;

            console.log(`[STORAGE] Transmitindo arquivo para ${BUCKET_NAME}/${fileName}...`);

            // 1. Upload do Binário
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('[SUPABASE_STORAGE_ERROR]', error);
                throw new Error(`Falha no upload Supabase: ${error.message}`);
            }

            // 2. Geração da URL Pública Permanente
            const { data: publicUrlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(fileName);

            if (!publicUrlData || !publicUrlData.publicUrl) {
                throw new Error('Falha ao gerar URL pública para o arquivo.');
            }

            return {
                url: publicUrlData.publicUrl,
                path: data.path,
                size: file.size,
                mimetype: file.mimetype
            };
        } catch (error) {
            console.error('[STORAGE_SERVICE_FATAL]', error);
            throw error;
        }
    }

    /**
     * Remove arquivos órfãos do storage
     */
    async deleteFile(filePath) {
        try {
            const { error } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([filePath]);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[STORAGE_DELETE_ERROR]', error);
            return false;
        }
    }
}

module.exports = new StorageService();
