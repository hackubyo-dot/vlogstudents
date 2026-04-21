const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const stream = require('stream');
const logger = require('../config/logger');
const { AppError } = require('../middlewares/error_middleware');

class VlogStudentsGoogleDriveService {
    constructor() {
        this.credentialsPath = path.join(process.cwd(), 'credentials.json');
        this.rootFolderId = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
        this.driveClient = null;
        this.authClient = null;
        this.mimeTypeMap = {
            'image/jpeg': 'IMAGE',
            'image/png': 'IMAGE',
            'image/webp': 'IMAGE',
            'video/mp4': 'VIDEO',
            'video/quicktime': 'VIDEO',
            'video/x-matroska': 'VIDEO',
            'application/pdf': 'DOCUMENT'
        };

        this.initializeService();
    }

    initializeService() {
        try {
            if (!fs.existsSync(this.credentialsPath)) {
                logger.critical('Arquivo credentials.json nao encontrado para o servico Google Drive.');
                throw new Error('Configuracao de storage ausente.');
            }

            this.authClient = new google.auth.GoogleAuth({
                keyFile: this.credentialsPath,
                scopes: [
                    'https://www.googleapis.com/auth/drive',
                    'https://www.googleapis.com/auth/drive.file',
                    'https://www.googleapis.com/auth/drive.readonly',
                    'https://www.googleapis.com/auth/drive.metadata'
                ]
            });

            this.driveClient = google.drive({ version: 'v3', auth: this.authClient });
            logger.info('VlogStudents Google Drive Service Provider inicializado com sucesso.');
        } catch (error) {
            logger.error('Erro ao instanciar cliente Google Drive API v3', error);
        }
    }

    async uploadFile(fileBuffer, originalName, mimeType, subFolderId = null) {
        const startTime = Date.now();
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileBuffer);

        const fileName = `vlog_${Date.now()}_${originalName.replace(/\s+/g, '_')}`;
        const parentFolder = subFolderId || this.rootFolderId;

        const fileMetadata = {
            name: fileName,
            parents: [parentFolder],
            appProperties: {
                originalName: originalName,
                uploadedAt: new Date().toISOString(),
                system: 'VlogStudents'
            }
        };

        const media = {
            mimeType: mimeType,
            body: bufferStream
        };

        try {
            const response = await this.driveClient.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, name, webViewLink, webContentLink, thumbnailLink, size, mimeType'
            });

            const duration = Date.now() - startTime;
            logger.logMediaEvent('UPLOAD_CORE', response.data.id, duration, true);

            await this.setPublicReadPermission(response.data.id);

            return {
                success: true,
                fileId: response.data.id,
                name: response.data.name,
                mimeType: response.data.mimeType,
                size: response.data.size,
                links: {
                    view: response.data.webViewLink,
                    download: response.data.webContentLink,
                    thumbnail: response.data.thumbnailLink
                },
                internalPath: `vlogstudents://storage/${response.data.id}`
            };
        } catch (error) {
            logger.error(`Falha no upload para o Drive: ${originalName}`, error);
            throw new AppError('Nao foi possivel processar o armazenamento do arquivo na nuvem.', 502, 'DRIVE_UPLOAD_FAILED');
        }
    }

    async setPublicReadPermission(fileId) {
        try {
            await this.driveClient.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
            logger.debug(`Permissoes de leitura publica aplicadas ao arquivo ${fileId}`);
        } catch (error) {
            logger.warn(`Nao foi possivel definir permissao publica para o arquivo ${fileId}: ${error.message}`);
        }
    }

    async getFileStream(fileId) {
        try {
            const response = await this.driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );

            return response.data;
        } catch (error) {
            logger.error(`Erro ao tentar obter stream do arquivo ${fileId}`, error);
            throw new AppError('O arquivo solicitado nao esta disponivel ou foi removido.', 404, 'MEDIA_NOT_FOUND');
        }
    }

    async getFileMetadata(fileId) {
        try {
            const response = await this.driveClient.files.get({
                fileId: fileId,
                fields: 'id, name, mimeType, size, createdTime, md5Checksum, imageMediaMetadata, videoMediaMetadata'
            });
            return response.data;
        } catch (error) {
            logger.error(`Erro ao buscar metadados do arquivo ${fileId}`, error);
            return null;
        }
    }

    async deleteFile(fileId) {
        try {
            await this.driveClient.files.delete({ fileId: fileId });
            logger.info(`Arquivo ${fileId} removido permanentemente do Google Drive.`);
            return true;
        } catch (error) {
            logger.error(`Erro ao excluir arquivo ${fileId}`, error);
            throw new AppError('Nao foi possivel remover o arquivo do servidor de storage.', 500, 'DRIVE_DELETE_FAILED');
        }
    }

    async createFolder(folderName, parentFolderId = null) {
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId || this.rootFolderId]
        };

        try {
            const response = await this.driveClient.files.create({
                requestBody: fileMetadata,
                fields: 'id'
            });
            logger.info(`Nova pasta criada: ${folderName} ID: ${response.data.id}`);
            return response.data.id;
        } catch (error) {
            logger.error(`Erro ao criar pasta no Drive: ${folderName}`, error);
            return null;
        }
    }

    async findFolderByName(folderName, parentFolderId = null) {
        const parentId = parentFolderId || this.rootFolderId;
        const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;

        try {
            const response = await this.driveClient.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive'
            });
            return response.data.files.length > 0 ? response.data.files[0].id : null;
        } catch (error) {
            logger.error(`Erro ao pesquisar pasta: ${folderName}`, error);
            return null;
        }
    }

    async getOrCreateUserFolder(userId) {
        const folderName = `USER_${userId}`;
        let folderId = await this.findFolderByName(folderName);

        if (!folderId) {
            folderId = await this.createFolder(folderName);
        }

        return folderId;
    }

    async listAllFiles(pageSize = 100) {
        try {
            const response = await this.driveClient.files.list({
                pageSize: pageSize,
                fields: 'nextPageToken, files(id, name, mimeType, size, createdTime)',
                q: `'${this.rootFolderId}' in parents and trashed = false`
            });
            return response.data.files;
        } catch (error) {
            logger.error('Erro ao listar arquivos do storage global.', error);
            return [];
        }
    }

    async updateFileName(fileId, newName) {
        try {
            await this.driveClient.files.update({
                fileId: fileId,
                requestBody: { name: newName }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async copyFile(fileId, targetFolderId) {
        try {
            const response = await this.driveClient.files.copy({
                fileId: fileId,
                requestBody: { parents: [targetFolderId] }
            });
            return response.data.id;
        } catch (error) {
            return null;
        }
    }

    async emptyTrash() {
        try {
            await this.driveClient.files.emptyTrash();
            logger.info('Lixeira do Google Drive limpa com sucesso.');
            return true;
        } catch (error) {
            return false;
        }
    }

    async getStorageQuota() {
        try {
            const response = await this.driveClient.about.get({
                fields: 'storageQuota, user'
            });
            return response.data.storageQuota;
        } catch (error) {
            return null;
        }
    }

    async generateThumbnail(fileId) {
        try {
            const file = await this.getFileMetadata(fileId);
            return file ? file.thumbnailLink : null;
        } catch (error) {
            return null;
        }
    }

    async moveFile(fileId, newFolderId) {
        try {
            const file = await this.driveClient.files.get({
                fileId: fileId,
                fields: 'parents'
            });
            const previousParents = file.data.parents.join(',');
            await this.driveClient.files.update({
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
        try {
            const response = await this.driveClient.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(size)'
            });
            return response.data.files.reduce((acc, file) => acc + parseInt(file.size || 0), 0);
        } catch (error) {
            return 0;
        }
    }

    async searchFilesByMimeType(mimeType) {
        const query = `mimeType = '${mimeType}' and '${this.rootFolderId}' in parents and trashed = false`;
        try {
            const response = await this.driveClient.files.list({ q: query });
            return response.data.files;
        } catch (error) {
            return [];
        }
    }

    async exportFileAsPdf(fileId) {
        try {
            const response = await this.driveClient.files.export(
                { fileId: fileId, mimeType: 'application/pdf' },
                { responseType: 'stream' }
            );
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async checkFileExists(fileId) {
        try {
            await this.driveClient.files.get({ fileId: fileId, fields: 'id' });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getRecentFiles(limit = 10) {
        try {
            const response = await this.driveClient.files.list({
                pageSize: limit,
                orderBy: 'createdTime desc',
                q: `'${this.rootFolderId}' in parents and trashed = false`
            });
            return response.data.files;
        } catch (error) {
            return [];
        }
    }

    async batchDelete(fileIds = []) {
        const results = [];
        for (const id of fileIds) {
            const success = await this.deleteFile(id).catch(() => false);
            results.push({ id, success });
        }
        return results;
    }

    async updateMetadata(fileId, metadata = {}) {
        try {
            const response = await this.driveClient.files.update({
                fileId: fileId,
                requestBody: metadata
            });
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async getDirectLink(fileId) {
        const file = await this.getFileMetadata(fileId);
        return file ? `https://drive.google.com/uc?export=view&id=${fileId}` : null;
    }

    async verifyQuotaWarning() {
        const quota = await this.getStorageQuota();
        if (quota) {
            const usagePercent = (parseInt(quota.usage) / parseInt(quota.limit)) * 100;
            if (usagePercent > 85) {
                logger.warn(`Alerta de Storage: ${usagePercent.toFixed(2)}% da cota do Google Drive utilizada.`);
            }
        }
    }

    async getAppDirectoryTree() {
        try {
            const response = await this.driveClient.files.list({
                q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'files(id, name, parents)'
            });
            return response.data.files;
        } catch (error) {
            return [];
        }
    }

    async downloadToLocalBuffer(fileId) {
        try {
            const response = await this.driveClient.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'arraybuffer' }
            );
            return Buffer.from(response.data);
        } catch (error) {
            return null;
        }
    }

    async transferOwnership(fileId, newOwnerEmail) {
        try {
            await this.driveClient.permissions.create({
                fileId: fileId,
                transferOwnership: true,
                requestBody: {
                    role: 'owner',
                    type: 'user',
                    emailAddress: newOwnerEmail
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async revokePublicAccess(fileId) {
        try {
            const permissions = await this.driveClient.permissions.list({ fileId: fileId });
            const publicPerm = permissions.data.permissions.find(p => p.type === 'anyone');
            if (publicPerm) {
                await this.driveClient.permissions.delete({
                    fileId: fileId,
                    permissionId: publicPerm.id
                });
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    async getFileExtension(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        return metadata ? path.extname(metadata.name) : '';
    }

    async isFolder(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        return metadata && metadata.mimeType === 'application/vnd.google-apps.folder';
    }

    async getFileStatsByType() {
        const files = await this.listAllFiles(1000);
        const stats = {};
        files.forEach(f => {
            stats[f.mimeType] = (stats[f.mimeType] || 0) + 1;
        });
        return stats;
    }

    async patchFile(fileId, contentBuffer, mimeType) {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(contentBuffer);
        try {
            await this.driveClient.files.update({
                fileId: fileId,
                media: { mimeType, body: bufferStream }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getSystemDiagnostic() {
        const quota = await this.getStorageQuota();
        const files = await this.listAllFiles(5);
        return {
            status: this.driveClient ? 'active' : 'inactive',
            quota,
            sampleFiles: files,
            timestamp: new Date().toISOString()
        };
    }
}

const driveServiceInstance = new VlogStudentsGoogleDriveService();

setInterval(() => {
    driveServiceInstance.verifyQuotaWarning();
}, 3600000);

module.exports = driveServiceInstance;