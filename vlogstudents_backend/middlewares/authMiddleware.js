/**
 * ============================================================================
 * VLOGSTUDENTS SECURITY GATEWAY (Auth Middleware)
 * PROTEÇÃO DE ENDPOINTS E VALIDAÇÃO DE INTEGRIDADE JWT
 * ============================================================================
 */

const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    // 1. Extração do Token do Header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.warn(`[SECURITY_ALERT] Acesso negado sem token: ${req.method} ${req.url}`);
        return res.status(401).json({
            success: false,
            message: 'Acesso restrito. Autenticação master necessária.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 2. Verificação de Assinatura e Expiração
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. Injeção de Identidade na Requisição
        // Isso permite que controllers acessem req.user.id
        req.user = {
            id: decoded.id,
            email: decoded.email,
            fullName: decoded.fullName
        };

        // Auditoria interna (Trace ID)
        req.traceId = req.headers['x-vlog-trace-id'] || 'CORE_TR_01';

        console.log(`[ACCESS_LOG] UID ${req.user.id} -> ${req.method} ${req.url}`);

        next();

    } catch (error) {
        console.error('[SECURITY_FAILURE] Token inválido ou corrompido:', error.message);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                code: 'TOKEN_EXPIRED',
                message: 'Sua sessão acadêmica expirou. Por favor, entre novamente.'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Assinatura digital inválida. Protocolo de segurança acionado.'
        });
    }
};

module.exports = authMiddleware;