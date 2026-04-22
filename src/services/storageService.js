const { storage } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class StorageService {
    /**
     * Faz upload de um buffer para o bucket do Supabase
     * @param {Object} file - Objeto de arquivo do Multer
     * @param {String} folder - Pasta no bucket (ex: 'reels' ou 'avatars')
     */
    async uploadFile(file, folder) {
        try {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${folder}/${uuidv4()}.${fileExt}`;

            const { data, error } = await storage.upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

            if (error) throw error;

            // Gera a URL pública para ser acessada pelo frontend
            const { data: publicUrlData } = storage.getPublicUrl(fileName);

            return {
                path: data.path,
                url: publicUrlData.publicUrl
            };
        } catch (error) {
            console.error('[STORAGE SERVICE ERROR]', error.message);
            throw new Error('Falha ao processar upload na nuvem.');
        }
    }

    /**
     * Remove um arquivo do storage
     * @param {String} path - Caminho completo do arquivo no bucket
     */
    async deleteFile(path) {
        try {
            const { error } = await storage.remove([path]);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[STORAGE SERVICE DELETE ERROR]', error.message);
            return false;
        }
    }
}

module.exports = new StorageService();