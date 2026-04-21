/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v2.0.6
 * GESTÃO BINÁRIA COM NORMALIZAÇÃO DE CHAVE PRIVADA
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
            console.log('[DRIVE_CORE] Iniciando handshake com cluster Cloud...');
            
            let privateKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (!privateKey) {
                console.error('[DRIVE_FATAL] Variável GOOGLE_PRIVATE_KEY não definida no Render.');
                return;
            }

            // NORMALIZAÇÃO DE CHAVE: Trata quebras de linha enviadas via String
            const formattedKey = privateKey.replace(/\\n/g, '\n');

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                formattedKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            
            // Teste de link real
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Cluster Google Drive conectado e operando permissões públicas.');
        } catch (error) {
            console.error('[DRIVE_FATAL] Erro de autenticação Google Cloud:', error.message);
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
        if (!this.drive) throw new Error('Driver de nuvem não inicializado.');

        try {
            const fileName = `${customName}_${Date.now()}`;
            
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

            // RESOLUÇÃO "LINK BROKEN": Torna o arquivo público para o VideoPlayer
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            return fileId;
        } catch (error) {
            console.error('[DRIVE_UPLOAD_ERROR]', error.message);
            throw error;
        }
    }
}

module.exports = new DriveService();
