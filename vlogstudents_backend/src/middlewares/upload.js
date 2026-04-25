/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - UPLOAD MIDDLEWARE v2.0.0
 * SUPORTE INDUSTRIAL: IMAGENS | VÍDEOS HD | ÁUDIO (VOICES)
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * ============================================================================
 */

const multer = require('multer');

/**
 * CONFIGURAÇÃO DE ARMAZENAMENTO:
 * Utilizamos memoryStorage para evitar escrita em disco no servidor local,
 * permitindo o repasse imediato do buffer binário para o Supabase Storage.
 */
const storage = multer.memoryStorage();

/**
 * FILTRO DE SEGURANÇA E COMPATIBILIDADE:
 * Validação rigorosa de MIME Types para garantir a integridade do campus.
 */
const fileFilter = (req, file, cb) => {
    // Lista explícita de permissões para mídias acadêmicas
    const allowedMimeTypes = [
        // Imagens
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        // Vídeos
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm',
        // Áudios (Voices e Memos)
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 
        'audio/aac', 'audio/x-m4a', 'audio/m4a', 'audio/webm'
    ];

    const isAuthorized = allowedMimeTypes.includes(file.mimetype) || 
                         file.mimetype.startsWith('image/') || 
                         file.mimetype.startsWith('video/') || 
                         file.mimetype.startsWith('audio/');

    if (isAuthorized) {
        cb(null, true);
    } else {
        // Log de auditoria para tentativas de upload inválidas
        console.error(`[UPLOAD_REJECTED] MIME Type não suportado: ${file.mimetype}`);
        
        cb(new Error(
            'Tipo de ficheiro não suportado. Envie apenas imagens, vídeos ou áudio (Voices).'
        ), false);
    }
};

/**
 * ORQUESTRADOR MULTIPART:
 * Configuração final do Multer com limites de teto industrial.
 */
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        // Teto de 100MB para suportar vídeos em alta definição e vozes longas
        fileSize: 100 * 1024 * 1024, 
        // Limite de campos para evitar DoS por excesso de metadados
        fields: 20,
        files: 1
    }
});

module.exports = upload;
