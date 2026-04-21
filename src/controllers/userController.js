/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v4.2.0
 * GESTÃO DE IDENTIDADE, VOICES E ECONOMIA ACADÊMICA
 * STATUS: FULL RECONSTRUCTION - ZERO OMISSION
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const userController = {

    /**
     * Retorna o perfil completo do usuário logado (Sincronizado com Mobile)
     */
    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    id as user_identification, 
                    email as user_email_address,
                    full_name as user_full_name, 
                    avatar_url as user_profile_picture_url,
                    university_name as user_university_name, 
                    referral_code as user_referral_code,
                    points_total as user_points_balance, 
                    theme_pref as user_theme_config,
                    phone_number as user_phone_number, 
                    biography as user_biography_text,
                    "isActive" as user_account_status, 
                    created_at as user_created_at_timestamp
                FROM users 
                WHERE id = $1
            `;
            const result = await db.query(query, [userId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não localizado no Kernel.' });
            }
            
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[USER_ERROR] getMyProfile:', error);
            res.status(500).json({ success: false, message: 'Erro interno ao recuperar perfil.' });
        }
    },

    /**
     * Recupera perfil público de outro estudante (Social View)
     */
    getUserProfile: async (req, res) => {
        const targetId = req.params.id;
        try {
            const query = `
                SELECT id, full_name, avatar_url, university_name, biography 
                FROM users 
                WHERE id = $1
            `;
            const result = await db.query(query, [targetId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Perfil não encontrado.' });
            }
            
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[USER_ERROR] getUserProfile:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Atualização de Dados de Perfil (Update Master)
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
                WHERE id = $5 
                RETURNING id, full_name, university_name, phone_number, biography
            `;
            const result = await db.query(query, [fullName, university, phone, bio, userId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[USER_ERROR] updateProfile:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Sincronização de Configurações Visuais (Tema)
     */
    updateSettings: async (req, res) => {
        const userId = req.user.id;
        const { theme_config } = req.body;
        try {
            await db.query('UPDATE users SET theme_pref = $1 WHERE id = $2', [theme_config, userId]);
            res.status(200).json({ success: true, message: 'Configurações sincronizadas com o Kernel.' });
        } catch (error) {
            console.error('[USER_ERROR] updateSettings:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Gestão de Avatar via Google Drive Service
     */
    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Arquivo não detectado para upload.' });
        }

        try {
            // Upload para o Drive e captura do ID público
            const driveId = await driveService.uploadFile(req.file, `AVATAR_UID_${userId}`);
            
            // Atualiza a URL (ID do Drive) no banco de dados
            await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [driveId, userId]);
            
            res.status(200).json({ success: true, data: { imageUrl: driveId } });
        } catch (error) {
            console.error('[USER_ERROR] uploadAvatar:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    /**
     * Retorna o saldo atual de pontos (Economia Acadêmica)
     */
    getPointsBalance: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [userId]);
            res.status(200).json({ 
                success: true, 
                balance: result.rows[0]?.points_total || 0 
            });
        } catch (error) {
            console.error('[USER_ERROR] getPointsBalance:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Histórico de Transações de Pontos
     */
    getPointsHistory: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    id as point_transaction_identification, 
                    amount as point_amount_value, 
                    reason as point_reason_description, 
                    created_at as point_created_at_timestamp
                FROM point_transactions 
                WHERE user_id = $1 
                ORDER BY created_at DESC 
                LIMIT 50
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            console.error('[USER_ERROR] getPointsHistory:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Métricas Sociais (Seguidores, Seguindo, Posts)
     */
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
            console.error('[USER_ERROR] getSocialMetrics:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Estatísticas de Indicação (Referral System)
     */
    getReferralStats: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_invites, 
                    COALESCE(SUM(amount), 0) as total_earned 
                FROM point_transactions 
                WHERE user_id = $1 AND reason = 'USER_REFERRAL'
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[USER_ERROR] getReferralStats:', error);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Interface de Resgate (Placeholder para futuras integrações)
     */
    redeemPoints: async (req, res) => {
        res.status(200).json({ success: true, message: 'Sistema de resgate Alfa Omega pronto.' });
    }
};

module.exports = userController;
