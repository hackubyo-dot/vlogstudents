/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v2.0.7
 * GESTÃO BINÁRIA COM LIMPEZA DE ASSINATURA JWT (RSA FIX)
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
            console.log('[DRIVE_CORE] Iniciando protocolo de handshake Google Cloud...');
            
            let rawKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (!rawKey) {
                console.error('[DRIVE_FATAL] GOOGLE_PRIVATE_KEY não detectada no ambiente.');
                return;
            }

            // LIMPEZA AGRESSIVA DE CHAVE PRIVADA (Resolve Invalid JWT Signature)
            // 1. Remove aspas extras se o usuário colou com aspas no Render
            // 2. Converte \n literais em caracteres de quebra de linha reais
            const sanitizedKey = rawKey
                .trim()
                .replace(/^["']|["']$/g, '') 
                .replace(/\\n/g, '\n');

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                sanitizedKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            
            // Validação de link ativa
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Autenticação Cloud validada. Link operacional.');
        } catch (error) {
            console.error('[DRIVE_FATAL] Falha na validação JWT do Google:', error.message);
            // Re-tentativa silenciosa em 1 minuto
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
        if (!this.drive) throw new Error('Serviço de Storage em modo de recuperação. Tente em breve.');

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

            // Protocolo de Visibilidade (Vital para o VideoPlayer do Flutter)
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

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
