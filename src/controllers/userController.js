/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v8.5.0
 * ORQUESTRADOR DE IDENTIDADE, VOICES E PROXY DE MÍDIA
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const userController = {

    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT id as user_identification, email as user_email_address,
                       full_name as user_full_name, avatar_url as user_profile_picture_url,
                       university_name as user_university_name, referral_code as user_referral_code,
                       points_total as user_points_balance, theme_pref as user_theme_config,
                       phone_number as user_phone_number, biography as user_biography_text,
                       isactive as user_account_status, created_at as user_created_at_timestamp
                FROM users WHERE id = $1
            `;
            const result = await db.query(query, [userId]);
            return res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Erro na query de perfil.' });
        }
    },

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
            return res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    updateSettings: async (req, res) => {
        const userId = req.user.id;
        const { theme_config } = req.body;
        try {
            await db.query('UPDATE users SET theme_pref = $1 WHERE id = $2', [theme_config, userId]);
            return res.status(200).json({ success: true, message: 'Settings synced.' });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    uploadAvatar: async (req, res) => {
        const userId = req.user.id;
        if (!req.file) return res.status(400).json({ success: false, message: 'No file.' });
        try {
            const driveId = await driveService.uploadFile(req.file, `AVATAR_${userId}`);
            await db.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [driveId, userId]);
            return res.status(200).json({ success: true, data: { imageUrl: driveId } });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    },

    getPointsBalance: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [userId]);
            return res.status(200).json({ success: true, balance: result.rows[0].points_total });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    getPointsHistory: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT id as point_transaction_identification, amount as point_amount_value, 
                       reason as point_reason_description, created_at as point_created_at_timestamp
                FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
            `;
            const result = await db.query(query, [userId]);
            return res.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    getSocialMetrics: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `
                SELECT (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers,
                       (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following,
                       (SELECT COUNT(*) FROM reels WHERE author_id = $1) as posts
            `;
            const result = await db.query(query, [userId]);
            return res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    redeemPoints: async (req, res) => {
        return res.status(200).json({ success: true, message: 'Processador de resgate ativo.' });
    },

    getReferralStats: async (req, res) => {
        const userId = req.user.id;
        try {
            const result = await db.query(`
                SELECT COUNT(*) as total_invites, 
                       COALESCE(SUM(amount), 0) as total_earned 
                FROM point_transactions WHERE user_id = $1 AND reason = 'USER_REFERRAL'`, [userId]);
            return res.status(200).json({ success: true, data: { total_invites: parseInt(result.rows[0].total_invites), total_earned: parseInt(result.rows[0].total_earned) } });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    getUserProfile: async (req, res) => {
        const targetId = req.params.id;
        try {
            const query = `SELECT id, full_name, avatar_url, university_name, biography FROM users WHERE id = $1`;
            const result = await db.query(query, [targetId]);
            return res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    },

    streamMedia: async (req, res) => {
        const { fileId } = req.params;
        const range = req.headers.range;
        try {
            const metadata = await driveService.getFileMetadata(fileId);
            if (!metadata) return res.status(404).send('Not found');
            const fileSize = parseInt(metadata.size);
            const driveStream = await driveService.getVideoStream(fileId);
            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': (end - start) + 1,
                    'Content-Type': metadata.mimeType
                });
                driveStream.data.pipe(res);
            } else {
                res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': metadata.mimeType });
                driveStream.data.pipe(res);
            }
        } catch (error) {
            if (!res.headersSent) res.status(500).send('Stream error');
        }
    }
};

module.exports = userController;
