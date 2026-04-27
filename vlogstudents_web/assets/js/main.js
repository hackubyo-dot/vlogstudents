/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - MAIN ORCHESTRATOR v61.0.0
 * SISTEMA OPERACIONAL DO FRONTEND | SPA ENGINE PRO | ZERO FAIL PROTOCOL
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * MARCO DE VERSÃO v61.0.0:
 * - Advanced Parameter Parsing: Suporte a queries complexas (ex: ?id=123).
 * - Global Event Delegation: Interceptação de submissões e cliques no document.
 * - Multi-Module Bridge: Inicialização atômica de kernels (Feed, Chat, Points).
 * - Industrial Route Guarding: Handshake obrigatório com Neon DB / Auth Kernel.
 * - Anti-Stall v5: Saída forçada da Splash em 8s (Failsafe de Experiência).
 * - Haptic Navigation: Feedback vibratório sincronizado com transições SPA.
 * ============================================================================
 */

class VlogMainOrchestrator {
    /**
     * CONSTRUTOR MESTRE
     * Centraliza a inteligência de rotas, estados de hardware e repositórios de UI.
     */
    constructor() {
        // --- DICIONÁRIO DE UNIVERSO DE ROTAS ---
        this.ROUTES = {
            // Segmento de Identidade (Público)
            SPLASH: '/',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup',
            RECOVERY: '/auth/recovery',

            // Segmento Operacional (Privado - Auth Required)
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

        // --- REPOSITÓRIO DE ESTADO DO NÚCLEO ---
        this._state = {
            currentPath: null,
            previousPath: null,
            isAppReady: false,
            isProcessingRoute: false,
            bootStartTime: Date.now(),
            recoveryEmail: "", // Cache volátil para fluxo de reset
            currentParams: {}, // Armazena parâmetros da URL (?id=...)
        };

        // --- REFERÊNCIAS DE HARDWARE VISUAL (DOM) ---
        this._ui = {
            splash: document.getElementById('splash-screen'),
            appView: document.getElementById('app-router-view'),
            nav: document.getElementById('liquid-nav-container'),
            loader: document.getElementById('global-page-loader'),
            toastContainer: document.getElementById('vlog-toast-container'),
            body: document.body
        };

        console.log("%c[SYSTEM] Orchestrator v61.0.0 Unified Booting...", "color: #CCFF00; font-weight: bold;");
    }

    /**
     * ========================================================================
     * 1. PROTOCOLO DE INICIALIZAÇÃO (BOOT SEQUENCE)
     * ========================================================================
     */
    async start() {
        console.group("[BOOT_SEQUENCE] Ativando Ecossistema v61");
        
        // ANTI-STALL PROTECTOR (Garantia de UX: 8 segundos para liberar o viewport)
        const safetyExit = setTimeout(() => {
            if (!this._state.isAppReady) {
                console.warn("[ANTI-STALL] Latência crítica. Forçando interface SPA.");
                this._exitSplashScreen();
            }
        }, 8000);

        try {
            // A. Inicializa Kernel de Diagnóstico
            if (window.VlogTelemetry) window.VlogTelemetry.init();

            // B. DELEGAÇÃO GLOBAL DE EVENTOS (ZERO FAIL LOGIC)
            // Vinculamos listeners ao 'document' para que persistam entre trocas de página.
            this._bindGlobalDelegation();

            // C. Auditoria de Sessão (Neon DB Handshake)
            // IMPORTANTE: Bloqueamos o boot até saber se o usuário é válido.
            if (window.VlogAuth) {
                await window.VlogAuth.checkAuthStatus();
            }

            // D. Ativação do Motor de Roteamento SPA
            window.addEventListener('hashchange', () => this._handleRouteChange());
            await this._handleRouteChange();

            // E. Conclusão da Transição
            clearTimeout(safetyExit);
            const loadDuration = Date.now() - this._state.bootStartTime;
            const remainingSplash = Math.max(2000 - loadDuration, 0); 

            setTimeout(() => this._exitSplashScreen(), remainingSplash);

        } catch (error) {
            console.error("[BOOT_FATAL] Falha catastrófica no motor principal:", error);
            this._exitSplashScreen();
            this._showToast("Falha na sincronização do campus central.", "error");
        }

        console.groupEnd();
    }

    /**
     * ========================================================================
     * 2. MOTOR DE ROTEAMENTO SPA (NUCLEAR ENGINE)
     * Gerencia carregamento de views, parâmetros e segurança.
     * ========================================================================
     */
    async _handleRouteChange() {
        if (this._state.isProcessingRoute) return;
        this._state.isProcessingRoute = true;

        // 1. PARSING DE URL E PARÂMETROS
        const fullHash = window.location.hash || '#/home/feed';
        const [hashPath, queryString] = fullHash.split('?');
        const path = hashPath.replace('#', '');
        
        this._state.currentParams = {};
        if (queryString) {
            const params = new URLSearchParams(queryString);
            for (const [key, value] of params) {
                this._state.currentParams[key] = value;
            }
        }

        console.log(`%c[ROUTER] SPA Navigating to: ${path}`, "color: #00FBFF;", this._state.currentParams);

        // 2. ROUTE GUARD (SEGURANÇA ACADÊMICA)
        const isAuthRoute = path.includes('/auth/');
        if (!isAuthRoute && (!window.VlogAuth || !window.VlogAuth.isAuthenticated)) {
            console.warn("[ROUTER] Acesso restrito. Redirecionando para Login.");
            window.location.hash = this.ROUTES.LOGIN;
            this._state.isProcessingRoute = false;
            return;
        }

        this._showGlobalLoader(true);

        try {
            // 3. BUSCA DE TEMPLATE HTML
            const response = await fetch(`/views${path}.html`);
            if (!response.ok) throw new Error(`View ${path} não localizada.`);
            const html = await response.text();

            // 4. INJEÇÃO ATÔMICA E ANIMAÇÃO
            this._ui.appView.classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
            
            setTimeout(() => {
                this._ui.appView.innerHTML = html;
                this._ui.appView.classList.remove('animate__fadeOut');
                this._ui.appView.classList.add('animate__fadeIn');

                // 5. INICIALIZAÇÃO DE MÓDULOS ESPECÍFICOS (BRIDGE)
                this._initializeViewModules(path);

                // 6. ATUALIZAÇÃO DA UI GLOBAL
                this._updateGlobalUIState(path);
                
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
     * BRIDGE: Conecta rotas aos scripts JS de cada módulo.
     */
    _initializeViewModules(path) {
        if (path.includes('feed')) window.VlogFeed.init();
        if (path.includes('chat-list')) window.VlogChat.init();
        if (path.includes('chat-room')) window.VlogChat.loadMessages(this._state.currentParams.id);
        if (path.includes('dashboard')) window.VlogPoints.init();
        if (path.includes('profile')) window.VlogProfile.init(this._state.currentParams.id || 'me');
        if (path.includes('search')) window.VlogSearch.init();
        if (path.includes('create-status')) window.VlogStatusCreate.init();
        if (path.includes('status-view')) window.VlogStatusViewer.init();
    }

    /**
     * ========================================================================
     * 3. MOTOR DE DELEGAÇÃO GLOBAL (EVENT DELEGATION)
     * Garante que botões e formulários funcionem SEMPRE.
     * ========================================================================
     */
    _bindGlobalDelegation() {
        console.log("[SYSTEM] Vinculando Delegatários de Eventos Global...");

        // A. CAPTURA DE SUBMISSÕES (FORMULÁRIOS)
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

            if (formId === 'form-recovery-reset') {
                e.preventDefault();
                await this._handleRecoveryReset(e.target);
            }
        });

        // B. CAPTURA DE CLIQUES (UX & HARDWARE BACK)
        document.addEventListener('click', (e) => {
            const backBtn = e.target.closest('.btn-back, .btn-fidelity-back');
            if (backBtn) {
                e.preventDefault();
                window.history.back();
            }

            const clickable = e.target.closest('button, .clickable, .nav-item');
            if (clickable) {
                if ("vibrate" in navigator) navigator.vibrate(10);
            }
        });

        // C. MONITOR DE CONECTIVIDADE
        window.addEventListener('online', () => this._showToast("Conexão restabelecida.", "success"));
        window.addEventListener('offline', () => this._showToast("Você está desconectado.", "warning"));
    }

    /**
     * ========================================================================
     * 4. HANDLERS DE AÇÃO (BUSINESS LOGIC)
     * ========================================================================
     */

    async _executeLogin(form) {
        const email = form.querySelector('#login-email')?.value;
        const pass = form.querySelector('#login-password')?.value;
        const btn = form.querySelector('button[type="submit"]');

        if (!email || !pass) return this._showToast("Preencha as credenciais.", "warning");

        this._toggleBtnLoading(btn, true);

        try {
            const result = await window.VlogAuth.login(email, pass);
            if (result.success) {
                window.location.hash = this.ROUTES.FEED;
                window.location.reload(); // Hard Reset para novos Tokens
            } else {
                this._showToast(result.message, "error");
                this._toggleBtnLoading(btn, false, 'ENTRAR NO VLOG <i class="fas fa-arrow-right ms-2"></i>');
            }
        } catch (err) {
            this._showToast("Erro no servidor central.", "error");
            this._toggleBtnLoading(btn, false, "TENTAR NOVAMENTE");
        }
    }

    async _executeSignup(form) {
        const btn = form.querySelector('button[type="submit"]');
        this._toggleBtnLoading(btn, true);

        const data = {
            fullName: form.querySelector('#signup-name').value,
            email: form.querySelector('#signup-email').value,
            password: form.querySelector('#signup-password').value,
            university: form.querySelector('#signup-university').value,
            referralCode: form.querySelector('#signup-referral')?.value || null
        };

        try {
            const result = await window.VlogAuth.register(data);
            if (result.success) {
                window.location.hash = this.ROUTES.FEED;
                window.location.reload();
            } else {
                this._showToast(result.message, "error");
                this._toggleBtnLoading(btn, false, "CONCLUIR CADASTRO");
            }
        } catch (err) {
            this._showToast("Falha ao registrar conta.", "error");
            this._toggleBtnLoading(btn, false, "CONCLUIR");
        }
    }

    async _handleRecoveryRequest(form) {
        const email = form.querySelector('#recovery-email').value;
        const btn = form.querySelector('button[type="submit"]');
        this._toggleBtnLoading(btn, true);
        this._state.recoveryEmail = email;

        const success = await window.VlogAuth.requestPasswordReset(email);
        if (success) {
            this._showToast("PIN enviado com sucesso!", "success");
            // Mudança de passo interna no recovery.html
            document.getElementById('recovery-step-1')?.classList.add('d-none');
            document.getElementById('recovery-step-2')?.classList.remove('d-none');
        } else {
            this._showToast("E-mail não localizado.", "error");
            this._toggleBtnLoading(btn, false, "ENVIAR CÓDIGO");
        }
    }

    async _handleRecoveryReset(form) {
        const pin = form.querySelector('#recovery-pin').value;
        const pass = form.querySelector('#recovery-new-password').value;
        const btn = form.querySelector('button[type="submit"]');

        this._toggleBtnLoading(btn, true);
        const success = await window.VlogAuth.confirmPasswordReset(this._state.recoveryEmail, pin, pass);
        
        if (success) {
            this._showToast("Senha redefinida! Acesse agora.", "success");
            window.location.hash = this.ROUTES.LOGIN;
        } else {
            this._showToast("PIN inválido.", "error");
            this._toggleBtnLoading(btn, false, "ATUALIZAR ACESSO");
        }
    }

    /**
     * ========================================================================
     * 5. GESTÃO DE UI E ATMOSFERA
     * ========================================================================
     */
    _exitSplashScreen() {
        if (!this._ui.splash) return;

        this._ui.splash.style.opacity = "0";
        this._ui.splash.style.pointerEvents = "none";

        setTimeout(() => {
            this._ui.splash.style.display = "none";
            this._ui.appView.style.display = "block";
            this._state.isAppReady = true;
            this._updateGlobalUI(window.location.hash.replace('#', ''));
        }, 800);
    }

    _updateGlobalUI(path) {
        if (!this._ui.nav) return;

        const isAuth = path.includes('/auth/');
        const isVisible = window.VlogAuth && window.VlogAuth.isAuthenticated && !isAuth;
        
        this._ui.nav.style.display = isVisible ? 'block' : 'none';

        if (isVisible) {
            document.querySelectorAll('.nav-item').forEach(item => {
                const link = item.getAttribute('href').replace('#', '');
                item.classList.toggle('active', path.startsWith(link));
            });
        }
    }

    _toggleBtnLoading(btn, isLoading, originalHtml = "") {
        if (!btn) return;
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>PROCESSANDO...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }

    _showGlobalLoader(show) {
        if (this._ui.loader) this._ui.loader.style.display = show ? 'block' : 'none';
    }

    _showToast(msg, type = 'info') {
        const container = this._ui.toastContainer;
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `vlog-toast glass-morphism border-${type} p-3 animate__animated animate__slideInRight shadow-lg`;
        
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${icons[type]} text-${type} me-3"></i>
                <span class="fw-bold text-white text-small">${msg}</span>
            </div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.replace('animate__slideInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 600);
        }, 4500);
    }

    _handleRoutingError(path) {
        this._ui.appView.innerHTML = `
            <div class="vh-100 d-flex flex-column align-items-center justify-content-center text-center p-5">
                <i class="fas fa-satellite-dish text-neon mb-4 fa-4x"></i>
                <h2 class="text-white fw-black">RECURSO INDISPONÍVEL</h2>
                <p class="text-muted">A tela ${path} falhou ao carregar. Verifique sua conexão.</p>
                <button class="btn-vlog-primary mt-4 px-5 py-3" onclick="location.hash='#/home/feed'">VOLTAR AO FEED</button>
            </div>
        `;
    }
}

/**
 * ============================================================================
 * BOOTSTRAP: Inicialização Automática da Instância Mestre
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    window.VlogMain = new VlogMainOrchestrator();
    window.VlogMain.start();
});

/**
 * ============================================================================
 * FIM DO MASTER ORCHESTRATOR v61.0.0
 * ESTE CÓDIGO É A ESPINHA DORSAL DO FRONTEND VLOGSTUDENTS ENTERPRISE.
 * ============================================================================
 */
