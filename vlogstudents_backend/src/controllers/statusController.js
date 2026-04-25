/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - STATUS CONTROLLER v3.0.0 (ULTIMATE STABLE)
 * MUTUAL FOLLOWERS | BINARY UPLOADS | VIEW TRACKING | ZOD VALIDATION
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo e Resiliência:
 * - Privacy Shield: Apenas contatos com seguimento mútuo visualizam Stories.
 * - Anti-Stall Upload: Processamento binário direto para 'campus_status'.
 * - Dynamic Expiry: Ciclo de vida estendido para 48 horas acadêmicas.
 * - Telemetry Engine: Rastreamento atômico de visualizações único por usuário.
 * - Transactional Integrity: Garantia de persistência total no Neon DB.
 * ============================================================================
 */

const db = require('../config/db');
const storageService = require('../services/storageService');
const { statusSchema } = require('../utils/validators');

class StatusController {

    /**
     * =========================================================================
     * 🚀 CREATE STATUS (CAMPUS STORIES)
     * =========================================================================
     */
    async create(req, res) {
        const client = await db.getClient();
        try {
            // 1. Validação de Esquema Master (Zod)
            const validated = statusSchema.parse(req.body);
            const { type, content, backgroundColor } = validated;
            const userId = req.user.id;
            
            // 2. Vida útil de 48 horas conforme requisitos Enterprise
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

            await client.query('BEGIN');

            let mediaUrl = null;
            if (req.file) {
                // Log de auditoria industrial para monitoramento de tráfego
                console.log(`[STATUS_UPLOAD] Processando arquivo ${req.file.mimetype} para status ${type}`);
                
                // Upload binário para o bucket 'campus_status' no Supabase
                const upload = await storageService.uploadFile(req.file, 'campus_status');
                mediaUrl = upload.url;
            }

            // 3. Persistência Atômica no Neon DB
            const result = await client.query(
                `INSERT INTO campus_statuses (user_id, type, content, media_url, background_color, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 RETURNING *`,
                [
                    userId, 
                    type, 
                    content || "", 
                    mediaUrl, 
                    backgroundColor || "#000000", 
                    expiresAt
                ]
            );

            await client.query('COMMIT');

            return res.status(201).json({ 
                success: true, 
                message: 'Status publicado com sucesso no campus.',
                data: result.rows[0] 
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[STATUS_CREATE_ERROR]', error.message);

            return res.status(error.name === 'ZodError' ? 400 : 500).json({ 
                success: false, 
                message: error.name === 'ZodError' ? 'Dados do status inválidos.' : 'Erro ao processar status no servidor.' 
            });
        } finally { 
            client.release(); 
        }
    }

    /**
     * =========================================================================
     * 📥 GET ACTIVE STATUS (MUTUAL FOLLOW & PRIVACY)
     * =========================================================================
     */
    async getActive(req, res) {
        try {
            const myId = req.user.id;

            // QUERY MASTER: Filtra status ativos por lógica de networking real (seguimento mútuo)
            const result = await db.query(
                `SELECT 
                    s.*, 
                    u.full_name, 
                    u.avatar_url,
                    -- Contador de visualizações reais integrado
                    (SELECT COUNT(*) FROM status_views WHERE status_id = s.id) as views_count
                 FROM campus_statuses s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.expires_at > NOW()
                 AND (
                    -- Regra 1: Meus próprios status sempre aparecem para mim
                    s.user_id = $1 
                    OR s.user_id IN (
                        -- Regra 2: Status de contatos mútuos (A segue B E B segue A)
                        SELECT f1.following_id 
                        FROM follows f1
                        INNER JOIN follows f2 ON f1.following_id = f2.follower_id
                        WHERE f1.follower_id = $1 AND f2.following_id = $1
                    )
                 )
                 ORDER BY s.created_at DESC`,
                [myId]
            );

            return res.json({ 
                success: true, 
                count: result.rowCount,
                data: result.rows 
            });

        } catch (error) {
            console.error('[STATUS_GET_ERROR] Falha na consulta de status:', error.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao carregar o Campus Board.' 
            });
        }
    }

    /**
     * =========================================================================
     * 👁️ TRACK VIEW (TELEMETRIA ATÔMICA)
     * =========================================================================
     */
    async trackView(req, res) {
        try {
            const { statusId } = req.params;
            const viewerId = req.user.id;

            // Registro de visualização com proteção contra duplicidade
            await db.query(
                `INSERT INTO status_views (status_id, viewer_id) 
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [statusId, viewerId]
            );

            return res.json({ 
                success: true,
                message: 'Visualização registrada.' 
            });

        } catch (e) { 
            console.error('[STATUS_VIEW_TRACK_ERR]', e.message);
            return res.status(500).json({ 
                success: false 
            }); 
        }
    }

    /**
     * =========================================================================
     * 🗑️ DELETE STATUS
     * =========================================================================
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await db.query(
                'DELETE FROM campus_statuses WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rowCount === 0) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Não autorizado ou status expirado.' 
                });
            }

            return res.json({ 
                success: true, 
                message: 'Status removido com sucesso.' 
            });

        } catch (error) {
            console.error('[STATUS_DELETE_ERR]', error.message);
            return res.status(500).json({ success: false });
        }
    }
}

module.exports = new StatusController();
