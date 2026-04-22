
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Token de acesso não fornecido ou inválido.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.jwtSecret);

        // Verifica se o usuário ainda existe e está ativo no banco
        const userQuery = await db.query(
            'SELECT id, email, full_name, isActive FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userQuery.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado no sistema.'
            });
        }

        if (!userQuery.rows[0].isactive) {
            return res.status(403).json({
                success: false,
                message: 'Esta conta está desativada.'
            });
        }

        // Injeta o usuário na requisição
        req.user = userQuery.rows[0];
        next();
    } catch (error) {
        console.error('[AUTH MIDDLEWARE ERROR]', error.message);
        return res.status(401).json({
            success: false,
            message: 'Sessão inválida ou expirada.'
        });
    }
};

module.exports = authMiddleware;