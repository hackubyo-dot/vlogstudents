const db = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const env = require('../config/env');

class RecoveryController {
    /**
     * POST /auth/recovery/request
     */
    async requestRecovery(req, res) {
        try {
            const { email } = req.body;
            const user = await db.query('SELECT id FROM users WHERE email = $1', [email]);

            if (user.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'E-mail não encontrado.' });
            }

            // Gerar token de 6 dígitos ou hash (usaremos 6 dígitos para mobile UX)
            const token = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date(Date.now() + 3600000); // 1 hora

            await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = $2 WHERE email = $3',
                [token, expires, email]
            );

            // Em produção, aqui enviaria um e-mail. No log para teste:
            console.log(`[RECOVERY] Token para ${email}: ${token}`);

            res.json({ success: true, message: 'Código de recuperação enviado ao e-mail.' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao solicitar recuperação.' });
        }
    }

    /**
     * POST /auth/recovery/reset
     */
    async resetPassword(req, res) {
        try {
            const { email, token, newPassword } = req.body;

            const result = await db.query(
                'SELECT id FROM users WHERE email = $1 AND recovery_token = $2 AND recovery_expires > NOW()',
                [email, token]
            );

            if (result.rowCount === 0) {
                return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
            }

            const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await db.query(
                'UPDATE users SET password_hash = $1, recovery_token = NULL, recovery_expires = NULL WHERE email = $2',
                [hashedPassword, email]
            );

            res.json({ success: true, message: 'Senha alterada com sucesso.' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao redefinir senha.' });
        }
    }
}

module.exports = new RecoveryController();