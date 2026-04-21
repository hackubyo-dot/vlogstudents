/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE DRIVE CLUSTER SERVICE v6.0.0
 * ORQUESTRADOR DE ARMAZENAMENTO E STREAMING BINÁRIO DE ALTA FIDELIDADE
 * 
 * DESIGNED FOR: ZERO LATENCY REELS & SECURE IDENTITY STORAGE
 * PASTA ALVO: 1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ
 * ============================================================================
 */

const { google } = require('googleapis');
const { Readable } = require('stream');

class DriveService {
    /**
     * Construtor da Infraestrutura Cloud
     */
    constructor() {
        // Escopos Industriais de Acesso
        this.scopes = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.metadata'
        ];

        this.drive = null;
        this.folderId = '1xruw6C-kgoT8A56TXFAiT6CukCpSJMBQ'; // Pasta do Cliente
        
        // Inicialização do barramento
        this._initialize();
    }

    /**
     * Protocolo de Handshake RSA (Resolução Definitiva de JWT Signature)
     */
    async _initialize() {
        try {
            console.log('[DRIVE_CORE] Iniciando protocolo de segurança RSA...');

            // Credenciais Master via Service Account
            const clientEmail = 'vlogstudentes@vlogstudentes.iam.gserviceaccount.com';
            
            // CHAVE PRIVADA MASTER (Sanitizada para evitar corrupção em sistemas Linux/Render)
            const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDAV3XMVQB12noT
pp5+0DX+T8/hdvee2Y1UG/SO2xSN4ezEFsMcPkwdgTlenRGfzjSGFDhmsKBsk1Pe
IVHuogMOFddMZ+JWU+W4PR7qosr9hMjZeuo6K13zQ89P6LCwby85nC/c6Ym2a4Jg
PeIbATYDDAjx40OncyGVki7pIILC2S7nLiHBf1Zq4CJiEmsNp9rOHt5r+ohr01Nf
jFlT0NvBv6Rr/Np41D6OTSjbQQZyg/dd65+Au1FrxY3WX/bEaCDtsPZYH13vhpbW
k2xEf+7uy8KK2cc/CbnIOEF5ubBkloIqstXuZluPFV5B9hLq/A2E+1fLuAiTomwL
lccSuATjAgMBAAECggEAC+4g12C6W5UGl2txT0pY3wJSUZjQeSDjXEEzpRy/pKFL
z0neJkVS8U2Pome5rSDcLyjX6r6v5Kwquo90hom0CM6gARQ8fMBNcmUQItugHaN7
1cmC98Ky3CDrnfg/5WGwGzGt4lT1/sOiXZfZC3XCxOOdNmuzSZKhlaZwlHM4yR8V
2fpTAu6LXca2Z3ZFAiFBePP5ywlpgoQ3VojwYU278QOp8EtKt2hwKkRsosXWMSJo
nrWW51s/ufmWAq/x31wvLt9+uo89lNSVijO/+biSXZR19CcpKOmyR0HuF5a47uHmS
CGTNCkspOWmHk1xaw+8CNO03eh90UDsdR7+LKPG/oQKBgQD0rEtd/ETBE8kAFYq1
lgbv0hHXwL8Euz2fdO7ptWsCC+WkPWfeEPsuAxK7uD+xWyj05EUz7IWnU6Ab8ZWK
lYCayQJjk1BzK9g4DFvW7+RG7iamsVgR30ru6Z8fkzTWZKDRceUlI1PKw5hVfFa2
N4VdnX5OyRdVycnnmtZrfCoc8wKBgQDJPvfc0anIBCUqmdKvNRvPc10FuTNLA+uM
kl4GHht1qAWFQRUkimmPVZkWFzLlr/kXxgPs9kdXcsUWGyF3nNJQ0qlAPQdHrwzq
1GKSvWZYGokjM0pp8i2+BN3hBY7nDewV/ZWdM5neqS6Az/R/oomCH9Np6PAFfyDo
hNke+U60UQKBgQDwHVYpejUPNpd/maRy6DUOjh4sml/cCNVE88CzYvMNIxfOwuR4
LjoSwblUuFDpgQkErDCt8GSJ/auXQNL9GhMH1FSf3CaLoG+lMZu/p9VjNrx/wnMn
tvcW1/btSc4EyOR6J0g11iGZT7Lj0g5W7M3ZPYKDVx2rd0jKHk5nVYcOuQKBgCGi
NXihTdfQ4YlKJg0EOj6kkDJprmnmINLgj3hEReCXET0hEHCH9XZwHuKzQ91hWKch
f/x1eJzj4I5+QEymV/wMCR9kU7gmSGliz4qovtcQsETCyLgGMqDkXVTDQgvZptBS
DlQ0kI3HBq+ekcVXG9Y0jXfQ53Rzt8NEmKj1j7LRAoGALqur9XSMzuZEGZmrDU5j
HdWDENkfoeWxIyAwO1g9itJBmYwr8P5b9y5j8p9//C3UNS1wr4yxB8jGgPdnruV7
TYRryiNI9EWaawCIeIN2sTqH4aOFNl3MFJEcsQcOXGdDJJyCxMJe3MBSwcefaLHC
rgM3GUaNarfwSZorIGU8ZNY=
-----END PRIVATE KEY-----`.replace(/\\n/g, '\n');

            const auth = new google.auth.JWT(
                clientEmail,
                null,
                privateKey,
                this.scopes
            );

            this.drive = google.drive({ version: 'v3', auth });

            // Validação de conexão imediata
            const test = await this.drive.files.list({ pageSize: 1 });
            if (test.status === 200) {
                console.log('[DRIVE_CORE] Sincronia Master com Google Cloud validada.');
            }

        } catch (error) {
            console.error('[DRIVE_FATAL] Erro na autenticação RSA:', error.message);
            console.log('[DRIVE_RECOVERY] Protocolo de reconexão ativado em 30s...');
            setTimeout(() => this._initialize(), 30000);
        }
    }

    /**
     * Converte Buffer em Stream Legível para a API do Google Drive
     */
    _bufferToStream(buffer) {
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);
        return stream;
    }

    /**
     * uploadFile - Persistência Master de Conteúdo
     * @param {Object} file - Objeto Multer
     * @param {String} customName - Nome para o arquivo na nuvem
     */
    async uploadFile(file, customName) {
        if (!this.drive) {
            console.error('[DRIVE_UPLOAD_FAIL] O serviço está offline.');
            throw new Error('Cloud Storage link is broken.');
        }

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
                fields: 'id, size, mimeType, webViewLink'
            });

            const fileId = response.data.id;

            // REGRA DE OURO: Aplicação imediata de visibilidade pública
            // Essencial para o streaming do Flutter VideoPlayer
            await this.drive.permissions.create({
                fileId: fileId,
                requestBody: {
                    role: 'reader',
                    type: 'anyone'
                }
            });

            console.log(`[DRIVE_SUCCESS] Arquivo UID: ${fileId} persistido e liberado.`);
            return fileId;

        } catch (error) {
            console.error('[DRIVE_UPLOAD_ERROR] Falha na transmissão binária:', error.message);
            throw error;
        }
    }

    /**
     * getFileMetadata - Coleta de Metadados Críticos
     * Necessário para calcular o Range do streaming
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
            console.error(`[DRIVE_META_ERROR] Falha ao ler UID: ${fileId}`, error.message);
            return null;
        }
    }

    /**
     * getVideoStream - Pipe de Bytes para o Proxy do Controller
     * Suporta alt=media para download direto de bytes
     */
    async getVideoStream(fileId) {
        if (!this.drive) throw new Error('Storage offline.');
        try {
            return await this.drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
        } catch (error) {
            console.error(`[DRIVE_STREAM_ERROR] Falha no stream de bytes: ${fileId}`, error.message);
            throw error;
        }
    }

    /**
     * deleteFile - Purgar Conteúdo do Cluster
     */
    async deleteFile(fileId) {
        if (!this.drive || !fileId) return false;
        try {
            await this.drive.files.delete({ fileId: fileId });
            console.log(`[DRIVE_PURGE] Arquivo UID: ${fileId} removido.`);
            return true;
        } catch (error) {
            console.error('[DRIVE_PURGE_ERROR] Falha ao deletar:', error.message);
            return false;
        }
    }

    /**
     * checkFolderIntegrity - Auditoria de Volume
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
            console.error('[DRIVE_AUDIT_ERROR] Falha na auditoria de pasta.');
        }
    }

    /**
     * searchFiles - Localizador Global de Mídia
     */
    async searchFiles(query) {
        if (!this.drive) return [];
        try {
            const res = await this.drive.files.list({
                q: `name contains '${query}' and '${this.folderId}' in parents`,
                fields: 'files(id, name, webViewLink)'
            });
            return res.data.files;
        } catch (e) { return []; }
    }
}

module.exports = new DriveService();
