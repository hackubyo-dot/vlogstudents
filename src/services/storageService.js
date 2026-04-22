const { storage, BUCKET_NAME } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class StorageService {
    /**
     * Upload de arquivo para nuvem
     * @param {Object} file - Arquivo vindo do Multer
     * @param {String} folder - 'reels' ou 'avatars'
     */
    async uploadFile(file, folder) {
        try {
            const fileExt = file.originalname.split('.').pop();
            const fileName = `${folder}/${uuidv4()}_${Date.now()}.${fileExt}`;

            const { data, error } = await storage.upload(fileName, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

            if (error) {
                console.error('[SUPABASE UPLOAD ERROR]', error);
                throw new Error('Falha no upload para o storage cloud.');
            }

            // Obter URL Pública
            const { data: publicUrlData } = storage.getPublicUrl(fileName);

            return {
                path: data.path,
                url: publicUrlData.publicUrl
            };
        } catch (err) {
            throw err;
        }
    }

    /**
     * Remove arquivo do storage
     */
    async deleteFile(path) {
        const { error } = await storage.remove([path]);
        if (error) console.error('[STORAGE DELETE ERROR]', error);
    }
}

module.exports = new StorageService();