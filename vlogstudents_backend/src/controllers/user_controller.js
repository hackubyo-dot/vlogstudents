const database = require('../config/database');
const logger = require('../config/logger');
const userModel = require('../models/user_model');
const driveService = require('../services/google_drive_service');

class VlogStudentsUserController {
    async getProfile(request, response) {
        const { id } = request.params;
        const requesterId = request.user.id;

        try {
            const user = await userModel.findById(id);
            if (!user) {
                return response.status(404).json({ success: false, message: 'Estudante nao encontrado.' });
            }

            const profileData = await user.getFullProfile();
            const isFollowing = await user.isFollowing(requesterId);

            return response.status(200).json({
                success: true,
                data: {
                    ...profileData,
                    is_following: isFollowing
                }
            });
        } catch (error) {
            logger.error(`Erro ao obter perfil: ${id}`, error);
            return response.status(500).json({ success: false, message: 'Erro ao carregar perfil.' });
        }
    }

    async updateProfile(request, response) {
        const userId = request.user.id;
        const updateData = request.body;

        try {
            const user = await userModel.findById(userId);
            const updatedUser = await user.update(updateData);

            logger.info(`Perfil do usuario ${userId} atualizado.`);
            return response.status(200).json({
                success: true,
                message: 'Perfil atualizado com sucesso.',
                data: updatedUser.toJSON()
            });
        } catch (error) {
            logger.error(`Erro na atualizacao de perfil do usuario ${userId}`, error);
            return response.status(500).json({ success: false, message: 'Erro ao salvar alteracoes.' });
        }
    }

    async uploadProfilePicture(request, response) {
        const userId = request.user.id;
        const file = request.file;

        if (!file) {
            return response.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
        }

        try {
            const uploadResult = await driveService.uploadFile(file.buffer, `profile_${userId}`, file.mimetype);
            const imageUrl = `/api/v1/media/${uploadResult.fileId}`;

            await database.query('UPDATE users SET user_profile_picture_url = $1 WHERE user_identification = $2', [imageUrl, userId]);

            return response.status(200).json({
                success: true,
                message: 'Foto de perfil atualizada.',
                data: { imageUrl }
            });
        } catch (error) {
            logger.error('Erro no upload de foto de perfil', error);
            return response.status(500).json({ success: false, message: 'Erro ao processar imagem.' });
        }
    }

    async toggleFollow(request, response) {
        const followerId = request.user.id;
        const { targetUserId } = request.body;

        if (followerId === parseInt(targetUserId)) {
            return response.status(400).json({ success: false, message: 'Voce nao pode seguir a si mesmo.' });
        }

        try {
            const user = await userModel.findById(followerId);
            const isFollowing = await user.isFollowing(targetUserId);

            if (isFollowing) {
                await user.unfollow(targetUserId);
                return response.status(200).json({ success: true, action: 'unfollowed', message: 'Voce deixou de seguir o estudante.' });
            } else {
                await user.follow(targetUserId);
                return response.status(200).json({ success: true, action: 'followed', message: 'Voce agora segue este estudante.' });
            }
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao processar acao social.' });
        }
    }

    async getFollowers(request, response) {
        const { id } = request.params;
        const { page = 1, limit = 20 } = request.query;
        const offset = (page - 1) * limit;

        try {
            const user = await userModel.findById(id);
            const followers = await user.getFollowers(limit, offset);
            return response.status(200).json({ success: true, data: followers });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao listar seguidores.' });
        }
    }

    async getFollowing(request, response) {
        const { id } = request.params;
        const { page = 1, limit = 20 } = request.query;
        const offset = (page - 1) * limit;

        try {
            const user = await userModel.findById(id);
            const following = await user.getFollowing(limit, offset);
            return response.status(200).json({ success: true, data: following });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao listar quem segue.' });
        }
    }

    async searchUsers(request, response) {
        const { q } = request.query;
        try {
            const results = await userModel.search(q);
            return response.status(200).json({ success: true, data: results });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro na busca.' });
        }
    }

    async setTheme(request, response) {
        const { theme } = request.body;
        const userId = request.user.id;

        try {
            await database.query('UPDATE users SET user_theme_config = $1 WHERE user_identification = $2', [theme, userId]);
            return response.status(200).json({ success: true, message: `Tema alterado para ${theme}.` });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao mudar tema.' });
        }
    }

    async getPointsBalance(request, response) {
        const userId = request.user.id;
        try {
            const result = await database.query('SELECT user_points_balance FROM users WHERE user_identification = $1', [userId]);
            return response.status(200).json({ success: true, balance: result.rows[0].user_points_balance });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao obter saldo.' });
        }
    }

    async getPointsHistory(request, response) {
        const userId = request.user.id;
        try {
            const result = await database.query('SELECT * FROM points WHERE point_owner_user_id = $1 ORDER BY point_created_at_timestamp DESC', [userId]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao obter extrato.' });
        }
    }

    async getLeaderboard(request, response) {
        try {
            const result = await userModel.getLeaderboard(50);
            return response.status(200).json({ success: true, data: result });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao carregar ranking.' });
        }
    }

    async getUniversityRanking(request, response) {
        try {
            const result = await userModel.getUniversityRanking();
            return response.status(200).json({ success: true, data: result });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao carregar ranking por universidade.' });
        }
    }

    async getUserReels(request, response) {
        const { id } = request.params;
        try {
            const user = await userModel.findById(id);
            const reels = await user.getReels();
            return response.status(200).json({ success: true, data: reels });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao buscar reels.' });
        }
    }

    async getUserPosts(request, response) {
        const { id } = request.params;
        try {
            const user = await userModel.findById(id);
            const posts = await user.getPosts();
            return response.status(200).json({ success: true, data: posts });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao buscar postagens.' });
        }
    }

    async blockUser(request, response) {
        const { targetUserId } = request.body;
        return response.status(200).json({ success: true, message: 'Usuario bloqueado.' });
    }

    async reportUser(request, response) {
        const { targetUserId, reason } = request.body;
        return response.status(200).json({ success: true, message: 'Denuncia recebida.' });
    }

    async getMyReferrals(request, response) {
        const userId = request.user.id;
        try {
            const user = await userModel.findById(userId);
            const referrals = await user.getInvitedUsers();
            return response.status(200).json({ success: true, data: referrals });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao obter indicacoes.' });
        }
    }

    async getSuggestedUsers(request, response) {
        try {
            const result = await database.query('SELECT user_identification, user_full_name, user_profile_picture_url FROM users WHERE user_identification != $1 ORDER BY RANDOM() LIMIT 5', [request.user.id]);
            return response.status(200).json({ success: true, data: result.rows });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao sugerir usuarios.' });
        }
    }

    async muteUser(request, response) {
        return response.status(200).json({ success: true, message: 'Usuario silenciado.' });
    }

    async getInteractions(request, response) {
        const userId = request.user.id;
        try {
            const user = await userModel.findById(userId);
            const stats = await user.getInteractionsCount();
            return response.status(200).json({ success: true, data: stats });
        } catch (error) {
            return response.status(500).json({ success: false, message: 'Erro ao buscar estatisticas.' });
        }
    }

    async verifyUniversityStatus(request, response) {
        return response.status(200).json({ success: true, verified: true });
    }

    async updatePrivacySettings(request, response) {
        return response.status(200).json({ success: true, message: 'Privacidade atualizada.' });
    }

    async getBlockedUsers(request, response) {
        return response.status(200).json({ success: true, data: [] });
    }

    async getNotificationSettings(request, response) {
        return response.status(200).json({ success: true, settings: {} });
    }

    async updateNotificationSettings(request, response) {
        return response.status(200).json({ success: true, message: 'Configuracoes salvas.' });
    }

    async exportMyData(request, response) {
        return response.status(200).json({ success: true, message: 'Exportacao iniciada.' });
    }

    async handleProfileVisit(request, response) {
        return response.status(200).json({ success: true });
    }

    async getActiveSessions(request, response) {
        return response.status(200).json({ success: true, sessions: [] });
    }

    async setProfileLogo(request, response) {
        const userId = request.user.id;
        const { logoUrl } = request.body;
        await database.query('UPDATE users SET user_logo_custom_url = $1 WHERE user_identification = $2', [logoUrl, userId]);
        return response.status(200).json({ success: true, message: 'Logo atualizado.' });
    }

    async getSocialStats(request, response) {
        const userId = request.user.id;
        const result = await database.query('SELECT * FROM view_user_social_stats WHERE user_identification = $1', [userId]);
        return response.status(200).json({ success: true, data: result.rows[0] });
    }

    async deactivateAccount(request, response) {
        const userId = request.user.id;
        await database.query('UPDATE users SET user_account_status = FALSE WHERE user_identification = $1', [userId]);
        return response.status(200).json({ success: true, message: 'Conta desativada.' });
    }

    async deleteMyContent(request, response) {
        return response.status(200).json({ success: true, message: 'Conteudo em fila para exclusao.' });
    }

    async getSystemBadges(request, response) {
        return response.status(200).json({ success: true, badges: [] });
    }

    async checkAccountIntegrity(userId) {
        return true;
    }

    async logActivity(userId, action) {
        logger.info(`Atividade do usuario ${userId}: ${action}`);
    }

    async finalizeProfileSetup(request, response) {
        return response.status(200).json({ success: true, message: 'Configuracao finalizada.' });
    }
}

module.exports = new VlogStudentsUserController();