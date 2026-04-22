const db = require('../config/db');
const storageService = require('../services/storageService');

class UserController {
    /**
     * GET /users/me
     */
    async getMe(req, res) {
        try {
            const result = await db.query(
                `SELECT id, full_name, email, avatar_url, university_name, referral_code,
                points_total, theme_pref, biography, phone_number, created_at
                FROM users WHERE id = $1`,
                [req.user.id]
            );
            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao buscar perfil.' });
        }
    }

    /**
     * PATCH /users/update
     */
    async updateProfile(req, res) {
        try {
            const { fullName, university, phone, bio, theme_config } = req.body;

            const result = await db.query(
                `UPDATE users SET
                    full_name = COALESCE($1, full_name),
                    university_name = COALESCE($2, university_name),
                    phone_number = COALESCE($3, phone_number),
                    biography = COALESCE($4, biography),
                    theme_pref = COALESCE($5, theme_pref),
                    updated_at = NOW()
                WHERE id = $6 RETURNING id, full_name, email, avatar_url, university_name, referral_code, points_total, theme_pref, biography, phone_number`,
                [fullName, university, phone, bio, theme_config, req.user.id]
            );

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao atualizar perfil.' });
        }
    }

    /**
     * POST /users/profile/avatar
     */
    async updateAvatar(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });

            // 1. Upload para Supabase
            const upload = await storageService.uploadFile(req.file, 'avatars');

            // 2. Atualiza banco
            await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [upload.url, req.user.id]);

            res.json({ success: true, avatar_url: upload.url });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro no upload do avatar.' });
        }
    }

    /**
     * DELETE /users/delete
     */
    async deleteAccount(req, res) {
        try {
            // Soft delete para auditoria
            await db.query('UPDATE users SET isactive = false WHERE id = $1', [req.user.id]);
            res.json({ success: true, message: 'Conta desativada com sucesso.' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro ao deletar conta.' });
        }
    }
}

module.exports = new UserController();