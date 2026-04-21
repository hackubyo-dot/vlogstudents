/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v2.0.4
 * GESTÃO DE IDENTIDADE ACADÊMICA E CONFIGURAÇÕES VISUAIS
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const userController = {

    /**
     * Retorna o perfil completo do usuário logado
     */
    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT u.id as user_identification, u.email as user_email_address,
                       u.full_name as user_full_name, u.avatar_url as user_profile_picture_url,
                       u.university_name as user_university_name, u.referral_code as user_referral_code,
                       u.points_total as user_points_balance, u.theme_pref as user_theme_config,
                       u.phone_number as user_phone_number, u.biography as user_biography_text,
                       u.isActive as user_account_status, u.created_at as user_created_at_timestamp
                FROM users u WHERE u.id = $1
            `;
            const result = await db.query(query, [userId]);
            if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Usuário não localizado.' });
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Recupera perfil público de outro estudante
     */
    getUserProfile: async (req, res) => {
        const targetId = req.params.id;
        try {
            const query = `SELECT id, full_name, avatar_url, university_name, biography FROM users WHERE id = $1`;
            const result = await db.query(query, [targetId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Atualização de Dados de Perfil
     */
    updateProfile: async (req, res) => {
        const userId = req.user.id;
        const { fullName, university, phone, bio } = req.body;
        try {
            const query = `
                UPDATE users SET 
                    full_name = COALESCE($1, full_name),
                    university_name = COALESCE($2, university_name),
                    phone_number = COALESCE($3, phone_number),
                    biography = COALESCE($4, biography),
                    updated_at = NOW()
                WHERE id = $5 RETURNING *
            `;
            const result = await db.query(query, [fullName, university, phone, bio, userId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * CORREÇÃO DE ROTA: Função de atualização de configurações visuais
     */
    updateSettings: async (req, res) => {
        const userId = req.user.id;
        const { theme_config } = req.body;
        try {
            await db.query('UPDATE users SET theme_pref = $1 WHERE id = $2', [theme_config, userId]);
            res.status(200).json({ success: true, message: 'Configurações sincronizadas.' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Gestão de Avatar via Google Drive
     */
    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        if (!req.file) return res.status(400).json({ success: false, message: 'Arquivo não enviado.' });

        try {
            const driveId = await driveService.uploadFile(req.file, `AVATAR_${userId}`);
            await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [driveId, userId]);
            res.status(200).json({ success: true, data: { imageUrl: driveId } });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    getSocialMetrics: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following,
                    (SELECT COUNT(*) FROM reels WHERE author_id = $1) as posts
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    getPointsBalance: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [userId]);
            res.status(200).json({ success: true, balance: result.rows[0].points_total });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    getPointsHistory: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `SELECT * FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC`;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    redeemPoints: async (req, res) => {
        res.status(200).json({ success: true, message: 'Resgate habilitado.' });
    },

    getReferralStats: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query('SELECT COUNT(*) as total FROM point_transactions WHERE user_id = $1 AND reason = \'USER_REFERRAL\'', [userId]);
            res.status(200).json({ success: true, data: { total_invites: result.rows[0].total } });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = userController;
