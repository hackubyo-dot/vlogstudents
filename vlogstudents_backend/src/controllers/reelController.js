/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - REEL CONTENT CONTROLLER
 * Criação, Listagem, Upload para Supabase e Métricas
 * ============================================================================
 */
const db = require('../config/db');
const storageService = require('../services/storageService');
const pointsService = require('../services/pointsService');
const { reelSchema } = require('../utils/validators');

class ReelController {
    /**
     * @route   POST /api/v1/reels/create
     * @desc    Upload de vídeo para Supabase e registro no Neon
     */
    async create(req, res) {
        const client = await db.getClient();
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'O arquivo de vídeo não foi detectado pelo motor multer.' });
            }

            // 1. Validação de dados textuais
            const validatedData = reelSchema.parse(req.body);
            const { title, description, duration } = validatedData;

            await client.query('BEGIN');

            // 2. Upload Binário para o Supabase Storage (Bucket: vlogstudents_media)
            console.log(`[STORAGE] Iniciando upload de vídeo: ${req.file.originalname}`);
            const upload = await storageService.uploadFile(req.file, 'reels');
            
            if (!upload.url) {
                throw new Error('Falha ao obter URL pública do Supabase Storage.');
            }

            // 3. Persistência no Neon (PostgreSQL)
            const reelResult = await client.query(
                `INSERT INTO reels (author_id, drive_file_id, title, description, duration)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [req.user.id, upload.url, title, description, parseInt(duration || 0)]
            );

            const newReel = reelResult.rows[0];

            // 4. Sistema de Recompensa: +75 pontos por postar conteúdo relevante
            await pointsService.addPointsTransactional(client, req.user.id, 75, 'Publicação de novo Reel no Campus', newReel.id);

            await client.query('COMMIT');

            return res.status(201).json({
                success: true,
                message: 'Conteúdo publicado com sucesso.',
                data: newReel
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[REEL_CREATE_FATAL]', error);
            
            // Tratamento de erros específicos de validação Zod
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, message: error.errors[0].message });
            }

            return res.status(500).json({ success: false, message: 'Erro ao processar publicação do vídeo.' });
        } finally {
            client.release();
        }
    }

    /**
     * @route   GET /api/v1/reels
     * @desc    Feed Principal paginado com dados de autor e likes
     */
    async getFeed(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            const result = await db.query(
                `SELECT r.*, 
                u.full_name as author_name, 
                u.avatar_url as author_picture, 
                u.university_name as author_university,
                (SELECT COUNT(*) FROM likes WHERE reel_id = r.id) as likes_count,
                (SELECT COUNT(*) FROM comments WHERE reel_id = r.id) as comments_count,
                EXISTS(SELECT 1 FROM likes WHERE reel_id = r.id AND user_id = $1) as is_liked
                FROM reels r
                JOIN users u ON r.author_id = u.id
                WHERE r.is_active = true
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3`,
                [req.user.id, limit, offset]
            );

            return res.json({
                success: true,
                count: result.rowCount,
                page,
                data: result.rows
            });
        } catch (error) {
            console.error('[REEL_FEED_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Erro ao sincronizar feed acadêmico.' });
        }
    }

    /**
     * @route   GET /api/v1/reels/:id
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const result = await db.query(
                `SELECT r.*, u.full_name as author_name, u.avatar_url as author_picture
                 FROM reels r JOIN users u ON r.author_id = u.id
                 WHERE r.id = $1`, [id]
            );

            if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Conteúdo não localizado.' });

            return res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Erro ao buscar detalhes do reel.' });
        }
    }

    /**
     * @route   POST /api/v1/reels/:id/view
     */
    async trackView(req, res) {
        try {
            const { id } = req.params;
            await db.query('UPDATE reels SET views_count = views_count + 1 WHERE id = $1', [id]);
            
            // Opcional: Dar 1 ponto ao autor por visualização (limite diário recomendado)
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ success: false });
        }
    }

    /**
     * @route   DELETE /api/v1/reels/delete/:id
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const result = await db.query('DELETE FROM reels WHERE id = $1 AND author_id = $2 RETURNING id', [id, req.user.id]);

            if (result.rowCount === 0) {
                return res.status(403).json({ success: false, message: 'Operação negada ou conteúdo inexistente.' });
            }

            return res.json({ success: true, message: 'Conteúdo removido permanentemente.' });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Erro ao remover reel.' });
        }
    }
}

module.exports = new ReelController();
