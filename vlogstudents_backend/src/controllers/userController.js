/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - USER CONTROLLER v5.0.0 (FINAL STABLE)
 * PROFILE | AVATAR | METRICS | SEARCH | ACCOUNT MANAGEMENT
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');

class UserController {

    /**
     * =========================================================================
     * 👤 GET /api/v1/users/me
     * =========================================================================
     */
    async getMe(req, res) {
        try {
            const result = await db.query(
                `SELECT 
                    id,
                    full_name,
                    email,
                    avatar_url,
                    university_name,
                    referral_code,
                    points_total,
                    theme_pref,
                    biography,
                    phone_number,
                    created_at
                 FROM users 
                 WHERE id = $1`,
                [req.user.id]
            );

            return res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[USER_GETME_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar perfil.'
            });
        }
    }

    /**
     * =========================================================================
     * 📊 GET /api/v1/users/social/metrics/:userId
     * =========================================================================
     */
    async getSocialMetrics(req, res) {
        try {
            let userId = req.params.userId === 'me'
                ? req.user.id
                : req.params.userId;

            const result = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM follows WHERE following_id = $1) AS followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = $1) AS following_count,
                    (SELECT COUNT(*) FROM reels WHERE author_id = $1) AS posts_count
                FROM users WHERE id = $1
            `, [userId]);

            return res.json({
                success: true,
                data: result.rows[0] || {
                    followers_count: 0,
                    following_count: 0,
                    posts_count: 0
                }
            });

        } catch (error) {
            console.error('[USER_METRICS_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao carregar métricas.'
            });
        }
    }

    /**
     * =========================================================================
     * 🔍 GET /api/v1/users/search?q=
     * =========================================================================
     */
    async searchUsers(req, res) {
        try {
            const q = req.query.q || '';

            // evita query pesada
            if (!q.trim()) {
                return res.json({
                    success: true,
                    data: []
                });
            }

            const result = await db.query(
                `SELECT 
                    id,
                    full_name,
                    email,
                    avatar_url,
                    university_name
                 FROM users 
                 WHERE 
                    (full_name ILIKE $1 OR email ILIKE $1)
                    AND isactive = true
                 ORDER BY full_name ASC
                 LIMIT 20`,
                [`%${q}%`]
            );

            return res.json({
                success: true,
                data: result.rows
            });

        } catch (error) {
            console.error('[USER_SEARCH_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao buscar usuários.'
            });
        }
    }

    /**
     * =========================================================================
     * ✏️ PATCH /api/v1/users/update
     * =========================================================================
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
                WHERE id = $6
                RETURNING 
                    id,
                    full_name,
                    email,
                    avatar_url,
                    university_name,
                    referral_code,
                    points_total,
                    theme_pref,
                    biography,
                    phone_number`,
                [fullName, university, phone, bio, theme_config, req.user.id]
            );

            return res.json({
                success: true,
                message: 'Perfil atualizado com sucesso.',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('[USER_UPDATE_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao atualizar perfil.'
            });
        }
    }

    /**
     * =========================================================================
     * 🖼 POST /api/v1/users/profile/avatar
     * =========================================================================
     */
    async updateAvatar(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Nenhuma imagem enviada.'
                });
            }

            console.log(`[USER_AVATAR] Upload iniciado → User ${req.user.id}`);

            const upload = await storageService.uploadFile(req.file, 'avatars');

            if (!upload || !upload.url) {
                throw new Error('Falha ao obter URL do avatar.');
            }

            const result = await db.query(
                `UPDATE users 
                 SET avatar_url = $1, updated_at = NOW() 
                 WHERE id = $2 
                 RETURNING avatar_url`,
                [upload.url, req.user.id]
            );

            return res.json({
                success: true,
                message: 'Avatar atualizado com sucesso.',
                avatar_url: result.rows[0].avatar_url
            });

        } catch (error) {
            console.error('[USER_AVATAR_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao atualizar avatar.'
            });
        }
    }

    /**
     * =========================================================================
     * 🗑 DELETE /api/v1/users/delete
     * =========================================================================
     */
    async deleteAccount(req, res) {
        try {
            await db.query(
                `UPDATE users 
                 SET isactive = false, updated_at = NOW() 
                 WHERE id = $1`,
                [req.user.id]
            );

            return res.json({
                success: true,
                message: 'Conta desativada com sucesso.'
            });

        } catch (error) {
            console.error('[USER_DELETE_ERROR]', error);

            return res.status(500).json({
                success: false,
                message: 'Erro ao desativar conta.'
            });
        }
    }
}

module.exports = new UserController();
