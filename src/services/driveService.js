/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v4.2.0
 * PROTOCOLO DE NORMALIZAÇÃO RSA E GESTÃO BINÁRIA DE NUVEM
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

    /**
     * Handshake com o cluster Google Cloud
     * Resolve o erro "Invalid JWT Signature" limpando caracteres de escape do Render
     */
    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Iniciando protocolo de sanitização RSA...');
            
            let rawKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (!rawKey) {
                console.error('[DRIVE_FATAL] GOOGLE_PRIVATE_KEY não detectada no ambiente Render.');
                return;
            }

            // LÓGICA DE LIMPEZA RSA MASTER
            // 1. Remove aspas de strings coladas via console
            // 2. Converte \n (literal) para quebra de linha real
            // 3. Remove escapes acidentais de barra invertida
            const sanitizedKey = rawKey
                .trim()
                .replace(/^["']|["']$/g, '') 
                .replace(/\\n/g, '\n')
                .replace(/\\\\n/g, '\n');

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.SERVICE_ACCOUNT_EMAIL,
                null,
                sanitizedKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            
            // Teste de integridade de link real
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Cluster Google Drive operacional e público.');

        } catch (error) {
            console.error('[DRIVE_FATAL] Falha na validação JWT:', error.message);
            // Protocolo de auto-healing em 1 minuto
            setTimeout(() => this._initialize(), 60000);
        }
    }

    /**
     * Pipe de Buffer para Stream
     */
    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * Upload e Permissão Pública Automática
     * Resolve "Google Cloud link broken"
     */
    async uploadFile(file, customName) {
        if (!this.drive) throw new Error('Armazenamento em nuvem indisponível.');

        try {
            const fileName = `${customName}_${Date.now()}`;
            console.log(`[DRIVE_STORAGE] Transmitindo binário: ${fileName}`);

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

            // Define visibilidade total para o VideoPlayer do Flutter
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`[DRIVE_SUCCESS] Arquivo persistido e público: ${fileId}`);
            return fileId;

        } catch (error) {
            console.error('[DRIVE_UPLOAD_FATAL]', error.message);
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
