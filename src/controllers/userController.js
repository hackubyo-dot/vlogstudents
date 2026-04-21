/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v2.0.2
 * GESTÃO DE IDENTIDADE ACADÊMICA, VOICES (POINTS) E SOCIAL INTELLIGENCE
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const userController = {

    /**
     * Recupera o perfil completo do estudante logado
     * Sincronizado com a classe VlogUser do Flutter
     */
    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        
        try {
            console.log(`[USER_QUERY] Protocolo de busca iniciado para UID: ${userId}`);
            
            const query = `
                SELECT 
                    u.id as user_identification,
                    u.email as user_email_address,
                    u.full_name as user_full_name,
                    u.avatar_url as user_profile_picture_url,
                    u.university_name as user_university_name,
                    u.referral_code as user_referral_code,
                    u.points_total as user_points_balance,
                    u.theme_pref as user_theme_config,
                    u.phone_number as user_phone_number,
                    u.biography as user_biography_text,
                    u.isActive as user_account_status,
                    u.created_at as user_created_at_timestamp,
                    u.updated_at as user_updated_at_timestamp
                FROM users u
                WHERE u.id = $1
            `;

            const result = await db.query(query, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Registro acadêmico não localizado no Master Node.' 
                });
            }

            const profile = result.rows[0];

            res.status(200).json({
                success: true,
                message: 'Perfil sincronizado.',
                data: profile
            });

        } catch (error) {
            console.error('[USER_CONTROLLER_ERROR] getMyProfile:', error.stack);
            res.status(500).json({ 
                success: false, 
                message: 'Falha ao processar requisição de perfil no Kernel.' 
            });
        }
    },

    /**
     * Recupera perfil de outro estudante (Social View)
     */
    getUserProfile: async (req, res) => {
        const targetId = req.params.id;
        const myId = req.user.id;

        try {
            const query = `
                SELECT 
                    u.id as user_identification,
                    u.full_name as user_full_name,
                    u.avatar_url as user_profile_picture_url,
                    u.university_name as user_university_name,
                    u.biography as user_biography_text,
                    u.points_total as user_points_balance,
                    (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
                    EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
                FROM users u
                WHERE u.id = $2
            `;

            const result = await db.query(query, [myId, targetId]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Estudante não encontrado.' });
            }

            res.status(200).json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Upload de Avatar sincronizado com Google Drive V3
     * Resolve o erro de "Google Cloud link broken" via permissões automáticas
     */
    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: 'Binário de imagem não detectado.' });
        }

        try {
            console.log(`[USER_STORAGE] Iniciando troca de avatar para o aluno UID: ${userId}`);

            // 1. Transmissão para o Google Drive Cluster
            const driveFileId = await driveService.uploadFile(file, `AVATAR_ACADEMIC_UID_${userId}`);

            // 2. Atualização Atômica no Neon PostgreSQL
            const updateQuery = `
                UPDATE users 
                SET avatar_url = $1, updated_at = NOW() 
                WHERE id = $2 
                RETURNING avatar_url
            `;
            await db.query(updateQuery, [driveFileId, userId]);

            // 3. Notificação Realtime (Uso do req.app.get para evitar MODULE_NOT_FOUND)
            const io = req.app.get('io');
            if (io) {
                io.to(`user_${userId}`).emit('identity_sync', { 
                    type: 'AVATAR_UPDATE', 
                    newUrl: driveFileId 
                });
            }

            res.status(200).json({
                success: true,
                message: 'Identidade visual atualizada com sucesso.',
                data: { imageUrl: driveFileId }
            });

        } catch (error) {
            console.error('[USER_UPLOAD_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Falha crítica no cluster de armazenamento.' });
        }
    },

    /**
     * Atualização de Dados Cadastrais e Biografia
     */
    updateProfile: async (req, res) => {
        const userId = req.user.id;
        const { fullName, university, phone, bio } = req.body;

        try {
            console.log(`[USER_UPDATE] Sincronizando dados para UID: ${userId}`);

            const updateQuery = `
                UPDATE users 
                SET 
                    full_name = COALESCE($1, full_name),
                    university_name = COALESCE($2, university_name),
                    phone_number = COALESCE($3, phone_number),
                    biography = COALESCE($4, biography),
                    updated_at = NOW()
                WHERE id = $5
                RETURNING *
            `;

            const values = [
                fullName ? fullName.trim() : null, 
                university ? university.trim() : null, 
                phone ? phone.trim() : null, 
                bio ? bio.trim() : null, 
                userId
            ];

            const result = await db.query(updateQuery, values);

            res.status(200).json({
                success: true,
                message: 'Dados acadêmicos sincronizados.',
                data: {
                    user_identification: result.rows[0].id,
                    user_full_name: result.rows[0].full_name,
                    user_university_name: result.rows[0].university_name,
                    user_biography_text: result.rows[0].biography,
                    user_phone_number: result.rows[0].phone_number
                }
            });

        } catch (error) {
            console.error('[USER_UPDATE_ERROR]', error.stack);
            res.status(500).json({ success: false, message: 'Erro ao persistir alterações no Neon.' });
        }
    },

    /**
     * Social Metrics Engine (Followers, Following, Posts)
     */
    getSocialMetrics: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following,
                    (SELECT COUNT(*) FROM reels WHERE author_id = $1 AND is_active = true) as posts
            `;
            const result = await db.query(query, [userId]);
            
            res.status(200).json({
                success: true,
                data: {
                    followers: parseInt(result.rows[0].followers) || 0,
                    following: parseInt(result.rows[0].following) || 0,
                    posts: parseInt(result.rows[0].posts) || 0
                }
            });
        } catch (error) {
            console.error('[METRICS_ERROR]', error.message);
            res.status(500).json({ success: false });
        }
    },

    /**
     * Gerenciamento de Voices (Points) e Carteira
     */
    getPointsBalance: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [userId]);
            res.status(200).json({
                success: true,
                balance: result.rows[0].points_total || 0
            });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    getPointsHistory: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    id as point_transaction_identification,
                    amount as point_amount_value,
                    reason as point_reason_description,
                    reference_id as point_reference_id,
                    created_at as point_created_at_timestamp
                FROM point_transactions
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 50
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    /**
     * Sistema de Referral (Convites e Recompensas)
     */
    getReferralStats: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT 
                    COUNT(id) as total_invites,
                    COALESCE(SUM(amount), 0) as total_earned
                FROM point_transactions
                WHERE user_id = $1 AND reason = 'USER_REFERRAL'
            `;
            const result = await db.query(query, [userId]);
            res.status(200).json({
                success: true,
                data: {
                    total_invites: parseInt(result.rows[0].total_invites),
                    total_earned: parseInt(result.rows[0].total_earned)
                }
            });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    }
};

module.exports = userController;
