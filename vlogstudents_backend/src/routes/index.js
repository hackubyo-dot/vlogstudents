/**
 * ============================================================================
 * VLOGSTUDENTS MASTER ROUTER ORCHESTRATOR v32.0.0 (ENTERPRISE EDITION)
 * ZERO 404 | ZERO MISMATCH | FULL BACKEND INTEGRATION | READY FOR FLUTTER
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Este arquivo é o ponto central de roteamento do ecossistema.
 * Gerencia a segurança via Middlewares JWT e a distribuição de carga para os
 * controladores especializados (Auth, Reels, Chat, Social, Economy).
 * ============================================================================
 */

const express = require('express');
const router = express.Router();

/**
 * ============================================================================
 * 🔐 MIDDLEWARES DE SEGURANÇA E INFRAESTRUTURA
 * ============================================================================
 */
// auth: Validação de Token JWT e Injeção de req.user
const auth = require('../middlewares/auth');

// upload: Motor Multer para processamento de arquivos binários (Multipart/Form-Data)
const upload = require('../middlewares/upload');

/**
 * ============================================================================
 * 🎯 INJEÇÃO DE CONTROLADORES (ENTERPRISE CONTROLLERS)
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
 * 🔓 MÓDULO DE IDENTIDADE (PUBLIC ROUTES)
 * Endpoints acessíveis sem necessidade de token de sessão.
 * ============================================================================
 */

// 🌐 NOVO: GOOGLE FEDERATED IDENTITY (v32.0.0)
// Integração direta com Google Sign-In do Flutter
router.post('/auth/google', authCtrl.googleAuth);

// 📝 Registro Acadêmico Tradicional
router.post('/auth/register', authCtrl.register);

// 🔑 Login via E-mail e Senha
router.post('/auth/login', authCtrl.login);

// 📩 Recuperação de Conta (Envio de PIN OTP)
router.post('/auth/recovery/request', authCtrl.requestRecovery);

// 🔁 Redefinição de Senha (Validação de PIN + Nova Senha)
router.post('/auth/recovery/reset', authCtrl.resetPassword);

/**
 * ============================================================================
 * 👤 MÓDULO DE USUÁRIOS (PROTECTED ROUTES)
 * Gerenciamento de perfil e metadados do estudante.
 * ============================================================================
 */

// Obter dados do próprio usuário (Handshake inicial)
router.get('/users/me', auth, userCtrl.getMe);

// Visualizar perfil público de qualquer estudante (ID ou 'me')
router.get('/users/profile/:userId', auth, userCtrl.getProfile);

// Auditoria de métricas sociais (Seguidores, Seguindo, Likes recebidos)
router.get('/users/social/metrics/:userId', auth, userCtrl.getSocialMetrics);

// Global Campus Search: Busca inteligente de usuários por nome ou curso
router.get('/users/search', auth, userCtrl.searchUsers);

// Sincronização de metadados de perfil (Bio, Telefone, Universidade)
router.patch('/users/update', auth, userCtrl.updateProfile);

// Pipeline de Biometria Visual: Upload de Avatar (Supabase Sync)
router.post(
    '/users/profile/avatar',
    auth,
    upload.single('file'),
    userCtrl.updateAvatar
);

// Protocolo de Encerramento: Desativação de conta (Soft Delete)
router.delete('/users/delete', auth, userCtrl.deleteAccount);

// Estatísticas de Indicação: Quem entrou com seu Referral Code
router.get('/users/referrals/stats', auth, economyCtrl.getReferralStats);

/**
 * ============================================================================
 * 🎬 MÓDULO DE CONTEÚDO (REELS / SHORTS)
 * Gerenciamento de vídeo de alta performance.
 * ============================================================================
 */

// Feed Principal: Algoritmo de descoberta acadêmica
router.get('/reels', auth, reelCtrl.getFeed);

// Galeria de Vídeos: Reels de um usuário específico
router.get('/reels/user/:userId', auth, reelCtrl.getUserReels);

// Atomic Data: Detalhes completos de um vídeo específico
router.get('/reels/:id', auth, reelCtrl.getById);

// Industrial Upload: Transmissão de vídeo para o Storage
router.post(
    '/reels/create',
    auth,
    upload.single('file'),
    reelCtrl.create
);

// Modificação de Metadados: Editar legenda ou tags do Reel
router.patch('/reels/update/:id', auth, reelCtrl.update);

// Purga de Conteúdo: Deletar Reel (Com limpeza de cache)
router.delete('/reels/delete/:id', auth, reelCtrl.delete);

// Counter Sync: Incrementar visualização de forma assíncrona
router.post('/reels/:id/view', auth, reelCtrl.incrementView);

/**
 * ============================================================================
 * ❤️ MÓDULO SOCIAL (INTERAÇÕES E NETWORKING)
 * ============================================================================
 */

// Feedback Visual: Curtir/Descurtir vídeos
router.post('/social/like', auth, socialCtrl.toggleLike);

// Comentários: Suporta Texto ou Áudio (Voices) via Multipart
router.post(
    '/social/comment', 
    auth, 
    upload.single('file'), 
    socialCtrl.addComment
);

// Listagem Cronológica de comentários de um vídeo
router.get('/social/comments/:reelId', auth, socialCtrl.getComments);

// Reações Dinâmicas (🔥, 👏, 🧠) em comentários específicos
router.post('/social/comment/react', auth, socialCtrl.toggleReaction);

// Networking: Seguir ou Deixar de seguir outro estudante
router.post('/social/follow', auth, socialCtrl.toggleFollow);

/**
 * ============================================================================
 * ⏳ MÓDULO DE STATUS (STORIES ACADÊMICOS)
 * Conteúdo efêmero com expiração automática (24h).
 * ============================================================================
 */

// Buscar Círculo de Status: Apenas status ativos dos seguidos
router.get('/status/active', auth, statusCtrl.getActive);

// Publicação de Status: Suporta Mídia Binária (Foto/Vídeo)
router.post(
    '/status/create', 
    auth, 
    upload.single('file'), 
    statusCtrl.create
);

/**
 * ============================================================================
 * 💬 MÓDULO DE COMUNICAÇÃO (REALTIME CHAT)
 * ============================================================================
 */

// Listar salas de conversa ativas (Inbox)
router.get('/chat/rooms', auth, chatCtrl.getMyRooms);

// Criar canal de comunicação privado (1-on-1)
router.post('/chat/rooms/create', auth, chatCtrl.createOrGetRoom);

// Recuperar histórico de mensagens (Suporte a paginação)
router.get('/chat/rooms/:roomId/messages', auth, chatCtrl.getMessages);

// Envio de Mensagem (Fallback via HTTP se o Socket estiver instável)
router.post('/chat/messages', auth, chatCtrl.sendMessage);

/**
 * ============================================================================
 * 💰 MÓDULO ECONÔMICO (VOICES GAMIFICATION)
 * Sincronização com o Neon DB Ledger.
 * ============================================================================
 */

// Histórico Financeiro: Entradas e saídas de Voices
router.get('/economy/history', auth, economyCtrl.getHistory);

// Campus Leaderboard: Ranking de estudantes com mais pontos
router.get('/economy/leaderboard', auth, economyCtrl.getLeaderboard);

/**
 * ============================================================================
 * 📦 UTILS & SYSTEM TOOLS
 * ============================================================================
 */

// Uploader Genérico: Para documentos acadêmicos ou anexos avulsos
router.post('/upload', auth, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "Ficheiro não recebido." });
    return res.json({
        success: true,
        message: "Arquivo processado no núcleo com sucesso.",
        file: req.file
    });
});

// Gateway Health Check: Monitoramento de latência e versão
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'VLOGSTUDENTS ENTERPRISE GATEWAY ONLINE 🚀',
        version: '32.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date()
    });
});

/**
 * ============================================================================
 * ⚠️ PROTOCOLO DE ERRO 404 (FALLBACK)
 * Captura qualquer rota não mapeada no ecossistema.
 * ============================================================================
 */
router.use((req, res) => {
    console.error(`[ROUTE_NOT_FOUND] Erro de destino: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: `Este endpoint não existe no campus VlogStudents: ${req.method} ${req.originalUrl}`
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
 * FIM DO ROUTER ORCHESTRATOR v32.0.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * ============================================================================
 */
