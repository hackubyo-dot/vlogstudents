/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v8.0.0
 * PROTOCOLO DE RECONSTRUÇÃO RSA BLINDADO & STREAMING ENGINE
 * ============================================================================
 */

const { google } = require('googleapis');
const { Readable } = require('stream');

class DriveService {
    constructor() {
        this.scopes = ['https://www.googleapis.com/auth/drive'];
        this.drive = null;
        // Pasta Raiz do Projeto no Drive
        this.folderId = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ';
        this._initialize();
    }

    /**
     * Sanitização Universal de Chave Privada
     * Resolve o problema de caracteres de escape (\n) vindos do process.env
     */
    _sanitizeKey(key) {
        if (!key) return null;
        return key
            .replace(/\\n/g, '\n') // Converte literal \n em quebra real
            .replace(/"/g, '')     // Remove aspas acidentais
            .trim();
    }

    /**
     * Handshake RSA com Google Cloud
     */
    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Iniciando Handshake RSA...');
            
            const rawKey = process.env.GOOGLE_PRIVATE_KEY;
            const cleanKey = this._sanitizeKey(rawKey);

            if (!cleanKey || !cleanKey.includes('BEGIN PRIVATE KEY')) {
                console.error('[DRIVE_FATAL] Chave RSA corrompida ou ausente no ambiente.');
                return;
            }

            const auth = new google.auth.JWT(
                'vlogstudentes@vlogstudentes.iam.gserviceaccount.com',
                null,
                cleanKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            
            // Teste de conexão silencioso
            await this.drive.files.list({ pageSize: 1 });
            console.log('[DRIVE_CORE] Cluster Google Cloud sincronizado com sucesso.');

        } catch (error) {
            console.error('[DRIVE_FATAL] Falha na autenticação Cloud:', error.message);
            // Tenta reconectar após 1 minuto em caso de falha de rede
            setTimeout(() => this._initialize(), 60000);
        }
    }

    /**
     * Converte o buffer do Multer em stream legível para o Google
     */
    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * Recupera metadados essenciais para o cálculo de Buffer (Streaming)
     */
    async getFileMetadata(fileId) {
        if (!this.drive) return null;
        try {
            const res = await this.drive.files.get({ 
                fileId, 
                fields: 'id, name, size, mimeType' 
            });
            return res.data;
        } catch (e) { 
            console.error(`[DRIVE_META_ERR] Erro ao buscar ID: ${fileId}`, e.message);
            return null; 
        }
    }

    /**
     * Engine de Streaming - Retorna o stream binário direto do Google
     */
    async getVideoStream(fileId) {
        if (!this.drive) throw new Error('Cloud Offline');
        return await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );
    }

    /**
     * Upload Universal (Imagens e Vídeos) com Permissão Pública Automática
     */
    async uploadFile(file, customName) {
        if (!this.drive) throw new Error('Cloud Storage indisponível.');
        
        try {
            // 1. Criar o arquivo no Drive
            const res = await this.drive.files.create({
                resource: { 
                    name: `${customName}_${Date.now()}`, 
                    parents: [this.folderId] 
                },
                media: { 
                    mimeType: file.mimetype, 
                    body: this._bufferToStream(file.buffer) 
                },
                fields: 'id'
            });

            const driveFileId = res.data.id;

            // 2. Aplicar permissão de leitura para "qualquer pessoa"
            // Isso evita erro de acesso negado no player do Flutter
            await this.drive.permissions.create({
                fileId: driveFileId,
                requestBody: { 
                    role: 'reader', 
                    type: 'anyone' 
                }
            });

            console.log(`[DRIVE_SUCCESS] Upload concluído: ${driveFileId}`);
            return driveFileId;

        } catch (error) {
            console.error('[UPLOAD_ERROR]', error.message);
            throw error;
        }
    }

    /**
     * Delete - Limpeza de arquivos (Ex: troca de avatar)
     */
    async deleteFile(fileId) {
        if (!this.drive) return;
        try {
            await this.drive.files.delete({ fileId });
        } catch (e) {
            console.error('[DRIVE_DELETE_ERR]', e.message);
        }
    }
}

// Exporta como Singleton para manter uma única conexão com o Google
module.exports = new DriveService();
