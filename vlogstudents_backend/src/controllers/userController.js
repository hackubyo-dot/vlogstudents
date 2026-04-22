/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - USER & PROFILE CONTROLLER
 * Gestão de Dados Pessoais, Identidade Acadêmica e Biometria
 * ============================================================================
 */
const db = require('../config/db');
const storageService = require('../services/storageService');

class UserController {
    /**
     * @route   GET /api/v1/users/me
     * @desc    Retorna o perfil completo do usuário autenticado
     */
    async getMe(req, res) {
        try {
            const result = await db.query(
                `SELECT id, full_name, email, avatar_url, university_name, referral_code, 
                 points_total, theme_pref, biography, phone_number, created_at 
                 FROM users WHERE id = $1`,
                [req.user.id]
            );
            
            return res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error('[USER_GETME_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Falha ao buscar dados do perfil.' });
        }
    }

    /**
     * @route   PATCH /api/v1/users/update
     * @desc    Atualiza metadados do estudante (Bio, Telefone, Universidade)
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

            return res.json({
                success: true,
                message: 'Perfil acadêmico atualizado com sucesso.',
                data: result.rows[0]
            });
        } catch (error) {
            console.error('[USER_UPDATE_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao atualizar metadados do usuário.' });
        }
    }

    /**
     * @route   POST /api/v1/users/profile/avatar
     * @desc    Upload e atualização de foto de perfil (Supabase Storage)
     */
    async updateAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Nenhuma imagem foi detectada.' });
            }

            // 1. Processamento de Upload na Nuvem
            const upload = await storageService.uploadFile(req.file, 'avatars');

            // 2. Sincronização com o Banco de Dados Neon
            const updateResult = await db.query(
                'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_url',
                [upload.url, req.user.id]
            );

            return res.json({
                success: true,
                message: 'Avatar atualizado com sucesso.',
                avatar_url: updateResult.rows[0].avatar_url
            });
        } catch (error) {
            console.error('[USER_AVATAR_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao processar imagem de perfil.' });
        }
    }

    /**
     * @route   DELETE /api/v1/users/delete
     * @desc    Desativação permanente da conta (Soft Delete)
     */
    async deleteAccount(req, res) {
        try {
            await db.query('UPDATE users SET isactive = false, updated_at = NOW() WHERE id = $1', [req.user.id]);
            
            return res.json({
                success: true,
                message: 'Sua conta universitária foi desativada e seus dados foram anonimizados.'
            });
        } catch (error) {
            console.error('[USER_DELETE_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Erro ao processar encerramento de conta.' });
        }
    }
}

module.exports = new UserController();
