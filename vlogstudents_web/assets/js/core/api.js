/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - API KERNEL v45.0.0
 * ORQUESTRADOR CENTRAL DE COMUNICAÇÃO HTTP (BLINDAGEM NUCLEAR)
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * MARCO DE VERSÃO v45.0.0:
 * - Anti-Undefined Architecture: Inicialização imediata do namespace global.
 * - Axios Industrial Instance: Pool de conexões com timeout de 30s.
 * - Nuclear Tracing: Injeção de Trace-ID em nível de hardware.
 * - Semantic Error Mapping: Tradução de códigos HTTP para linguagem acadêmica.
 * - Multi-Part Engine: Suporte nativo para buffers binários (Mídia/Avatares).
 * ============================================================================
 */

/**
 * 🛡️ INICIALIZAÇÃO ATÔMICA DO NAMESPACE
 * Isso garante que mesmo que o script demore a carregar, o objeto 'vlogApi'
 * já está definido como um esqueleto, evitando erros de 'undefined' em outros módulos.
 */
window.vlogApi = {
    auth: {},
    user: {},
    reels: {},
    social: {},
    chat: {},
    status: {},
    economy: {},
    system: {}
};

(function() {
    // --- CONFIGURAÇÕES DE INFRAESTRUTURA DE REDE ---
    const API_CONFIG = {
        BASE_URL: "https://vlogstudents.onrender.com/api/v1",
        TIMEOUT: 30000, // 30 segundos de tolerância para redes instáveis
        HEADERS: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Vlog-Platform': 'Web-Enterprise',
            'X-Vlog-App-Version': '20.0.0-Master-Edition'
        }
    };

    // --- INSTÂNCIA MESTRE AXIOS ---
    const _client = axios.create({
        baseURL: API_CONFIG.BASE_URL,
        timeout: API_CONFIG.TIMEOUT,
        headers: API_CONFIG.HEADERS
    });

    /**
     * ========================================================================
     * 1. INTERCEPTORES DE REQUISIÇÃO (SECURITY & TRACING)
     * Injeta tokens de hardware e identificadores de rastreio.
     * ========================================================================
     */
    _client.interceptors.request.use(
        (config) => {
            // A. Injeção de Identidade (JWT do Vault Local)
            const token = localStorage.getItem('vlog_access_token_v20');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            // B. Rastreabilidade Nuclear (Trace ID)
            // Permite que o suporte técnico rastreie a requisição no log do servidor
            const traceId = `TR-WEB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            config.headers['X-Vlog-Trace-ID'] = traceId;

            // C. Fingerprint do Campus
            config.headers['X-Vlog-Fingerprint'] = btoa(navigator.userAgent).substr(0, 32);

            if (location.hostname === "localhost") {
                console.log(`%c[API_OUT] ${config.method.toUpperCase()} -> ${config.url}`, "color: #CCFF00; font-weight: bold;");
            }

            return config;
        },
        (error) => {
            console.error("[API_REQUEST_FATAL]", error);
            return Promise.reject(error);
        }
    );

    /**
     * ========================================================================
     * 2. INTERCEPTORES DE RESPOSTA (KERNEL DE VALIDAÇÃO)
     * Analisa payloads de retorno e gerencia exceções de segurança.
     * ========================================================================
     */
    _client.interceptors.response.use(
        (response) => {
            if (location.hostname === "localhost") {
                console.log(`%c[API_IN] ${response.status} <- ${response.config.url}`, "color: #00FBFF; font-weight: bold;");
            }
            // Retorna apenas os dados úteis para o chamador
            return response.data;
        },
        (error) => {
            const report = {
                status: error.response ? error.response.status : 0,
                message: "Falha na comunicação com o campus central.",
                raw: error.response ? error.response.data : null,
                traceId: error.config ? error.config.headers['X-Vlog-Trace-ID'] : null
            };

            // PROTOCOLO DE EXCEÇÃO GRANULAR
            if (error.response) {
                const apiMessage = error.response.data?.message;
                
                switch (error.response.status) {
                    case 400: report.message = apiMessage || "Protocolo de dados inválido."; break;
                    case 401:
                        report.message = "Sessão acadêmica expirada.";
                        // Dispara evento global de deslogue (menos em rotas de auth)
                        if (!window.location.hash.includes('/auth/')) {
                            window.dispatchEvent(new CustomEvent('vlog_unauthorized'));
                        }
                        break;
                    case 403: report.message = "Acesso restrito detectado."; break;
                    case 404: report.message = "Recurso não localizado no campus."; break;
                    case 429: report.message = "Muitas requisições simultâneas. Aguarde."; break;
                    case 500: report.message = "Erro crítico no núcleo Node.js."; break;
                    case 503: report.message = "O banco de dados Neon está em manutenção."; break;
                }
            } else if (error.request) {
                report.message = "O servidor master não respondeu à solicitação.";
            }

            console.error(`%c[API_ERROR] ${report.status} | ${report.message}`, "background: #f00; color: #fff; padding: 2px 5px;");
            return Promise.reject(report);
        }
    );

    /**
     * ========================================================================
     * 3. MÓDULO: AUTHENTICATION (IDENTITY PROVIDER)
     * Gerencia o acesso e a criação de identidades.
     * ========================================================================
     */
    window.vlogApi.auth = {
        /**
         * Realiza login acadêmico tradicional.
         */
        login: (email, password) => {
            return _client.post('/auth/login', { 
                email: email.trim().toLowerCase(), 
                password: password 
            });
        },

        /**
         * Registra um novo estudante no ecossistema.
         */
        register: (data) => {
            return _client.post('/auth/register', {
                fullName: data.fullName,
                email: data.email.trim().toLowerCase(),
                password: data.password,
                university: data.university,
                referralCode: data.referralCode || null
            });
        },

        /**
         * Autenticação federada via Google Cloud.
         */
        google: (idToken) => {
            return _client.post('/auth/google', { idToken });
        },

        /**
         * Solicita PIN de recuperação de 6 dígitos.
         */
        recoveryRequest: (email) => {
            return _client.post('/auth/recovery/request', { email: email.trim().toLowerCase() });
        },

        /**
         * Redefine a senha mestre utilizando o PIN.
         */
        recoveryReset: (email, token, newPassword) => {
            return _client.post('/auth/recovery/reset', { 
                email: email.trim().toLowerCase(), 
                token: token.trim(), 
                newPassword 
            });
        }
    };

    /**
     * ========================================================================
     * 4. MÓDULO: USERS (PERFIL & NETWORKING)
     * Gerencia metadados e biometria do estudante.
     * ========================================================================
     */
    window.vlogApi.user = {
        getMe: () => _client.get('/users/me'),
        
        getProfile: (userId) => _client.get(`/users/profile/${userId}`),
        
        updateProfile: (data) => _client.patch('/users/update', data),
        
        search: (query) => _client.get('/users/search', { params: { q: query } }),
        
        getSocialMetrics: (userId) => _client.get(`/users/social/metrics/${userId}`),
        
        /**
         * Upload de Avatar via Form-Data (Supabase Sync)
         */
        uploadAvatar: (file) => {
            const formData = new FormData();
            formData.append('file', file);
            return _client.post('/users/profile/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        },

        deleteAccount: () => _client.delete('/users/delete')
    };

    /**
     * ========================================================================
     * 5. MÓDULO: REELS (VLOG ENGINE)
     * Gerenciamento de conteúdo vertical de alta performance.
     * ========================================================================
     */
    window.vlogApi.reels = {
        getFeed: (page = 1, limit = 12) => _client.get('/reels', { params: { page, limit } }),
        
        getByUser: (userId) => _client.get(`/reels/user/${userId}`),
        
        getById: (id) => _client.get(`/reels/${id}`),
        
        trackView: (reelId) => _client.post(`/reels/${reelId}/view`),
        
        /**
         * Publicação Industrial de Reels (Multipart)
         */
        create: (videoFile, title, description) => {
            const formData = new FormData();
            formData.append('file', videoFile);
            formData.append('title', title);
            formData.append('description', description);
            return _client.post('/reels/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        },

        delete: (reelId) => _client.delete(`/reels/delete/${reelId}`)
    };

    /**
     * ========================================================================
     * 6. MÓDULO: SOCIAL (INTERAÇÕES)
     * Engajamento, comentários e networking.
     * ========================================================================
     */
    window.vlogApi.social = {
        toggleLike: (reelId) => _client.post('/social/like', { reelId }),
        
        postComment: (reelId, content, parentId = null) => {
            return _client.post('/social/comment', { reelId, content, parentId });
        },
        
        getComments: (reelId) => _client.get(`/social/comments/${reelId}`),
        
        toggleFollow: (targetUserId) => _client.post('/social/follow', { targetUserId }),
        
        toggleCommentReaction: (commentId, reaction) => {
            return _client.post('/social/comment/react', { commentId, reaction });
        }
    };

    /**
     * ========================================================================
     * 7. MÓDULO: CHAT (REALTIME ENGINE)
     * Canais de comunicação 1-para-1.
     * ========================================================================
     */
    window.vlogApi.chat = {
        getRooms: () => _client.get('/chat/rooms'),
        
        createRoom: (targetUserId) => _client.post('/chat/rooms/create', { targetUserId }),
        
        getMessages: (roomId, page = 1) => {
            return _client.get(`/chat/rooms/${roomId}/messages`, { params: { page } });
        },
        
        sendMessage: (roomId, content) => _client.post('/chat/messages', { roomId, content }),
        
        markAsRead: (roomId) => _client.post(`/chat/rooms/${roomId}/read`)
    };

    /**
     * ========================================================================
     * 8. MÓDULO: STATUS (STORIES ACADÊMICOS)
     * Conteúdo efêmero com expiração automática.
     * ========================================================================
     */
    window.vlogApi.status = {
        getActive: () => _client.get('/status/active'),
        
        trackView: (id) => _client.post(`/status/view/${id}`),
        
        getViewers: (id) => _client.get(`/status/${id}/viewers`),
        
        /**
         * Criação de Status (Suporta Texto ou Mídia Binária)
         */
        create: (type, content, file = null, bgColor = "#000000") => {
            const formData = new FormData();
            formData.append('type', type);
            formData.append('content', content);
            formData.append('backgroundColor', bgColor);
            if (file) formData.append('file', file);
            
            return _client.post('/status/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
    };

    /**
     * ========================================================================
     * 9. MÓDULO: ECONOMY (VOICES SYNC)
     * Sincronização de pontos e extrato financeiro.
     * ========================================================================
     */
    window.vlogApi.economy = {
        getHistory: () => _client.get('/economy/history'),
        
        getLeaderboard: () => _client.get('/economy/leaderboard'),
        
        getReferralStats: () => _client.get('/users/referrals/stats')
    };

    /**
     * ========================================================================
     * 10. MÓDULO: SYSTEM (MONITORAMENTO)
     * Telemetria e integridade do ecossistema.
     * ========================================================================
     */
    window.vlogApi.system = {
        health: () => _client.get('/health'),
        
        logError: (error, stack) => {
            return _client.post('/system/log-error', {
                error, 
                stack,
                platform: 'Web-SPA',
                timestamp: new Date().toISOString()
            });
        }
    };

    console.log("%c[API_KERNEL] Orquestrador v45.0.0 Online. Blindagem Ativa.", "color: #00FBFF; font-weight: bold;");

})();

/**
 * ============================================================================
 * 🎞️ VLOG MEDIA RESOLVER (SUPABASE GATEWAY)
 * Utilitário para resolver caminhos de imagem/vídeo do servidor.
 * ============================================================================
 */
window.vlogMedia = {
    /**
     * Converte um path do banco de dados em uma URL acessível.
     * @param {String} path
     */
    resolveUrl: (path) => {
        if (!path) return 'https://ui-avatars.com/api/?name=Estudante&background=111111&color=CCFF00';
        if (path.startsWith('http') || path.startsWith('data:')) return path;
        // Proxy de streaming do backend para evitar CORS de mídia bruta
        return `https://vlogstudents.onrender.com/api/v1/media/stream/${path}`;
    }
};

/**
 * ============================================================================
 * FIM DO API KERNEL v45.0.0 - THE DEFINITIVE MASTER ENGINE
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * ============================================================================
 */
