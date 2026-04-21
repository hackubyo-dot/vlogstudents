/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v7.0.0
 * PROTOCOLO DE RECONSTRUÇÃO RSA (FIX: DECODER routines::unsupported)
 * ORQUESTRADOR DE ARMAZENAMENTO E STREAMING BINÁRIO DE ALTA FIDELIDADE
 * * PASTA ALVO: 1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ
 * ============================================================================
 */

const { google } = require('googleapis');
const { Readable } = require('stream');

class DriveService {
    /**
     * Construtor da Infraestrutura Cloud
     */
    constructor() {
        // Escopos Industriais de Acesso para Gestão Completa
        this.scopes = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.metadata'
        ];

        this.drive = null;
        this.folderId = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ'; // Cluster ID da Pasta
        
        // Inicialização do barramento com protocolo RSA
        this._initialize();
    }

    /**
     * Protocolo de Reconstrução RSA: Formata e limpa a chave privada 
     * para compatibilidade total com OpenSSL 3.x e sistemas Linux/Render.
     */
    _formatPrivateKey(key) {
        if (!key) return null;
        
        // 1. Remove aspas acidentais e limpa espaços nas extremidades
        let cleanKey = key.trim().replace(/^["']|["']$/g, '');
        
        // 2. Transforma \n literal (comum no .env do Render) em quebra de linha real
        cleanKey = cleanKey.replace(/\\n/g, '\n');
        
        // 3. Se a chave estiver em uma única linha (corrompida), reconstrói o padrão PEM RSA
        if (!cleanKey.includes('\n')) {
            const header = "-----BEGIN PRIVATE KEY-----";
            const footer = "-----END PRIVATE KEY-----";
            
            // Extrai apenas o corpo da base64
            let body = cleanKey
                .replace(header, "")
                .replace(footer, "")
                .replace(/\s/g, "");
            
            // Quebra o corpo em linhas de 64 caracteres (padrão RFC/RSA)
            const lines = body.match(/.{1,64}/g);
            cleanKey = `${header}\n${lines.join('\n')}\n${footer}`;
        }
        
        return cleanKey;
    }

    /**
     * Inicialização do Barramento de Autenticação JWT
     */
    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Iniciando Handshake Criptográfico RSA...');
            
            const clientEmail = 'vlogstudentes@vlogstudentes.iam.gserviceaccount.com';
            const rawKey = process.env.GOOGLE_PRIVATE_KEY;
            const sanitizedKey = this._formatPrivateKey(rawKey);

            if (!sanitizedKey) {
                throw new Error('Chave RSA (GOOGLE_PRIVATE_KEY) não configurada no Environment.');
            }

            const auth = new google.auth.JWT(
                clientEmail,
                null,
                sanitizedKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });
            
            // Teste de conexão Real (Validação de JWT Signature)
            const validation = await this.drive.files.list({ pageSize: 1 });
            
            if (validation.status === 200) {
                console.log('[DRIVE_CORE] Cluster Cloud Conectado e Autorizado (RSA v7.0.0).');
            }

        } catch (error) {
            console.error('[DRIVE_FATAL] Falha no Handshake RSA:', error.message);
            // Protocolo de Recuperação: Tenta reconectar em 30 segundos
            console.log('[DRIVE_RECOVERY] Tentando reinicializar cluster em 30s...');
            setTimeout(() => this._initialize(), 30000);
        }
    }

    /**
     * Utilitário: Converte Buffer (Multer) em Stream Legível para o Google API
     */
    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * Persistência Master de Conteúdo (Upload e Permissão Pública)
     */
    async uploadFile(file, customName) {
        if (!this.drive) throw new Error('Cloud Indisponível (Driver Offline).');

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

            // REGRA DE OURO: Liberar visibilidade pública imediatamente para Streaming Mobile
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: { role: 'reader', type: 'anyone' }
            });

            console.log(`[DRIVE_SUCCESS] Arquivo UID: ${fileId} persistido e liberado.`);
            return fileId;

        } catch (error) {
            console.error('[DRIVE_UPLOAD_ERROR] Falha na transmissão binária:', error.message);
            throw error;
        }
    }

    /**
     * Coleta de Metadados Críticos (Suporte para cálculos de Range/Buffer)
     */
    async getFileMetadata(fileId) {
        if (!this.drive) return null;
        try {
            const response = await this.drive.files.get({
                fileId: fileId,
                fields: 'id, name, size, mimeType, md5Checksum'
            });
            return response.data;
        } catch (error) {
            console.error(`[DRIVE_META_ERROR] UID: ${fileId}`, error.message);
            return null;
        }
    }

    /**
     * Pipe de Bytes para Streaming Proxy
     */
    async getVideoStream(fileId) {
        if (!this.drive) throw new Error('Cloud Offline (Driver Error).');
        try {
            return await this.drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
        } catch (error) {
            console.error(`[DRIVE_STREAM_ERROR] Falha no stream: ${fileId}`, error.message);
            throw error;
        }
    }

    /**
     * Purga Definitiva de Conteúdo do Cluster
     */
    async deleteFile(fileId) {
        if (!this.drive || !fileId) return false;
        try {
            await this.drive.files.delete({ fileId: fileId });
            console.log(`[DRIVE_PURGE] Arquivo UID: ${fileId} removido do cluster.`);
            return true;
        } catch (error) {
            console.error('[DRIVE_PURGE_ERROR] Falha ao deletar:', error.message);
            return false;
        }
    }

    /**
     * Auditoria de Volume do Cluster
     */
    async checkFolderIntegrity() {
        if (!this.drive) return;
        try {
            const res = await this.drive.files.list({
                q: `'${this.folderId}' in parents and trashed = false`,
                fields: 'files(id, name, size)',
            });
            console.log(`[DRIVE_AUDIT] Cluster contém ${res.data.files.length} objetos ativos.`);
        } catch (error) {
            console.error('[DRIVE_AUDIT_ERROR] Falha na auditoria de integridade.');
        }
    }
}

// Exporta Instância Única (Singleton Master)
module.exports = new DriveService();
