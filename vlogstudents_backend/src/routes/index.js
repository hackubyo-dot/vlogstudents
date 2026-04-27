/**
 * ============================================================================
 * VLOGSTUDENTS MASTER ROUTER ORCHESTRATOR v32.0.0 - ULTIMATE ENTERPRISE
 * IDENTITY | CONTENT | SOCIAL | REALTIME CHAT | ECONOMY | STATUS
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Este orquestrador é o coração do ecossistema VlogStudents. 
 * Ele gerencia o fluxo de tráfego entre o Flutter (Mobile/Web) e os núcleos 
 * de processamento do Node.js.
 * 
 * LOG DE ATUALIZAÇÕES v32.0.0:
 * - Implementação de Confirmação de Leitura (Read Receipts) no Chat.
 * - Integração do Google Federated Identity (Google Sign-In).
 * - Sincronização de Sinais de Chamada e Metadados de Status.
 * - Proteção de Rotas via JWT Middleware (Zero Trust Architecture).
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Acesso direto para operações atômicas rápidas

/**
 * ============================================================================
 * 🔐 MIDDLEWARES DE INFRAESTRUTURA
 * ============================================================================
 */
// auth: Validação de integridade do token JWT e injeção do objeto req.user
const auth = require('../middlewares/auth');

// upload: Gerenciador de buffer multipart/form-data para mídias (Multer)
const upload = require('../middlewares/upload');

/**
 * ============================================================================
 * 🎯 INJEÇÃO DE CONTROLADORES DE NEGÓCIO (BUSINESS UNITS)
 * ============================================================================
 */
const authCtrl = require('../controllers/authController');
const userCtrl = require('../controllers/userController');
const reelCtrl = require('../controllers/reelController');
const socialCtrl = require('../controllers/socialController');
const chatCtrl = require('../controllers/chatController');
const economyCtrl = require('../controllers/economyController');
const statusCtrl = require('../controllers/statusController');

/**
 * ============================================================================
 * 🔓 MÓDULO DE AUTENTICAÇÃO E IDENTIDADE (PUBLIC)
 * Endpoints abertos para handshake e criação de conta.
 * ============================================================================
 */

// 🌐 GOOGLE IDENTITY: Login/Registro automático via Google Cloud
router.post('/auth/google', authCtrl.googleAuth);

// 📝 REGISTER: Criação de conta tradicional com sistema de indicação
router.post('/auth/register', authCtrl.register);

// 🔑 LOGIN: Autenticação via e-mail e senha institucional
router.post('/auth/login', authCtrl.login);

// 📩 RECOVERY REQUEST: Solicitação de PIN OTP para reset de senha
router.post('/auth/recovery/request', authCtrl.requestRecovery);

// 🔁 RECOVERY RESET: Validação de PIN e definição de nova chave mestra
router.post('/auth/recovery/reset', authCtrl.resetPassword);

/**
 * ============================================================================
 * 👤 MÓDULO DE USUÁRIOS E NETWORKING (PROTECTED)
 * ============================================================================
 */

// Obter dados do próprio perfil (Handshake inicial do App)
router.get('/users/me', auth, userCtrl.getMe);

// Obter perfil público de qualquer estudante do campus
router.get('/users/profile/:userId', auth, userCtrl.getProfile);

// Auditoria de métricas: Seguidores, Seguindo e Reações acumuladas
router.get('/users/social/metrics/:userId', auth, userCtrl.getSocialMetrics);

// Global Search: Busca de estudantes por nome, e-mail ou curso
router.get('/users/search', auth, userCtrl.searchUsers);

// Sincronização de Metadados: Atualizar bio, telefone e universidade
router.patch('/users/update', auth, userCtrl.updateProfile);

// Media Pipeline: Upload de foto de perfil (Avatar) para Supabase
router.post(
    '/users/profile/avatar',
    auth,
    upload.single('file'),
    userCtrl.updateAvatar
);

// Account Deletion: Protocolo de encerramento de conta (Soft Delete)
router.delete('/users/delete', auth, userCtrl.deleteAccount);

/**
 * ============================================================================
 * 🎬 MÓDULO DE CONTEÚDO VERTICAL (REELS / VLOGS)
 * ============================================================================
 */

// Discovery Feed: Algoritmo de entrega de vídeos curtos
router.get('/reels', auth, reelCtrl.getFeed);

// User Gallery: Lista todos os vídeos de um autor específico
router.get('/reels/user/:userId', auth, reelCtrl.getUserReels);

// Reel Detail: Dados atômicos de um vídeo específico
router.get('/reels/:id', auth, reelCtrl.getById);

// Industrial Upload: Publicação de novo vídeo (Multipart)
router.post(
    '/reels/create',
    auth,
    upload.single('file'),
    reelCtrl.create
);

// Metadata Update: Editar título, descrição ou tags do Reel
router.patch('/reels/update/:id', auth, reelCtrl.update);

// Content Purge: Remoção definitiva de conteúdo do servidor
router.delete('/reels/delete/:id', auth, reelCtrl.delete);

// View Counter: Incremento transacional de visualização (Auditado)
router.post('/reels/:id/view', auth, reelCtrl.incrementView);

/**
 * ============================================================================
 * ❤️ MÓDULO SOCIAL E INTERAÇÕES
 * ============================================================================
 */

// Reel Like: Sistema de alternância (Toggle) de curtidas
router.post('/social/like', auth, socialCtrl.toggleLike);

// Comments: Adicionar comentário (Suporta áudio voices via Multipart)
router.post(
    '/social/comment',
    auth,
    upload.single('file'),
    socialCtrl.addComment
);

// Comment Feed: Lista cronológica de comentários de um vídeo
router.get('/social/comments/:reelId', auth, socialCtrl.getComments);

// Reactions: Reações dinâmicas (🔥, 👏, 🧠) em comentários
router.post('/social/comment/react', auth, socialCtrl.toggleReaction);

// Networking: Seguir ou deixar de seguir um estudante
router.post('/social/follow', auth, socialCtrl.toggleFollow);

/**
 * ============================================================================
 * 💬 MÓDULO DE COMUNICAÇÃO REALTIME (CHAT)
 * ============================================================================
 */

// Inbox: Listar todas as salas de conversa ativas do usuário
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);

// Room Orchestrator: Cria ou recupera uma sala entre dois estudantes
router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);

// Message History: Recuperação de mensagens de uma sala (Paginação)
router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

// HTTP Message Fallback: Envio de mensagem via API (Sincronização Socket)
router.post('/chat/messages', auth, chatCtrl.sendMessage);

/**
 * 🛠 FIX: READ ENDPOINT (CONFIRMAÇÃO DE LEITURA)
 * Este endpoint resolve o erro 404 ao abrir salas de chat.
 * Sincroniza o status 'visto' no banco de dados Neon.
 */
router.post('/chat/rooms/:roomId/read', auth, async (req, res) => {
    const transactionId = `TX_${Date.now()}`;
    try {
        const { roomId } = req.params;
        const userId = req.user.id;

        console.log(`[CHAT_SYNC] ${transactionId} | Sala: ${roomId} | User: ${userId}`);

        // Atualiza todas as mensagens não lidas onde o usuário é o destinatário
        const updateResult = await db.query(
            `UPDATE chat_messages 
             SET is_read = true 
             WHERE room_id = $1 
             AND sender_id != $2 
             AND is_read = false`,
            [roomId, userId]
        );

        return res.status(200).json({
            success: true,
            message: 'Status de leitura sincronizado.',
            affectedRows: updateResult.rowCount,
            traceId: transactionId
        });
    } catch (error) {
        console.error(`[CHAT_SYNC_ERROR] ${transactionId}`, error);
        return res.status(500).json({
            success: false,
            message: 'Falha interna ao sincronizar leitura.',
            traceId: transactionId
        });
    }
});

/**
 * ============================================================================
 * ⏳ MÓDULO DE STATUS (CAMPUS STORIES)
 * ============================================================================
 */

// Stories Feed: Buscar todos os status ativos nas últimas 24h
router.get('/status/active', auth, statusCtrl.getActive);

// Story Create: Publicar novo status (Suporta imagem/vídeo via Multipart)
router.post(
    '/status/create',
    auth,
    upload.single('file'),
    statusCtrl.create
);

/**
 * ============================================================================
 * 💰 MÓDULO ECONÔMICO (GAMIFICATION & VOICES)
 * ============================================================================
 */

// Points History: Extrato de ganhos e gastos de Voices (Pontos)
router.get('/economy/history', auth, economyCtrl.getHistory);

// Campus Leaderboard: Ranking global de pontos do ecossistema
router.get('/economy/leaderboard', auth, economyCtrl.getLeaderboard);

// Referral Metrics: Dados sobre bônus de indicações concluídas
router.get('/users/referrals/stats', auth, economyCtrl.getReferralStats);

/**
 * ============================================================================
 * 📦 UTILS E SISTEMA
 * ============================================================================
 */

// Health Check Master: Monitoramento profundo de latência e conexão
router.get('/health', async (req, res) => {
    const start = Date.now();
    try {
        await db.query('SELECT 1'); // Ping no Neon DB
        const latency = Date.now() - start;
        res.json({
            success: true,
            status: 'OPERATIONAL',
            version: '32.0.0',
            db_latency: `${latency}ms`,
            timestamp: new Date()
        });
    } catch (e) {
        res.status(500).json({ success: false, status: 'DEGRADED', error: e.message });
    }
});

// Generic Upload: Gateway para arquivos diversos (Documentos/Imagens)
router.post('/upload', auth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "Buffer vazio." });
    return res.json({
        success: true,
        message: "Arquivo processado com sucesso.",
        file: req.file
    });
});

/**
 * ============================================================================
 * ⚠️ PROTOCOLO DE ERRO 404 (FALLBACK)
 * Captura qualquer tentativa de acesso a endpoints não mapeados.
 * ============================================================================
 */
router.use((req, res) => {
    console.warn(`[ROUTE_404] Tentativa de acesso: ${req.method} ${req.originalUrl} de IP: ${req.ip}`);
    res.status(404).json({
        success: false,
        message: `O endpoint acadêmico ${req.method} ${req.originalUrl} não foi localizado no servidor.`,
        protocol: 'VLOGSTUDENTS_ENTERPRISE_CORE'
    });
});

/**
 * ============================================================================
 * EXPORTAÇÃO DO ORQUESTRADOR
 * ============================================================================
 */
module.exports = router;

/**
 * ============================================================================
 * FIM DO MASTER ROUTER ORCHESTRATOR v32.0.0
 * TOTAL DE LINHAS DE LÓGICA E DOCUMENTAÇÃO: MÁXIMA COBERTURA.
 * ============================================================================
 */
