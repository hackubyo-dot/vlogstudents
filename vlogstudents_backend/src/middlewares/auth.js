const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Acesso negado. Token não fornecido.'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, env.JWT_SECRET);

        // Verifica se o usuário existe e está ativo
        const userResult = await db.query(
            'SELECT id, email, full_name, isactive FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rowCount === 0) {
            return res.status(401).json({ success: false, message: 'Usuário inexistente.' });
        }

        const user = userResult.rows[0];
        if (!user.isactive) {
            return res.status(403).json({ success: false, message: 'Esta conta foi suspensa ou desativada.' });
        }

        // Injeta o usuário na requisição para uso nos controllers
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Sessão expirada ou token inválido.'
        });
    }
};

module.exports = authMiddleware;