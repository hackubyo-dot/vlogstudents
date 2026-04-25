const db = require('../config/db');
const storageService = require('../services/storageService');
const { statusSchema } = require('../utils/validators');

class StatusController {
    async create(req, res) {
        const client = await db.getClient();
        try {
            const validated = statusSchema.parse(req.body);
            const { type, content, backgroundColor } = validated;
            const userId = req.user.id;
            
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48);

            await client.query('BEGIN');

            let mediaUrl = null;
            if (req.file) {
                const folder = type === 'video' ? 'status_videos' : 'status_images';
                const upload = await storageService.uploadFile(req.file, folder);
                mediaUrl = upload.url;
            }

            const result = await client.query(
                `INSERT INTO campus_statuses (user_id, type, content, media_url, background_color, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [userId, type, content || "", mediaUrl, backgroundColor || "#000000", expiresAt]
            );

            await client.query('COMMIT');
            return res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[STATUS_ERROR]', error);
            return res.status(400).json({ success: false, message: 'Falha ao criar status.' });
        } finally { client.release(); }
    }

    async getActive(req, res) {
        try {
            const result = await db.query(
                `SELECT s.*, u.full_name, u.avatar_url 
                 FROM campus_statuses s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.expires_at > NOW()
                 ORDER BY s.created_at DESC`
            );
            return res.json({ success: true, data: result.rows });
        } catch (e) { return res.status(500).json({ success: false }); }
    }
}
module.exports = new StatusController();
