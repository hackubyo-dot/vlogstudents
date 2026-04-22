const multer = require('multer');

// Configuração de armazenamento em memória (RAM) para processamento rápido
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Aceita apenas imagens e vídeos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Formato de arquivo não suportado. Envie apenas fotos ou vídeos.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Limite de 100MB para vídeos
    }
});

module.exports = upload;