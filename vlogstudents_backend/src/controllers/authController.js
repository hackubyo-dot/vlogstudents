const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const pointsService = require('../services/pointsService');
const { registerSchema, loginSchema } = require('../utils/validators');

class AuthController {
    /**
     * POST /auth/register
     */
    async register(req, res) {
        try {
            // Validação de Dados
            const parsedData = registerSchema.parse(req.body);
            const { fullName, email, password, university, referralCode } = parsedData;

            // Verificar se e-mail já existe
            const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (userExists.rowCount > 0) {
                return res.status(409).json({ success: false, message: 'Este e-mail já está em uso.' });
            }

            // Gerar Referral Code único para o novo usuário
            const myReferralCode = `VS_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

            // Hash da senha
            const salt = await bcrypt.genSalt(env.BCRYPT_SALT);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Inserir usuário
            const result = await db.query(
                `INSERT INTO users (full_name, email, password_hash, university_name, referral_code)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, university_name, referral_code`,
                [fullName, email, hashedPassword, university, myReferralCode]
            );

            const newUser = result.rows[0];

            // Bônus de Boas-vindas (100 pontos)
            await pointsService.addPoints(newUser.id, 100, 'Bônus de Boas-vindas');

            // Lógica de Indicação (se houver)
            if (referralCode) {
                const inviter = await db.query('SELECT id FROM users WHERE referral_code = $1', [referralCode]);
                if (inviter.rowCount > 0) {
                    // Dá 50 pontos para quem indicou
                    await pointsService.addPoints(inviter.rows[0].id, 50, 'Indicação de Aluno', newUser.id);
                }
            }

            // Gerar Token JWT
            const token = jwt.sign({ id: newUser.id }, env.JWT_SECRET, { expiresIn: '7d' });

            res.status(201).json({
                success: true,
                token,
                user: { ...newUser, points: 100 }
            });

        } catch (error) {
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, message: error.errors[0].message });
            }
            res.status(500).json({ success: false, message: 'Erro interno ao processar cadastro.' });
        }
    }

    /**
     * POST /auth/login
     */
    async login(req, res) {
        try {
            const { email, password } = loginSchema.parse(req.body);

            const result = await db.query(
                'SELECT * FROM users WHERE email = $1 AND isactive = true',
                [email]
            );

            if (result.rowCount === 0) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            const user = result.rows[0];

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
            }

            const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

            // Remover senha da resposta
            delete user.password_hash;
            delete user.recovery_token;

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    fullName: user.full_name,
                    email: user.email,
                    avatarUrl: user.avatar_url,
                    points: user.points_total,
                    university: user.university_name,
                    referralCode: user.referral_code
                }
            });

        } catch (error) {
            if (error.name === 'ZodError') {
                return res.status(400).json({ success: false, message: error.errors[0].message });
            }
            res.status(500).json({ success: false, message: 'Erro interno ao realizar login.' });
        }
    }
}

module.exports = new AuthController();