/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v3.0.0
 * PROTOCOLO DE NORMALIZAÇÃO RSA E GESTÃO BINÁRIA DE NUVEM
 * DESIGNED TO ELIMINATE "INVALID JWT SIGNATURE" PERMANENTLY
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
     * Inicializa o Handshake com o cluster Google Cloud
     * Implementa sanitização agressiva para chaves privadas RSA
     */
    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Iniciando protocolo de sanitização de chave RSA...');
            
            let rawKey = process.env.GOOGLE_PRIVATE_KEY;
            
            if (!rawKey) {
                console.error('[DRIVE_FATAL] Erro: GOOGLE_PRIVATE_KEY não encontrada nas variáveis de ambiente.');
                return;
            }

            /**
             * LÓGICA DE LIMPEZA MASTER RSA (Anti-Corrupção de String)
             * 1. Remove aspas duplas iniciais e finais que o Render/Env injeta
             * 2. Remove espaços em branco acidentais
             * 3. Substitui a sequência literal '\n' por quebras de linha reais (\n)
             * 4. Remove barras invertidas duplicadas (comum em colas de JSON)
             */
            const sanitizedKey = rawKey
                .trim()
                .replace(/^"(.*)"$/, '$1') 
                .replace(/\\n/g, '\n')
                .replace(/\\/g, '');

            // Validação visual do formato (Apenas cabeçalho)
            if (!sanitizedKey.includes('-----BEGIN PRIVATE KEY-----')) {
                console.error('[DRIVE_FATAL] Formato de chave inválido: Cabeçalho RSA ausente.');
                return;
            }

            const auth = new google.auth.JWT(
                process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                null,
                sanitizedKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            
            // Teste de integridade de link (Handshake real)
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Handshake concluído. Cluster Google Drive operando em 100%.');

        } catch (error) {
            console.error('[DRIVE_FATAL] Falha na validação JWT do Google:', error.message);
            console.log('[DRIVE_RECOVERY] Tentando re-sincronização em 60 segundos...');
            setTimeout(() => this._initialize(), 60000);
        }
    }

    /**
     * Converte o buffer do Multer em stream para o Google API
     */
    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * Upload Mestre de Arquivos (Reels ou Avatares)
     * Resolve o erro de "Google Cloud link broken" via permissões automáticas
     */
    async uploadFile(file, customName) {
        if (!this.drive) {
            console.warn('[DRIVE_WARNING] Tentativa de upload com Driver offline. Reiniciando...');
            await this._initialize();
            if (!this.drive) throw new Error('Serviço de Cloud Storage temporariamente indisponível.');
        }

        try {
            const fileName = `${customName}_${Date.now()}`;
            console.log(`[DRIVE_STORAGE] Transmitindo binário para a nuvem: ${fileName}`);

            const response = await this.drive.files.create({
                resource: {
                    name: fileName,
                    parents: [this.folderId]
                },
                media: {
                    mimeType: file.mimetype,
                    body: this._bufferToStream(file.buffer)
                },
                fields: 'id, webViewLink'
            });

            const fileId = response.data.id;

            // PROTOCOLO DE VISIBILIDADE PÚBLICA (Vital para o Flutter VideoPlayer)
            // Isso garante que o link não quebre no frontend
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`[DRIVE_SUCCESS] Arquivo persistido e público. UID: ${fileId}`);
            return fileId;

        } catch (error) {
            console.error('[DRIVE_UPLOAD_FATAL] Erro no processamento binário:', error.message);
            throw error;
        }
    }

    /**
     * Deleta arquivo do Drive (Cleanup acadêmico)
     */
    async deleteFile(fileId) {
        if (!fileId || !this.drive) return false;
        try {
            await this.drive.files.delete({ fileId });
            return true;
        } catch (e) {
            return false;
        }
    }
}

module.exports = new DriveService();
