const nodemailer = require('nodemailer');
const logger = require('../config/logger');

class VlogStudentsEmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER || 'vlogstudentes@gmail.com',
                pass: process.env.SMTP_PASS || 'senha_do_app_google'
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        this.senderName = 'VlogStudents Official';
        this.senderEmail = process.env.SMTP_USER || 'vlogstudentes@gmail.com';
        this.brandColor = '#CCFF00';
        this.darkBg = '#121212';

        this.verifyConnection();
    }

    async verifyConnection() {
        try {
            await this.transporter.verify();
            logger.info('Servico de E-mail VlogStudents conectado ao servidor SMTP.');
        } catch (error) {
            logger.error('Falha ao conectar com servidor de e-mail SMTP', error);
        }
    }

    async sendEmail(to, subject, htmlContent) {
        const mailOptions = {
            from: `"${this.senderName}" <${this.senderEmail}>`,
            to: to,
            subject: subject,
            html: htmlContent
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            logger.info(`E-mail enviado para ${to}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            logger.error(`Erro ao enviar e-mail para ${to}`, error);
            return { success: false, error: error.message };
        }
    }

    generateBaseTemplate(content) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${this.darkBg}; color: #ffffff; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 20px auto; background-color: #1e1e1e; border: 1px solid #333; border-radius: 12px; overflow: hidden; }
                    .header { background-color: ${this.brandColor}; padding: 30px; text-align: center; }
                    .header h1 { color: ${this.darkBg}; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
                    .body { padding: 40px; line-height: 1.6; }
                    .footer { background-color: #151515; padding: 20px; text-align: center; font-size: 12px; color: #888; }
                    .button { display: inline-block; padding: 15px 30px; background-color: ${this.brandColor}; color: ${this.darkBg}; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; text-transform: uppercase; }
                    .highlight { color: ${this.brandColor}; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>VLOGSTUDENTS</h1>
                    </div>
                    <div class="body">
                        ${content}
                    </div>
                    <div class="footer">
                        &copy; 2025 VlogStudents App. Enviado para o ecossistema universitario profissional.<br>
                        Se voce nao solicitou este e-mail, por favor ignore.
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    async sendWelcomeEmail(userName, userEmail) {
        const content = `
            <h2>Bem-vindo, <span class="highlight">${userName}</span>!</h2>
            <p>Sua jornada no VlogStudents comeca agora. Voce acaba de entrar para a maior rede social universitaria.</p>
            <p>No VlogStudents voce pode:</p>
            <ul>
                <li>Postar e assistir <span class="highlight">Reels</span> exclusivos.</li>
                <li>Participar de <span class="highlight">Videochamadas</span> com colegas.</li>
                <li>Ganhar <span class="highlight">Pontos VS</span> por engajamento.</li>
                <li>Subir no ranking da sua universidade.</li>
            </ul>
            <p>Estamos felizes em ter voce conosco!</p>
            <a href="https://vlogstudents.onrender.com" class="button">Acessar App</a>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Bem-vindo ao VlogStudents!', html);
    }

    async sendPasswordRecoveryEmail(userEmail, code) {
        const content = `
            <h2>Recuperacao de Senha</h2>
            <p>Recebemos uma solicitacao para redefinir a senha da sua conta no VlogStudents.</p>
            <p>Use o código de segurança abaixo para prosseguir com a redefinicao:</p>
            <div style="background-color: #333; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; letter-spacing: 8px; color: ${this.brandColor}; font-weight: bold;">${code}</span>
            </div>
            <p>Este código expira em <span class="highlight">60 minutos</span>.</p>
            <p>Se voce nao solicitou esta alteracao, proteja sua conta mudando sua senha atual imediatamente.</p>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Código de Recuperação - VlogStudents', html);
    }

    async sendReferralNotification(referrerEmail, invitedName) {
        const content = `
            <h2>Nova Indicação Confirmada!</h2>
            <p>Excelente noticia! Seu colega <span class="highlight">${invitedName}</span> acabou de criar uma conta usando seu link.</p>
            <p>Voce acaba de receber <span class="highlight">150 Pontos VS</span> como recompensa.</p>
            <p>Continue indicando e ganhe ainda mais prêmios e destaque no seu perfil.</p>
            <a href="https://vlogstudents.onrender.com/points" class="button">Ver meu saldo</a>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(referrerEmail, 'Você ganhou pontos por indicação!', html);
    }

    async sendPointsAwardedNotification(userEmail, amount, reason) {
        const content = `
            <h2>Você ganhou Pontos!</h2>
            <p>Seu engajamento no VlogStudents foi recompensado.</p>
            <p>Acabamos de creditar <span class="highlight">+${amount} VS</span> na sua conta.</p>
            <p>Motivo: <span class="highlight">${reason}</span></p>
            <p>Continue interagindo para acumular mais pontos e subir de nível!</p>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Recompensa de Pontos - VlogStudents', html);
    }

    async sendSecurityAlert(userEmail, deviceDetails) {
        const content = `
            <h2 style="color: #ff4444;">Alerta de Segurança</h2>
            <p>Detectamos um novo acesso à sua conta no VlogStudents.</p>
            <p><strong>Detalhes do Acesso:</strong></p>
            <ul>
                <li>Data: ${new Date().toLocaleString('pt-BR')}</li>
                <li>Dispositivo: ${deviceDetails}</li>
            </ul>
            <p>Se foi voce, ignore este e-mail. Caso contrario, <span class="highlight">altere sua senha agora</span> para manter sua conta segura.</p>
            <a href="https://vlogstudents.onrender.com/security" class="button" style="background-color: #ff4444; color: white;">Proteger Conta</a>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Aviso de Segurança - Novo Acesso', html);
    }

    async sendUniversityVerificationEmail(userEmail, university) {
        const content = `
            <h2>Confirmação de Universidade</h2>
            <p>Detectamos que voce se cadastrou como estudante da <span class="highlight">${university}</span>.</p>
            <p>Para desbloquear todos os recursos exclusivos do seu campus, confirme seu e-mail institucional.</p>
            <p>Sua conta agora faz parte do ecossistema oficial acadêmico.</p>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Verificação Acadêmica VlogStudents', html);
    }

    async sendGroupInviteEmail(userEmail, inviterName, groupName) {
        const content = `
            <h2>Convite para Grupo</h2>
            <p><span class="highlight">${inviterName}</span> convidou voce para participar do grupo <span class="highlight">${groupName}</span> no VlogStudents Chat.</p>
            <p>Entre agora para participar da conversa e compartilhar mídias com seus colegas.</p>
            <a href="https://vlogstudents.onrender.com/chat" class="button">Entrar no Grupo</a>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, `Convite para o grupo ${groupName}`, html);
    }

    async sendSupportTicketAck(userEmail, ticketId, subject) {
        const content = `
            <h2>Recebemos seu Chamado</h2>
            <p>Ola, seu ticket de suporte <span class="highlight">#${ticketId}</span> foi aberto com sucesso.</p>
            <p><strong>Assunto:</strong> ${subject}</p>
            <p>Nossa equipe técnica analisará sua solicitacao e responderá em ate 24 horas úteis.</p>
            <p>Obrigado por ajudar a melhorar o VlogStudents.</p>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, `Suporte VlogStudents - Ticket #${ticketId}`, html);
    }

    async sendAccountDeactivationWarning(userEmail) {
        const content = `
            <h2 style="color: #ff4444;">Sua conta sera desativada</h2>
            <p>Notamos que voce nao acessa o VlogStudents ha algum tempo.</p>
            <p>Sua conta sera marcada como inativa em <span class="highlight">7 dias</span>. Para evitar isso, basta fazer login no aplicativo hoje mesmo.</p>
            <p>Sentiremos sua falta no campus!</p>
            <a href="https://vlogstudents.onrender.com" class="button">Reativar Agora</a>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Sentimos sua falta - VlogStudents', html);
    }

    async sendMonthlyDigest(userEmail, stats) {
        const content = `
            <h2>Seu Resumo do Mes</h2>
            <p>Veja como foi seu desempenho acadêmico no VlogStudents no último mês:</p>
            <ul>
                <li>Pontos Ganhos: <span class="highlight">${stats.points}</span></li>
                <li>Reels Postados: <span class="highlight">${stats.reels}</span></li>
                <li>Novos Seguidores: <span class="highlight">${stats.followers}</span></li>
            </ul>
            <p>Voce esta no Top 10% da sua universidade! Continue assim.</p>
        `;
        const html = this.generateBaseTemplate(content);
        return await this.sendEmail(userEmail, 'Resumo Mensal VlogStudents', html);
    }

    async testEmailService() {
        const testEmail = process.env.SMTP_USER;
        if (!testEmail) return false;
        const html = this.generateBaseTemplate('<h2>Teste de Sistema</h2><p>Servico de e-mail operando normalmente.</p>');
        return await this.sendEmail(testEmail, 'VlogStudents - Teste de Conexão', html);
    }

    async sendBroadcast(emails = [], subject, message) {
        const html = this.generateBaseTemplate(`<h2>Aviso Geral</h2><p>${message}</p>`);
        const results = [];
        for (const email of emails) {
            const res = await this.sendEmail(email, subject, html);
            results.push({ email, success: res.success });
        }
        return results;
    }

    async sendAttachmentEmail(to, subject, text, attachments = []) {
        const mailOptions = {
            from: `"${this.senderName}" <${this.senderEmail}>`,
            to,
            subject,
            text,
            attachments
        };
        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            return false;
        }
    }

    async close() {
        this.transporter.close();
        logger.info('Servico de e-mail encerrado.');
    }
}

const emailServiceInstance = new VlogStudentsEmailService();

module.exports = emailServiceInstance;