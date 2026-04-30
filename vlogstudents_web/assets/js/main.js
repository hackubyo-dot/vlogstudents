/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - MAIN ORCHESTRATOR v62.0.0
 * SISTEMA OPERACIONAL DO FRONTEND | SPA ENGINE PRO | HYBRID FEED (TIKTOK 1:1)
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * MARCO DE VERSÃO v62.0.0:
 * - Hybrid Layout Detection: Identificação automática de Mobile vs Desktop.
 * - Supreme Feed Engine v800: Renderização TikTok 1:1 (Imersivo vs Split).
 * - Global Event Delegation: Blindagem contra perda de listeners em troca de views.
 * - Hardware Acceleration: IntersectionObserver para controle de GPU/Vídeo.
 * - Industrial Route Guarding: Handshake Neon DB obrigatório.
 * - Haptic & Sound Sync: Feedback tátil em interações críticas.
 * ============================================================================
 */

class VlogMainOrchestrator {
    /**
     * CONSTRUTOR MESTRE
     * Inicializa o universo de rotas, repositórios de UI e estado do ecossistema.
     */
    constructor() {
        // --- DICIONÁRIO DE ROTAS DO ECOSSISTEMA ---
        this.ROUTES = {
            // Segmento de Identidade
            SPLASH: '/',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup',
            RECOVERY: '/auth/recovery',

            // Segmento Operacional (Auth Required)
            FEED: '/home/feed',
            CHAT_LIST: '/chat/chat-list',
            CHAT_ROOM: '/chat/chat-room',
            POINTS: '/points/dashboard',
            PROFILE_VIEW: '/profile/view-profile',
            PROFILE_EDIT: '/profile/edit-profile',
            SEARCH: '/search/search-people',
            STATUS_CREATE: '/status/create-status',
            STATUS_VIEW: '/status/status-view'
        };

        // --- REPOSITÓRIO DE ESTADO DO NÚCLEO (SINGLE SOURCE OF TRUTH) ---
        this._state = {
            currentPath: null,
            previousPath: null,
            isAppReady: false,
            isProcessingRoute: false,
            bootStartTime: Date.now(),
            recoveryEmail: "",
            currentParams: {},
            viewport: window.innerWidth < 992 ? 'mobile' : 'desktop'
        };

        // --- REFERÊNCIAS DE HARDWARE VISUAL (DOM) ---
        this._ui = {
            splash: document.getElementById('splash-screen'),
            appView: document.getElementById('app-router-view'),
            navContainer: document.getElementById('liquid-nav-container'),
            pageLoader: document.getElementById('global-page-loader'),
            toastContainer: document.getElementById('vlog-toast-container'),
            body: document.body
        };

        this._activeObserver = null;

        console.log("%c[SYSTEM] Orchestrator v62.0.0 Supreme Hybrid Online.", "color: #CCFF00; font-weight: bold;");
    }

    /**
     * ========================================================================
     * 1. PROTOCOLO DE INICIALIZAÇÃO (BOOT SEQUENCE)
     * ========================================================================
     */
    async start() {
        console.group("[BOOT_SEQUENCE] Ativando Ecossistema v62");
        
        // ANTI-STALL PROTECTOR (8 segundos de garantia de UX)
        const safetyExit = setTimeout(() => {
            if (!this._state.isAppReady) {
                console.warn("[ANTI-STALL] Latência crítica. Forçando saída da Splash.");
                this._exitSplashScreen();
            }
        }, 8000);

        try {
            // A. Inicializa Kernel de Diagnóstico
            if (window.VlogTelemetry) window.VlogTelemetry.init();

            // B. DELEGAÇÃO GLOBAL DE EVENTOS (ZERO FAIL)
            this._bindGlobalDelegation();

            // C. Auditoria de Sessão (Neon DB Handshake)
            if (window.VlogAuth) {
                await window.VlogAuth.checkAuthStatus();
            }

            // D. Escuta Mudanças de Viewport
            window.addEventListener('resize', () => this._handleResize());

            // E. Ativação do Motor SPA
            window.addEventListener('hashchange', () => this._handleRouteChange());
            await this._handleRouteChange();

            // F. Liberação Cinematográfica
            clearTimeout(safetyExit);
            const loadDuration = Date.now() - this._state.bootStartTime;
            const remainingSplash = Math.max(2000 - loadDuration, 0);

            setTimeout(() => this._exitSplashScreen(), remainingSplash);

        } catch (error) {
            console.error("[BOOT_FATAL] Erro no motor principal:", error);
            this._exitSplashScreen();
            this._showToast("Falha na sincronização do campus.", "error");
        }

        console.groupEnd();
    }

    /**
     * ========================================================================
     * 2. MOTOR DE DELEGAÇÃO GLOBAL (EVENT DELEGATION)
     * Resolve o erro de botões dinâmicos e formulários SPA.
     * ========================================================================
     */
    _bindGlobalDelegation() {
        // --- CAPTURA DE SUBMISSÕES (LOGIN/REGISTER/RESET) ---
        document.addEventListener('submit', async (e) => {
            const formId = e.target.id;
            
            if (formId === 'vlog-login-form') {
                e.preventDefault();
                await this._executeLogin(e.target);
            }
            if (formId === 'vlog-signup-form') {
                e.preventDefault();
                await this._executeSignup(e.target);
            }
            if (formId === 'form-recovery-request') {
                e.preventDefault();
                await this._handleRecoveryRequest(e.target);
            }
        });

        // --- CAPTURA DE INTERAÇÕES SOCIAIS (LIKE/FOLLOW/SHARE) ---
        document.addEventListener('click', async (e) => {
            const likeBtn = e.target.closest('.vlog-action-like');
            const followBtn = e.target.closest('.vlog-action-follow');
            const shareBtn = e.target.closest('.vlog-action-share');
            const backBtn = e.target.closest('.btn-back, .btn-fidelity-back');

            if (likeBtn) this._handleLikeInteraction(likeBtn);
            if (followBtn) this._handleFollowInteraction(followBtn);
            if (shareBtn) this._handleShareInteraction(shareBtn);
            if (backBtn) { e.preventDefault(); window.history.back(); }

            // Feedback Háptico Universal
            if (e.target.closest('button, .clickable, .nav-item')) {
                if ("vibrate" in navigator) navigator.vibrate(10);
            }
        });
    }

    /**
     * ========================================================================
     * 3. MOTOR DE ROTEAMENTO SPA (HYBRID ROUTER)
     * ========================================================================
     */
    async _handleRouteChange() {
        if (this._state.isProcessingRoute) return;
        this._state.isProcessingRoute = true;

        const fullHash = window.location.hash || '#/home/feed';
        const [hashPath, queryString] = fullHash.split('?');
        const path = hashPath.replace('#', '');
        
        // Parsing de Parâmetros
        this._state.currentParams = {};
        if (queryString) {
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params) this._state.currentParams[key] = value;
        }

        console.log(`%c[ROUTER] Sincronizando: ${path}`, "color: #00FBFF;");

        // SECURITY GUARD
        const isAuthRoute = path.includes('/auth/');
        if (!isAuthRoute && (!window.VlogAuth || !window.VlogAuth.isAuthenticated)) {
            window.location.hash = this.ROUTES.LOGIN;
            this._state.isProcessingRoute = false;
            return;
        }

        this._showGlobalLoader(true);

        try {
            const response = await fetch(`/views${path}.html`);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const html = await response.text();

            // Injeção com Transição
            this._ui.appView.classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
            
            setTimeout(() => {
                this._ui.appView.innerHTML = html;
                this._ui.appView.classList.remove('animate__fadeOut');
                this._ui.appView.classList.add('animate__fadeIn');

                // Inicializa Módulo Específico
                this._initializeViewModules(path);

                // Atualiza UI Global (Sidebar vs Liquid Bar)
                this._updateNavigationLayout(path);
                
                window.scrollTo(0, 0);
            }, 150);

        } catch (error) {
            console.error("[ROUTER_ERR]", error);
            this._handleRoutingError(path);
        } finally {
            this._showGlobalLoader(false);
            this._state.isProcessingRoute = false;
        }
    }

    /**
     * BRIDGE: Conexão com Lógicas de Negócio
     */
    _initializeViewModules(path) {
        // Destrói observers antigos antes de carregar novo feed
        if (this._activeObserver) this._activeObserver.disconnect();

        if (path.includes('feed')) this._initFeedModule();
        if (path.includes('chat-list')) window.VlogChat.init();
        if (path.includes('chat-room')) window.VlogChat.loadMessages(this._state.currentParams.id);
        if (path.includes('dashboard')) window.VlogPoints.init();
        if (path.includes('profile')) window.VlogProfile.init(this._state.currentParams.id || 'me');
        if (path.includes('search')) window.VlogSearch.init();
    }

    /**
     * ========================================================================
     * 4. SUPREME FEED ENGINE v800 (HYBRID TIKTOK DESIGN)
     * ========================================================================
     */
    async _initFeedModule() {
        console.log("[FEED_ENGINE] Ativando Visual TikTok 1:1...");
        const feedRoot = document.getElementById('vlog-reels-root');
        if (!feedRoot) return;

        try {
            const res = await window.vlogApi.reels.getFeed(1);
            if (res.success && res.data.length > 0) {
                this._renderHybridFeed(feedRoot, res.data);
            }
        } catch (e) {
            console.error("[FEED_ERR]", e);
        }
    }

    _renderHybridFeed(container, reels) {
        const isMobile = this._state.viewport === 'mobile';
        
        container.innerHTML = reels.map(reel => {
            const videoUrl = window.vlogMedia.resolveUrl(reel.drive_file_id || reel.video_url);
            const authorImg = window.vlogMedia.resolveUrl(reel.author_picture || reel.user_avatar);
            const authorHandle = reel.author_name ? reel.author_name.replace(/\s/g, '').toLowerCase() : 'estudante';

            if (isMobile) {
                // DESIGN TIKTOK MOBILE (IMAGE 1)
                return `
                    <div class="vlog-reel-unit mobile-mode" data-id="${reel.id}">
                        <video id="vid-${reel.id}" class="vlog-video-node" loop playsinline preload="auto">
                            <source src="${videoUrl}" type="video/mp4">
                        </video>
                        <div class="vlog-overlay-actions">
                            <div class="vlog-avatar-stack vlog-action-profile" data-user="${reel.user_id}">
                                <div class="vlog-avatar-ring"><img src="${authorImg}" class="rounded-circle" width="50" height="50"></div>
                                <div class="follow-plus-mini vlog-action-follow">+</div>
                            </div>
                            <div class="action-pill vlog-action-like" data-id="${reel.id}">
                                <div class="icon-box"><i class="fas fa-heart"></i></div>
                                <span>${reel.likes_count || 0}</span>
                            </div>
                            <div class="action-pill">
                                <div class="icon-box"><i class="fas fa-comment-dots"></i></div>
                                <span>${reel.comments_count || 0}</span>
                            </div>
                            <div class="action-pill vlog-action-share">
                                <div class="icon-box"><i class="fas fa-share"></i></div>
                                <span>Partilhar</span>
                            </div>
                        </div>
                        <div class="mobile-meta-overlay position-absolute bottom-0 p-4 w-100">
                            <h6 class="fw-black text-white">@${authorHandle}</h6>
                            <p class="text-white text-small">${reel.title || ''}</p>
                            <div class="tag-university mt-2"><i class="fas fa-graduation-cap me-1"></i> ${reel.university_name || 'Campus Vlog'}</div>
                        </div>
                    </div>
                `;
            } else {
                // DESIGN TIKTOK DESKTOP (IMAGE 2)
                return `
                    <div class="vlog-reel-unit desktop-mode">
                        <div class="vlog-desktop-split">
                            <div class="vlog-player-half">
                                <video id="vid-${reel.id}" class="vlog-video-node" controls loop preload="auto">
                                    <source src="${videoUrl}" type="video/mp4">
                                </video>
                            </div>
                            <div class="vlog-social-half p-4">
                                <div class="d-flex align-items-center gap-3 mb-4">
                                    <img src="${authorImg}" class="rounded-circle" width="55" height="55" style="border: 2px solid var(--primary-neon)">
                                    <div>
                                        <h5 class="m-0 fw-black text-white">@${authorHandle}</h5>
                                        <small class="text-muted">${reel.university_name || 'Estudante Vlog'}</small>
                                    </div>
                                    <button class="btn btn-vlog-primary btn-sm ms-auto vlog-action-follow">Seguir</button>
                                </div>
                                <div class="reel-description-box mb-4">
                                    <p class="text-white fw-bold">${reel.title || ''}</p>
                                    <p class="text-white-50 text-small">${reel.description || ''}</p>
                                </div>
                                <div class="stats-bar-desktop d-flex gap-4 mb-4 border-bottom border-secondary pb-3">
                                    <div class="vlog-action-like clickable"><i class="fas fa-heart text-danger"></i> <b>${reel.likes_count}</b></div>
                                    <div class="clickable"><i class="fas fa-comment text-white"></i> <b>${reel.comments_count}</b></div>
                                </div>
                                <div class="comments-scroll-area flex-grow-1 overflow-y-auto">
                                    <p class="text-center text-muted mt-5 small">Nenhuma discussão acadêmica ainda.</p>
                                </div>
                                <div class="comment-input-wrapper mt-3 pt-3 border-top border-secondary">
                                    <input type="text" class="form-control bg-dark border-0 text-white p-3" placeholder="Adicionar comentário...">
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        this._startIntersectionObserver();
    }

    /**
     * MOTOR DE HARDWARE: Autoplay e Tracking
     */
    _startIntersectionObserver() {
        const options = { threshold: 0.7 };
        this._activeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (entry.isIntersecting) {
                    if (video) video.play().catch(() => {});
                    window.vlogApi.reels.trackView(entry.target.dataset.id);
                } else {
                    if (video) video.pause();
                }
            });
        }, options);

        document.querySelectorAll('.vlog-reel-unit').forEach(el => this._activeObserver.observe(el));
    }

    /**
     * ========================================================================
     * 5. HANDLERS DE AÇÃO (AUTH & SOCIAL)
     * ========================================================================
     */
    async _executeLogin(form) {
        const email = form.querySelector('#login-email')?.value;
        const pass = form.querySelector('#login-password')?.value;
        const btn = form.querySelector('button[type="submit"]');

        this._toggleBtnLoading(btn, true, "VALIDANDO...");

        try {
            const result = await window.VlogAuth.login(email, pass);
            if (result.success) {
                window.location.hash = this.ROUTES.FEED;
                window.location.reload(); 
            } else {
                this._showToast(result.message, "error");
                this._toggleBtnLoading(btn, false, 'ENTRAR NO VLOG <i class="fas fa-chevron-right ms-2"></i>');
            }
        } catch (err) {
            this._toggleBtnLoading(btn, false, "ERRO DE REDE");
        }
    }

    async _handleLikeInteraction(btn) {
        const reelId = btn.dataset.id;
        const heart = btn.querySelector('i');
        const count = btn.querySelector('span') || btn.querySelector('b');

        heart.classList.toggle('text-danger');
        heart.classList.add('animate__animated', 'animate__heartBeat');
        
        try {
            const res = await window.vlogApi.social.toggleLike(reelId);
            if (res.success && count) {
                count.innerText = res.likes_count;
            }
        } catch (e) { console.error(e); }
    }

    /**
     * ========================================================================
     * 6. GESTÃO DE UI E NAVEGAÇÃO
     * ========================================================================
     */
    _handleResize() {
        const newViewport = window.innerWidth < 992 ? 'mobile' : 'desktop';
        if (this._state.viewport !== newViewport) {
            this._state.viewport = newViewport;
            // Recarrega se estiver no feed para aplicar novo design 1:1
            if (window.location.hash.includes('feed')) this._handleRouteChange();
        }
    }

    _updateNavigationLayout(path) {
        const isAuth = path.includes('/auth/');
        const isVisible = !isAuth && window.VlogAuth.isAuthenticated;
        
        // Liquid Bar (Mobile) vs Sidebar (Desktop)
        if (this._state.viewport === 'mobile') {
            this._ui.navContainer.style.display = isVisible ? 'block' : 'none';
        } else {
            this._ui.navContainer.style.display = 'none';
            // Aqui você poderia ativar uma sidebar fixa no index.html se desejado
        }

        // Active State
        document.querySelectorAll('.nav-item').forEach(item => {
            const link = item.getAttribute('href').replace('#', '');
            item.classList.toggle('active', path.startsWith(link));
        });
    }

    _exitSplashScreen() {
        if (!this._ui.splash) return;
        this._ui.splash.style.opacity = "0";
        setTimeout(() => {
            this._ui.splash.style.display = "none";
            this._ui.appView.style.display = "block";
            this._state.isAppReady = true;
        }, 800);
    }

    _toggleBtnLoading(btn, isLoading, text = "") {
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm"></span>` : text;
    }

    _showGlobalLoader(show) {
        if (this._ui.pageLoader) this._ui.pageLoader.style.display = show ? 'block' : 'none';
    }

    _showToast(msg, type = 'info') {
        const container = this._ui.toastContainer;
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `vlog-toast glass-morphism border-${type} p-3 animate__animated animate__slideInRight`;
        toast.innerHTML = `<span class="fw-bold text-white text-small"><i class="fas fa-info-circle me-2"></i> ${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.replace('animate__slideInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 600);
        }, 4000);
    }

    _handleRoutingError(path) {
        this._ui.appView.innerHTML = `
            <div class="vh-100 d-flex flex-column align-items-center justify-content-center text-center p-5 bg-black">
                <i class="fas fa-satellite text-neon mb-4 fa-4x pulse-slow"></i>
                <h2 class="text-white fw-black">CAMPUS INDISPONÍVEL</h2>
                <p class="text-muted">A conexão com o núcleo ${path} falhou.</p>
                <button class="btn-vlog-primary mt-4 px-5" onclick="location.reload()">RECONECTAR</button>
            </div>
        `;
    }

    _registerSystemHandlers() {
        window.addEventListener('vlog_unauthorized', () => {
            this._showToast("Sessão expirada.", "error");
            window.VlogAuth.logout();
        });
    }
}

/**
 * IGNIÇÃO DO SISTEMA
 */
document.addEventListener('DOMContentLoaded', () => {
    window.VlogMain = new VlogMainOrchestrator();
    window.VlogMain.start();
});

/**
 * ============================================================================
 * FIM DO MASTER ORCHESTRATOR v62.0.0
 * ESTE CÓDIGO É A BASE NUCLEAR DO FRONTEND VLOGSTUDENTS.
 * ============================================================================
 */
