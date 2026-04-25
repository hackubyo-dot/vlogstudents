/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - STATUS CONTROLLER v4.0.0 (ULTIMATE MASTER)
 * MUTUAL FOLLOWERS | BINARY UPLOADS | VIEW AUDIT | ZOD VALIDATION
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Engenharia de Fluxo:
 * - Privacy Shield: Apenas contatos com networking real (seguimento mútuo) acessam Stories.
 * - View Audit: Endpoint seguro para o dono consultar a lista de visualizadores.
 * - Binary Pipeline: Processamento industrial de mídias para o bucket 'campus_status'.
 * - Dynamic Expiry: Ciclo de vida rigoroso de 48 horas acadêmicas.
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
            // 1. Validação de Esquema via Zod
            const validated = statusSchema.parse(req.body);
            const { type, content, backgroundColor } = validated;
            const userId = req.user.id;
            
            // 2. Configuração de expiração (48 Horas)
            const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

            await client.query('BEGIN');

            let mediaUrl = null;
            if (req.file) {
                console.log(`[STATUS_UPLOAD] Binário detectado: ${req.file.mimetype} para tipo ${type}`);
                
                // Upload para o Supabase Storage
                const upload = await storageService.uploadFile(req.file, 'campus_status');
                mediaUrl = upload.url;
            }

            // 3. Inserção no Neon DB
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
                message: 'Status transmitido para o campus.',
                data: result.rows[0] 
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[STATUS_CREATE_ERROR]', error.message);

            return res.status(error.name === 'ZodError' ? 400 : 500).json({ 
                success: false, 
                message: error.name === 'ZodError' ? 'Dados do status inválidos.' : 'Falha ao processar status no servidor.' 
            });
        } finally { 
            client.release(); 
        }
    }

    /**
     * =========================================================================
     * 📥 GET ACTIVE STATUS (NETWORKING LOGIC)
     * =========================================================================
     */
    async getActive(req, res) {
        try {
            const myId = req.user.id;

            // QUERY MASTER: Filtra por status ativos de amigos mútuos e do próprio usuário
            const result = await db.query(
                `SELECT 
                    s.*, 
                    u.full_name, 
                    u.avatar_url,
                    (SELECT COUNT(*) FROM status_views WHERE status_id = s.id) as views_count
                 FROM campus_statuses s
                 JOIN users u ON s.user_id = u.id
                 WHERE s.expires_at > NOW()
                 AND (
                    s.user_id = $1 
                    OR s.user_id IN (
                        -- Subquery de Mutual Follow (A segue B e B segue A)
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
            console.error('[STATUS_GET_ERROR]', error.message);
            return res.status(500).json({ 
                success: false, 
                message: 'Erro ao carregar o Campus Board.' 
            });
        }
    }

    /**
     * =========================================================================
     * 👁️ TRACK VIEW (TELEMETRIA DE STORIES)
     * =========================================================================
     */
    async trackView(req, res) {
        try {
            const { statusId } = req.params;
            const viewerId = req.user.id;

            // Registra visualização única (Ignora duplicatas via UNIQUE Constraint)
            await db.query(
                `INSERT INTO status_views (status_id, viewer_id) 
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [statusId, viewerId]
            );

            return res.json({ 
                success: true,
                message: 'Visualização computada.' 
            });

        } catch (e) { 
            console.error('[STATUS_VIEW_TRACK_ERR]', e.message);
            return res.status(500).json({ success: false }); 
        }
    }

    /**
     * =========================================================================
     * 👥 GET STATUS VIEWERS (AUDITORIA DE DONO)
     * FIX: Mostra quem viu, apenas se o solicitante for o dono.
     * =========================================================================
     */
    async getStatusViewers(req, res) {
        try {
            const { statusId } = req.params;
            const myId = req.user.id;

            // 1. Verificação de Propriedade (Security Layer)
            const ownership = await db.query(
                'SELECT user_id FROM campus_statuses WHERE id = $1', 
                [statusId]
            );

            if (ownership.rowCount === 0) {
                return res.status(404).json({ success: false, message: "Status não encontrado." });
            }

            if (ownership.rows[0].user_id !== myId) {
                return res.status(403).json({ 
                    success: false, 
                    message: "Acesso negado: apenas o dono pode auditar visualizações." 
                });
            }

            // 2. Busca de visualizadores com Join de Usuários
            const viewers = await db.query(
                `SELECT 
                    u.id as user_id,
                    u.full_name, 
                    u.avatar_url, 
                    v.viewed_at 
                 FROM status_views v
                 JOIN users u ON v.viewer_id = u.id
                 WHERE v.status_id = $1
                 ORDER BY v.viewed_at DESC`, 
                [statusId]
            );

            return res.json({ 
                success: true, 
                count: viewers.rowCount,
                data: viewers.rows 
            });

        } catch (e) { 
            console.error('[STATUS_AUDIT_ERROR]', e.message);
            return res.status(500).json({ success: false }); 
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
                    message: 'Operação não autorizada.' 
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
