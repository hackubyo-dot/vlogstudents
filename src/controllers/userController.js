const db = require('../config/db');
const storageService = require('../services/storageService');

class UserController {
    async getMe(req, res, next) {
        try {
            const result = await db.query(
                `SELECT id, full_name, email, avatar_url, university_name, referral_code,
                points_total, theme_pref, biography, phone_number, created_at
                FROM users WHERE id = $1`,
                [req.user.id]
            );
            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req, res, next) {
        try {
            const { fullName, universityName, biography, phoneNumber, themePref } = req.body;

            const result = await db.query(
                `UPDATE users SET
                full_name = COALESCE($1, full_name),
                university_name = COALESCE($2, university_name),
                biography = COALESCE($3, biography),
                phone_number = COALESCE($4, phone_number),
                theme_pref = COALESCE($5, theme_pref),
                updated_at = NOW()
                WHERE id = $6 RETURNING *`,
                [fullName, universityName, biography, phoneNumber, themePref, req.user.id]
            );

            delete result.rows[0].password_hash;
            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            next(error);
        }
    }

    async updateAvatar(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
            }

            // 1. Upload para Supabase
            const { url } = await storageService.uploadFile(req.file, 'avatars');

            // 2. Salvar URL no banco
            await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [url, req.user.id]);

            res.json({ success: true, avatar_url: url });
        } catch (error) {
            next(error);
        }
    }

    async deleteAccount(req, res, next) {
        try {
            // Soft delete para manter integridade de logs
            await db.query('UPDATE users SET isactive = false WHERE id = $1', [req.user.id]);
            res.json({ success: true, message: 'Conta desativada com sucesso.' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();