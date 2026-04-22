/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE - IDENTITY & AUTH CONTROLLER
 * Registro, Login, Recuperação e Validação de Sessão
 * ============================================================================
 */
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { registerSchema, loginSchema } = require('../utils/validators');
const pointsService = require('../services/pointsService');

class AuthController {
    /**
     * @route   POST /api/v1/auth/register
     * @desc    Registra novo estudante com bônus de boas-vindas
     */
    async register(req, res) {
        const client = await db.getClient();
        try {
            // 1. Validação de Payload com Zod
            const validation = registerSchema.safeParse(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false, 
                    message: 'Dados de validação incorretos.',
                    errors: validation.error.format()
                });
            }

            const { fullName, email, password, university, referralCode } = validation.data;

            // 2. Verificação de Existência
            const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            if (userCheck.rowCount > 0) {
                return res.status(409).json({ success: false, message: 'Este e-mail já possui cadastro ativo.' });
            }

            await client.query('BEGIN');

            // 3. Hash de Senha de Alta Segurança
            const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
            const hashedPassword = await bcrypt.hash(password, salt);

            // 4. Geração de Código de Indicação Próprio
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 9).toUpperCase()}_${Date.now().toString().slice(-3)}`;

            // 5. Inserção do Usuário
            const userInsertion = await client.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, university_name, referral_code, points_total`,
                [fullName, email, hashedPassword, university, myReferralCode]
            );

            const newUser = userInsertion.rows[0];

            // 6. Lógica de Recompensa de Onboarding (Bônus de Registro)
            await pointsService.addPointsTransactional(client, newUser.id, 100, 'Bônus de Boas-vindas (Onboarding)');

            // 7. Lógica de Indicação (Referral System)
            if (referralCode) {
                const inviterCheck = await client.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
                if (inviterCheck.rowCount > 0) {
                    const inviterId = inviterCheck.rows[0].id;
                    // Quem indicou ganha 50 pontos
                    await pointsService.addPointsTransactional(client, inviterId, 50, `Indicação de Aluno: ${fullName}`, newUser.id);
                    // O novo aluno ganha +25 pontos por usar código
                    await pointsService.addPointsTransactional(client, newUser.id, 25, 'Bônus por usar Código de Convite', inviterId);
                }
            }

            await client.query('COMMIT');

            // 8. Geração de Token JWT
            const token = jwt.sign({ id: newUser.id }, env.JWT_SECRET, { expiresIn: '7d' });

            return res.status(201).json({
                success: true,
                message: 'Conta universitária criada com sucesso.',
                token,
                user: {
                    ...newUser,
                    points: newUser.points_total + 125 // Valor atualizado após bônus
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[AUTH_REGISTER_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Falha crítica no motor de cadastro.' });
        } finally {
            client.release();
        }
    }

    /**
     * @route   POST /api/v1/auth/login
     * @desc    Autenticação de usuário e retorno de perfil completo
     */
    async login(req, res) {
        try {
            const { email, password } = loginSchema.parse(req.body);

            // 1. Busca por Usuário Ativo
            const userResult = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true', 
                [email]
            );

            if (userResult.rowCount === 0) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas ou conta inativa.' });
            }

            const user = userResult.rows[0];

            // 2. Comparação de Hash
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'A senha informada está incorreta.' });
            }

            // 3. Atualizar Último Acesso
            await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

            // 4. Token JWT
            const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

            // 5. Limpeza de dados sensíveis da resposta
            const responseUser = { ...user };
            delete responseUser.password_hash;
            delete responseUser.recovery_token;
            delete responseUser.recovery_expires;

            return res.json({
                success: true,
                message: 'Login realizado com sucesso.',
                token,
                user: responseUser
            });

        } catch (error) {
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, message: 'Dados de login malformatados.' });
            }
            console.error('[AUTH_LOGIN_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Erro interno ao validar credenciais.' });
        }
    }

    /**
     * @route   POST /api/v1/auth/recovery/request
     * @desc    Gera token de recuperação de senha
     */
    async requestRecovery(req, res) {
        try {
            const { email } = req.body;
            const token = Math.floor(100000 + Math.random() * 900000).toString(); // Código de 6 dígitos
            const expires = new Date(Date.now() + 3600000); // 1 hora de validade

            const result = await db.query(
                'UPDATE users SET recovery_token = $1, recovery_expires = $2 WHERE email = $3 RETURNING id',
                [token, expires, email]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'E-mail não encontrado na base acadêmica.' });
            }

            // SIMULAÇÃO DE ENVIO DE E-MAIL (Em prod usaria SendGrid/AWS SES)
            console.log(`[EMAIL_RECOVERY_SIMULATOR] Para: ${email} | Token: ${token}`);

            return res.json({ 
                success: true, 
                message: 'As instruções de recuperação foram enviadas ao seu e-mail.' 
            });

        } catch (error) {
            console.error('[AUTH_RECOVERY_FATAL]', error);
            return res.status(500).json({ success: false, message: 'Falha ao processar pedido de recuperação.' });
        }
    }
}

module.exports = new AuthController();
