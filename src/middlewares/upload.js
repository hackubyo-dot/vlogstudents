const multer = require('multer');

// Armazenamento em memória (RAM) para repasse imediato ao Supabase
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Filtro de MIME Types
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de ficheiro não suportado. Envie apenas imagens ou vídeos.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Limite de 100MB por upload
    }
});

module.exports = upload;