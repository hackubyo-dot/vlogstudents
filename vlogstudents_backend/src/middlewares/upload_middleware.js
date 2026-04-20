const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');
const { AppError } = require('./error_middleware');

class VlogStudentsUploadOrchestrator {
    constructor() {
        this.googleDriveFolderId = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
        this.serviceAccountPath = path.join(process.cwd(), 'credentials.json');
        this.allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        this.allowedVideoMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-matroska'];
        this.maxImageSize = 10 * 1024 * 1024;
        this.maxVideoSize = 100 * 1024 * 1024;

        this.initializeGoogleDrive();
        this.setupMulterConfiguration();
    }

    initializeGoogleDrive() {
        try {
            if (!fs.existsSync(this.serviceAccountPath)) {
                throw new Error('Arquivo de credenciais do Google Cloud nao localizado na raiz.');
            }

            this.auth = new google.auth.GoogleAuth({
                keyFile: this.serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/drive.file']
            });

            this.drive = google.drive({ version: 'v3', auth: this.auth });
            logger.info('Google Drive API v3 inicializada para o middleware de upload.');
        } catch (error) {
            logger.critical('Falha catastrófica ao inicializar servico de storage:', error);
        }
    }

    setupMulterConfiguration() {
        this.storage = multer.memoryStorage();

        this.uploadInstance = multer({
            storage: this.storage,
            limits: {
                fileSize: this.maxVideoSize
            },
            fileFilter: (request, file, callback) => {
                this.validateFileFilter(request, file, callback);
            }
        });
    }

    validateFileFilter(request, file, callback) {
        const isImage = this.allowedImageMimeTypes.includes(file.mimetype);
        const isVideo = this.allowedVideoMimeTypes.includes(file.mimetype);

        if (isImage || isVideo) {
            callback(null, true);
        } else {
            callback(new AppError(`O formato de arquivo ${file.mimetype} nao e permitido no VlogStudents.`, 400, 'INVALID_FILE_TYPE'), false);
        }
    }

    async uploadToGoogleDrive(fileBuffer, fileName, mimeType, folderId = null) {
        const startTime = Date.now();
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const targetFolder = folderId || this.googleDriveFolderId;

        const fileMetadata = {
            name: `vlogstudents_${Date.now()}_${fileName}`,
            parents: [targetFolder]
        };

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        try {
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink, thumbnailLink'
            });

            const duration = Date.now() - startTime;
            logger.logMediaEvent('UPLOAD_DRIVE', response.data.id, duration, true);

            return {
                fileId: response.data.id,
                viewLink: response.data.webViewLink,
                thumbnail: response.data.thumbnailLink
            };
        } catch (error) {
            logger.error('Erro ao transmitir arquivo para o Google Drive', error);
            throw new AppError('Falha na persistencia do arquivo no storage cloud.', 502, 'STORAGE_UPLOAD_ERROR');
        }
    }

    processReelUpload() {
        return (request, response, next) => {
            this.uploadInstance.single('reel')(request, response, async (error) => {
                if (error) return next(this.handleMulterError(error));

                if (!request.file) {
                    return next(new AppError('Nenhum arquivo de video foi enviado para o Reel.', 400, 'MISSING_FILE'));
                }

                if (!this.allowedVideoMimeTypes.includes(request.file.mimetype)) {
                    return next(new AppError('O Reel deve ser um video valido (MP4, MOV ou MKV).', 400, 'INVALID_VIDEO_FORMAT'));
                }

                try {
                    const result = await this.uploadToGoogleDrive(
                        request.file.buffer,
                        request.file.originalname,
                        request.file.mimetype
                    );
                    request.fileMetadata = result;
                    next();
                } catch (uploadError) {
                    next(uploadError);
                }
            });
        };
    }

    processProfileImage() {
        return (request, response, next) => {
            this.uploadInstance.single('image')(request, response, async (error) => {
                if (error) return next(this.handleMulterError(error));

                if (!request.file) {
                    return next(new AppError('Nenhuma imagem foi enviada.', 400, 'MISSING_IMAGE'));
                }

                if (!this.allowedImageMimeTypes.includes(request.file.mimetype)) {
                    return next(new AppError('Apenas imagens JPEG, PNG e WEBP sao permitidas para o perfil.', 400, 'INVALID_IMAGE_FORMAT'));
                }

                if (request.file.size > this.maxImageSize) {
                    return next(new AppError('A imagem de perfil nao pode exceder 10MB.', 400, 'IMAGE_TOO_LARGE'));
                }

                try {
                    const result = await this.uploadToGoogleDrive(
                        request.file.buffer,
                        request.file.originalname,
                        request.file.mimetype
                    );
                    request.fileMetadata = result;
                    next();
                } catch (uploadError) {
                    next(uploadError);
                }
            });
        };
    }

    processChatMedia() {
        return (request, response, next) => {
            this.uploadInstance.single('attachment')(request, response, async (error) => {
                if (error) return next(this.handleMulterError(error));
                if (!request.file) return next();

                try {
                    const result = await this.uploadToGoogleDrive(
                        request.file.buffer,
                        request.file.originalname,
                        request.file.mimetype
                    );
                    request.fileMetadata = result;
                    next();
                } catch (uploadError) {
                    next(uploadError);
                }
            });
        };
    }

    handleMulterError(error) {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return new AppError('O arquivo enviado excede o limite de tamanho permitido.', 400, 'FILE_TOO_LARGE');
            }
            return new AppError(`Erro no processamento do arquivo: ${error.message}`, 400, 'MULTER_ERROR');
        }
        return error;
    }

    async deleteFromDrive(fileId) {
        try {
            await this.drive.files.delete({ fileId: fileId });
            logger.info(`Arquivo ${fileId} removido do Google Drive com sucesso.`);
            return true;
        } catch (error) {
            logger.error(`Falha ao remover arquivo ${fileId} do Drive`, error);
            return false;
        }
    }

    async generateStream(fileId) {
        try {
            const response = await this.drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            return response.data;
        } catch (error) {
            logger.error(`Erro ao gerar stream para o arquivo ${fileId}`, error);
            throw new AppError('Nao foi possivel recuperar o stream da mídia.', 404, 'STREAM_NOT_FOUND');
        }
    }

    async getFileMetadata(fileId) {
        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                fields: 'id, name, mimeType, size, createdTime'
            });
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async updateFilePermissions(fileId) {
        try {
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
            return true;
        } catch (error) {
            logger.error(`Erro ao atualizar permissoes do arquivo ${fileId}`, error);
            return false;
        }
    }

    async listFiles(pageSize = 10) {
        try {
            const response = await this.drive.files.list({
                pageSize: pageSize,
                fields: 'nextPageToken, files(id, name, mimeType, thumbnailLink)',
                q: `'${this.googleDriveFolderId}' in parents and trashed = false`
            });
            return response.data.files;
        } catch (error) {
            logger.error('Erro ao listar arquivos do storage', error);
            return [];
        }
    }

    async checkStorageQuota() {
        try {
            const response = await this.drive.about.get({
                fields: 'storageQuota'
            });
            return response.data.storageQuota;
        } catch (error) {
            logger.error('Erro ao verificar cota de armazenamento', error);
            return null;
        }
    }

    async renameFile(fileId, newName) {
        try {
            await this.drive.files.update({
                fileId: fileId,
                requestBody: {
                    name: newName
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async copyFile(fileId, newName) {
        try {
            const response = await this.drive.files.copy({
                fileId: fileId,
                requestBody: {
                    name: newName
                }
            });
            return response.data.id;
        } catch (error) {
            return null;
        }
    }

    async createSubFolder(folderName) {
        try {
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [this.googleDriveFolderId]
            };
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                fields: 'id'
            });
            return response.data.id;
        } catch (error) {
            return null;
        }
    }

    async downloadFileToPath(fileId, destPath) {
        try {
            const dest = fs.createWriteStream(destPath);
            const response = await this.drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            return new Promise((resolve, reject) => {
                response.data
                    .on('end', () => resolve(true))
                    .on('error', (err) => reject(err))
                    .pipe(dest);
            });
        } catch (error) {
            return false;
        }
    }

    verifyMagicBytes(buffer) {
        const header = buffer.toString('hex', 0, 4);
        const signatures = {
            'ffd8ff': 'image/jpeg',
            '89504e47': 'image/png',
            '47494638': 'image/gif',
            '66747970': 'video/mp4',
            '1a45dfa3': 'video/x-matroska'
        };
        for (const [sig, mime] of Object.entries(signatures)) {
            if (header.startsWith(sig)) return mime;
        }
        return null;
    }

    async performIntegrityCheck(fileId, originalBuffer) {
        const metadata = await this.getFileMetadata(fileId);
        if (!metadata) return false;
        return parseInt(metadata.size) === originalBuffer.length;
    }

    async emptyTrash() {
        try {
            await this.drive.files.emptyTrash();
            return true;
        } catch (error) {
            return false;
        }
    }

    getMimeFromExtension(filename) {
        const ext = path.extname(filename).toLowerCase();
        const map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime'
        };
        return map[ext] || 'application/octet-stream';
    }

    isArchiveInfected(fileId) {
        return false;
    }

    async generateThumbnailFromDrive(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        return metadata ? metadata.thumbnailLink : null;
    }

    async moveFile(fileId, newFolderId) {
        try {
            const file = await this.drive.files.get({
                fileId: fileId,
                fields: 'parents'
            });
            const previousParents = file.data.parents.join(',');
            await this.drive.files.update({
                fileId: fileId,
                addParents: newFolderId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getFolderSize(folderId) {
        const files = await this.listFiles(100);
        return files.reduce((acc, curr) => acc + (parseInt(curr.size) || 0), 0);
    }

    validateVideoDuration(buffer) {
        return true;
    }

    getStorageUsagePercentage(quota) {
        if (!quota) return 0;
        return (quota.usage / quota.limit) * 100;
    }
}

const uploadOrchestrator = new VlogStudentsUploadOrchestrator();

module.exports = {
    reel: uploadOrchestrator.processReelUpload(),
    profile: uploadOrchestrator.processProfileImage(),
    chat: uploadOrchestrator.processChatMedia(),
    remover: (fileId) => uploadOrchestrator.deleteFromDrive(fileId),
    streamer: (fileId) => uploadOrchestrator.generateStream(fileId),
    metadata: (fileId) => uploadOrchestrator.getFileMetadata(fileId),
    instance: uploadOrchestrator
};

logger.info('Middleware de Upload VlogStudents finalizado com integracao Google Drive.');