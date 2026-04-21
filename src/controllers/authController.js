/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE AUTH CONTROLLER v3.0.0
 * SISTEMA DE IDENTIDADE FEDERADA E SEGURANÇA JWT
 * ============================================================================
 */

const db = require('../config/dbConfig');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

// Inicialização segura do cliente Google
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authController = {

    /**
     * Autenticação via Google Cloud (OAuth2)
     * Resolve o erro de "não consigo logar com google direto"
     */
    googleAuth: async (req, res) => {
        const { googleToken } = req.body;

        if (!googleToken) {
            return res.status(400).json({ success: false, message: 'Token do Google ausente na requisição.' });
        }

        try {
            console.log('[GOOGLE_AUTH] Iniciando validação de identidade federada...');

            // Valida o token com os servidores do Google
            const ticket = await googleClient.verifyIdToken({
                idToken: googleToken,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            const payload = ticket.getPayload();
            const { email, name, picture, sub: googleId } = payload;

            // Busca ou Cria usuário (Protocolo UPSERT)
            let userRes = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
            let user;

            if (userRes.rows.length === 0) {
                console.log(`[GOOGLE_ONBOARD] Novo aluno via Google detectado: ${email}`);
                const myCode = `VSG_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                
                const insertRes = await db.query(
                    `INSERT INTO users (full_name, email, avatar_url, google_id, university_name, referral_code, points_total, isactive)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
                    [name, email.toLowerCase(), picture, googleId, 'Estudante Google', myCode, 50]
                );
                user = insertRes.rows[0];
            } else {
                user = userRes.rows[0];
                // Atualiza avatar do Google e registra login
                await db.query(
                    'UPDATE users SET avatar_url = $1, last_login = NOW() WHERE id = $2', 
                    [picture, user.id]
                );
            }

            // Geração de Token Master do Sistema
            const token = jwt.sign(
                { id: user.id, email: user.email, fullName: user.full_name }, 
                process.env.JWT_SECRET, 
                { expiresIn: '30d' }
            );

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: {
                        user_identification: user.id,
                        user_full_name: user.full_name,
                        user_email_address: user.email,
                        user_profile_picture_url: user.avatar_url,
                        user_university_name: user.university_name,
                        user_referral_code: user.referral_code,
                        user_points_balance: user.points_total
                    }
                }
            });

        } catch (error) {
            console.error('[GOOGLE_AUTH_FATAL]', error.message);
            res.status(401).json({ success: false, message: 'Falha na validação de identidade com o Google.' });
        }
    },

    /**
     * Login via E-mail e Senha
     */
    login: async (req, res) => {
        const { email, password } = req.body;
        try {
            const userRes = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true', 
                [email.toLowerCase().trim()]
            );

            if (userRes.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Registro acadêmico não localizado.' });
            }

            const user = userRes.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(200).json({
                success: true,
                data: {
                    token,
                    user: {
                        user_identification: user.id,
                        user_full_name: user.full_name,
                        user_email_address: user.email,
                        user_profile_picture_url: user.avatar_url,
                        user_university_name: user.university_name,
                        user_points_balance: user.points_total
                    }
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erro no Kernel de Autenticação.' });
        }
    },

    /**
     * Cadastro de Novo Estudante
     */
    register: async (req, res) => {
        const { fullName, email, password, university, referralCode } = req.body;
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            const check = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
            if (check.rows.length > 0) {
                return res.status(409).json({ success: false, message: 'E-mail já está em uso.' });
            }

            const hashed = await bcrypt.hash(password, 12);
            const myCode = `VS_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

            const result = await client.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code, points_total, created_at, isactive)
                 VALUES ($1, $2, $3, $4, $5, 0, NOW(), true) RETURNING *`,
                [fullName.trim(), email.toLowerCase().trim(), hashed, university.trim(), myCode]
            );

            const newUser = result.rows[0];

            if (referralCode) {
                const inviter = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim()]);
                if (inviter.rows.length > 0) {
                    await client.query('UPDATE users SET points_total = points_total + 150 WHERE id = $1', [inviter.rows[0].id]);
                    await client.query('UPDATE users SET points_total = 50 WHERE id = $1', [newUser.id]);
                }
            }

            await client.query('COMMIT');
            const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });

            res.status(201).json({
                success: true,
                data: {
                    token,
                    user: {
                        user_identification: newUser.id,
                        user_full_name: newUser.full_name,
                        user_email_address: newUser.email,
                        user_university_name: newUser.university_name,
                        user_points_balance: newUser.points_total
                    }
                }
            });
        } catch (error) {
            if (client) await client.query('ROLLBACK');
            res.status(500).json({ success: false });
        } finally {
            client.release();
        }
    },

    /**
     * Validação de Sessão para Auto-Login (Splash Screen)
     */
    validateSession: async (req, res) => {
        try {
            const userRes = await db.query('SELECT * FROM users WHERE id = $1 AND isactive = true', [req.user.id]);
            if (userRes.rows.length === 0) return res.status(401).json({ success: false });
            
            const user = userRes.rows[0];
            res.status(200).json({
                success: true,
                data: {
                    user_identification: user.id,
                    user_full_name: user.full_name,
                    user_email_address: user.email,
                    user_profile_picture_url: user.avatar_url,
                    user_points_balance: user.points_total
                }
            });
        } catch (error) {
            res.status(401).json({ success: false });
        }
    }
};

module.exports = authController;
