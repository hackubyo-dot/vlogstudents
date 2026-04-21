const multer = require('multer');

/**
 * CONFIGURAÇÃO MASTER DO MIDDLEWARE DE UPLOAD
 * Utiliza MemoryStorage para evitar consumo de disco e aumentar performance
 */
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Filtros de segurança acadêmica
    const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-matroska'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de arquivo não suportado pelo sistema VlogStudents.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // Limite rigoroso de 100MB por postagem
        files: 1
    }
});

module.exports = upload;