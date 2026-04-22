/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - AUTHENTICATION MIDDLEWARE
 * Validação de Tokens JWT e Gestão de Sessão do Usuário
 * ============================================================================
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // 1. Verificação de Presença do Header
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Acesso negado. É necessário um token de autenticação válido.'
            });
        }

        const token = authHeader.split(' ')[1];

        // 2. Verificação de Assinatura e Expiração
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // 3. Verificação de Existência e Estado do Usuário no Banco (Audit)
        const userQuery = await db.query(
            'SELECT id, email, full_name, isactive, points_total, university_name FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userQuery.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não localizado no sistema acadêmico.'
            });
        }

        const user = userQuery.rows[0];

        // 4. Verificação de Conta Ativa (Anti-Fraude/Ban)
        if (!user.isactive) {
            return res.status(403).json({
                success: false,
                message: 'Esta conta universitária está temporariamente suspensa.'
            });
        }

        // 5. Injeção do Perfil na Requisição (User Hydration)
        req.user = user;
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Sua sessão expirou. Por favor, faça login novamente.'
            });
        }
        
        console.error('[AUTH_MIDDLEWARE_ERROR]', error.message);
        return res.status(401).json({
            success: false,
            message: 'Token de autenticação inválido ou corrompido.'
        });
    }
};

module.exports = authMiddleware;
