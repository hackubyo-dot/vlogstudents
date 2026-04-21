/**
 * ============================================================================
 * VLOGSTUDENTS MASTER DRIVE SERVICE v4.0.0
 * CLUSTER DE ARMAZENAMENTO E PROTOCOLO RSA RSA-SAFE
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
            console.log('[DRIVE_CORE] Iniciando protocolo de sanitização de chave RSA...');
            
            let rawKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (!rawKey) {
                console.error('[DRIVE_FATAL] GOOGLE_PRIVATE_KEY ausente.');
                return;
            }

            // LIMPEZA CRIPTOGRÁFICA RSA
            const sanitizedKey = rawKey
                .trim()
                .replace(/^"(.*)"$/, '$1') 
                .replace(/\\n/g, '\n')
                .replace(/\\/g, '');

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                sanitizedKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Conexão Cloud estabelecida com sucesso.');

        } catch (error) {
            console.error('[DRIVE_FATAL] Falha no Handshake Google:', error.message);
            setTimeout(() => this._initialize(), 60000);
        }
    }

    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    async uploadFile(file, customName) {
        if (!this.drive) throw new Error('Serviço Cloud em recuperação.');

        try {
            const fileName = `${customName}_${Date.now()}`;
            const response = await this.drive.files.create({
                resource: { name: fileName, parents: [this.folderId] },
                media: { mimeType: file.mimetype, body: this._bufferToStream(file.buffer) },
                fields: 'id'
            });

            const fileId = response.data.id;

            // Define visibilidade "Reader/Anyone" para o Flutter VideoPlayer
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: { role: 'reader', type: 'anyone' }
            });

            return fileId;
        } catch (error) {
            throw error;
        }
    }

    async deleteFile(fileId) {
        try {
            if (this.drive) await this.drive.files.delete({ fileId });
            return true;
        } catch (e) { return false; }
    }
}

module.exports = new DriveService();
