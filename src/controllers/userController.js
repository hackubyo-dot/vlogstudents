/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE MASTER USER CONTROLLER v7.0.0
 * FULL IDENTITY & STREAMING PROXY
 * ============================================================================
 */

const db = require('../config/dbConfig');
const driveService = require('../services/driveService');

const userController = {
    // [getMyProfile, updateProfile, uploadAvatar, etc... Mantidos Conforme Versão 5.5]
    
    getMyProfile: async (req, res) => {
        const userId = req.user.id;
        try {
            const query = `SELECT id as user_identification, email as user_email_address, full_name as user_full_name, avatar_url as user_profile_picture_url, university_name as user_university_name, referral_code as user_referral_code, points_total as user_points_balance, theme_pref as user_theme_config, phone_number as user_phone_number, biography as user_biography_text, isactive as user_account_status, created_at as user_created_at_timestamp FROM users WHERE id = $1`;
            const result = await db.query(query, [userId]);
            res.status(200).json({ success: true, data: result.rows[0] });
        } catch (error) { res.status(500).json({ success: false }); }
    },

    /**
     * STREAMING MASTER (REELS FIX)
     */
    streamMedia: async (req, res) => {
        const { fileId } = req.params;
        const range = req.headers.range;

        try {
            const metadata = await driveService.getFileMetadata(fileId);
            if (!metadata) return res.status(404).json({ message: 'Arquivo não encontrado no Drive.' });

            const fileSize = parseInt(metadata.size);
            const mimeType = metadata.mimeType || 'video/mp4';

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;

                const driveStream = await driveService.getVideoStream(fileId);

                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': mimeType,
                });
                driveStream.data.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': fileSize,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                });
                const driveStream = await driveService.getVideoStream(fileId);
                driveStream.data.pipe(res);
            }
        } catch (error) {
            console.error('[STREAM_ERROR]', error.message);
            if (!res.headersSent) res.status(500).send('Streaming fail');
        }
    },

    getPointsBalance: async (req, res) => {
        try {
            const result = await db.query('SELECT points_total FROM users WHERE id = $1', [req.user.id]);
            res.status(200).json({ success: true, balance: result.rows[0].points_total });
        } catch (e) { res.status(500).json({ success: false }); }
    },

    getPointsHistory: async (req, res) => {
        try {
            const query = `SELECT id as point_transaction_identification, amount as point_amount_value, reason as point_reason_description, created_at as point_created_at_timestamp FROM point_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`;
            const result = await db.query(query, [req.user.id]);
            res.status(200).json({ success: true, data: result.rows });
        } catch (e) { res.status(500).json({ success: false }); }
    }
};

module.exports = userController;
