/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE ORCHESTRATOR v2.0.0
 * SISTEMA DE GESTÃO BINÁRIA E DISTRIBUIÇÃO EM NUVEM
 * ============================================================================
 */

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

class DriveService {
    constructor() {
        this.scopes = ['https://www.googleapis.com/auth/drive'];
        this.drive = null;
        this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        this._initialize();
    }

    /**
     * Inicializa a conexão com o cluster do Google Cloud
     * Implementa protocolo de self-healing para re-autenticação automática
     */
    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Iniciando handshake com Google Cloud API...');

            // Validação de credenciais de ambiente
            if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
                throw new Error('Credenciais do Google Drive ausentes no arquivo .env');
            }

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });

            // Teste de integridade de link
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Link sincronizado e cluster operacional.');
        } catch (error) {
            console.error('[DRIVE_FATAL] Falha crítica na conexão com o Google Cloud:', error.message);
            console.log('[DRIVE_RECOVERY] Tentando reautenticação em 30 segundos...');
            setTimeout(() => this._initialize(), 30000);
        }
    }

    /**
     * Converte Buffer em Stream para upload eficiente (Previne estouro de RAM)
     */
    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * Upload Master de Arquivos (Reels ou Avatares)
     * @param {Object} file - Objeto do Multer
     * @returns {String} driveFileId - ID único gerado na nuvem
     */
    async uploadFile(file, customName = null) {
        if (!this.drive) await this._initialize();

        try {
            const fileName = customName || `VLOG_${Date.now()}_${path.basename(file.originalname)}`;
            console.log(`[DRIVE_STORAGE] Transmitindo arquivo: ${fileName}`);

            const fileMetadata = {
                name: fileName,
                parents: [this.folderId]
            };

            const media = {
                mimeType: file.mimetype,
                body: this._bufferToStream(file.buffer)
            };

            // Execução do Upload via Pipe
            const response = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink, webContentLink'
            });

            const fileId = response.data.id;
            console.log(`[DRIVE_STORAGE] Upload concluído. UID: ${fileId}`);

            // ATENÇÃO: Protocolo de Permissão Pública (Essencial para o Flutter)
            // Resolve o erro de "Google Cloud link broken" ao permitir leitura externa
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`[DRIVE_STORAGE] Permissões globais aplicadas ao UID: ${fileId}`);
            return fileId;

        } catch (error) {
            console.error('[DRIVE_STORAGE_ERROR] Falha no processo de persistência:', error.stack);
            throw new Error(`Cloud Storage Error: ${error.message}`);
        }
    }

    /**
     * Remove arquivos do Drive
     */
    async deleteFile(fileId) {
        if (!fileId) return;
        try {
            console.log(`[DRIVE_DELETION] Purgando arquivo UID: ${fileId}`);
            await this.drive.files.delete({ fileId });
            return true;
        } catch (error) {
            console.error('[DRIVE_DELETION_ERROR] Falha ao remover arquivo:', error.message);
            return false;
        }
    }

    /**
     * Busca metadados de um arquivo específico
     */
    async getFileMetadata(fileId) {
        try {
            const res = await this.drive.files.get({ fileId, fields: '*' });
            return res.data;
        } catch (error) {
            return null;
        }
    }

    /**
     * Gera Stream de Download para o Frontend (Streaming de Vídeo)
     */
    async getVideoStream(fileId, range) {
        try {
            // Este método é vital para o VideoPlayer do Flutter
            return await this.drive.files.get(
                { fileId, alt: 'media' },
                { responseType: 'stream' }
            );
        } catch (error) {
            console.error('[DRIVE_STREAM_ERROR] Erro no buffer de vídeo:', error.message);
            throw error;
        }
    }

    /**
     * Auditoria de Cota e Armazenamento
     */
    async checkQuota() {
        try {
            const res = await this.drive.about.get({ fields: 'storageQuota' });
            return res.data.storageQuota;
        } catch (error) {
            return null;
        }
    }

    /**
     * Listagem de Arquivos da Pasta Root do VlogStudents
     */
    async listAppFiles() {
        try {
            const res = await this.drive.files.list({
                q: `'${this.folderId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType, size)',
                spaces: 'drive'
            });
            return res.data.files;
        } catch (error) {
            console.error('[DRIVE_AUDIT_ERROR] Falha na listagem:', error.message);
            return [];
        }
    }

    /**
     * Método de Reparo de Links Quebrados
     * Re-aplica permissões se um arquivo se tornar inacessível
     */
    async repairLink(fileId) {
        try {
            console.log(`[DRIVE_REPAIR] Iniciando auto-healing para link: ${fileId}`);
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new DriveService();