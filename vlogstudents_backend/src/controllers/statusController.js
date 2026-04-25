/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - CAMPUS STATUS CONTROLLER v1.0.0
 * VIDEO | AUDIO | TEXT | LINKS (48H PERSISTENCE)
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');

class StatusController {
    async create(req, res) {
        try {
            const { type, content, backgroundColor } = req.body;
            const userId = req.user.id;
            
            // Define expiração em 48 horas para membros VIP (ou 24h padrão)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48);

            let mediaUrl = null;
            if (req.file) {
                const upload = await storageService.uploadFile(req.file, 'status_media');
                mediaUrl = upload.url;
            }

            const result = await db.query(
                `INSERT INTO campus_statuses (user_id, type, content, media_url, background_color, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [userId, type, content, mediaUrl, backgroundColor, expiresAt]
            );

            return res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            console.error('[STATUS_CREATE_ERROR]', error);
            return res.status(500).json({ success: false, message: 'Falha ao postar status.' });
        }
    }

    async getActive(req, res) {
        try {
            // Busca apenas status que não expiraram
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
