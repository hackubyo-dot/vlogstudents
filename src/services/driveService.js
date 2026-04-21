/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v2.0.4
 * GESTÃO BINÁRIA COM PROTOCOLO DE SEGURANÇA CONTRA VARIÁVEIS NULAS
 * ============================================================================
 */

const { google } = require('googleapis');
const { Readable } = require('stream');

class DriveService {
    constructor() {
        this.scopes = ['https://www.googleapis.com/auth/drive'];
        this.drive = null;
        this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        this._initialize();
    }

    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Sincronizando com cluster Google Cloud...');
            
            // CORREÇÃO CRÍTICA: Validação de existência da chave antes do .replace()
            const privateKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (!privateKey) {
                console.error('[DRIVE_CONFIG_ERROR] Variável GOOGLE_PRIVATE_KEY não encontrada no ambiente.');
                return; // Impede o crash do servidor
            }

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                privateKey.replace(/\\n/g, '\n'),
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Cluster operacional e autenticado.');
        } catch (error) {
            console.error('[DRIVE_FATAL] Erro de autenticação Google Cloud:', error.message);
            // Protocolo de auto-healing
            setTimeout(() => this._initialize(), 30000);
        }
    }

    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    async uploadFile(file, customName) {
        if (!this.drive) {
            throw new Error('Serviço de armazenamento indisponível (Auth Fail).');
        }

        try {
            const fileName = `${customName}_${Date.now()}`;
            console.log(`[DRIVE_STORAGE] Transmitindo: ${fileName}`);

            const response = await this.drive.files.create({
                resource: {
                    name: fileName,
                    parents: [this.folderId]
                },
                media: {
                    mimeType: file.mimetype,
                    body: this._bufferToStream(file.buffer)
                },
                fields: 'id'
            });

            const fileId = response.data.id;

            // Aplicação de Permissão Pública Imediata
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`[DRIVE_SUCCESS] Arquivo persistido. UID: ${fileId}`);
            return fileId;

        } catch (error) {
            console.error('[DRIVE_UPLOAD_FATAL]', error.stack);
            throw new Error('Falha na persistência em nuvem.');
        }
    }

    async deleteFile(fileId) {
        try {
            if (!this.drive) return false;
            await this.drive.files.delete({ fileId });
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new DriveService();
