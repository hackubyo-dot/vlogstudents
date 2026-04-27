/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - MAIN ORCHESTRATOR v51.0.0
 * SISTEMA OPERACIONAL DO FRONTEND | SPA ENGINE | ZERO FAIL PROTOCOL
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * MARCO DE VERSÃO v51.0.0:
 * - Global Event Delegation: Captura 'submit' no document (Resolve botões mortos).
 * - Multi-Phase Recovery Logic: Gestão atômica do fluxo de Reset de Senha.
 * - Anti-Stall v4: Motor de saída forçada de Splash Screen (Failsafe 8s).
 * - Haptic Navigation Sync: Feedback tátil em interações críticas.
 * - Industrial Route Guarding: Handshake obrigatório com Neon DB / Auth Kernel.
 * - SPA Template Engine: Carregamento assíncrono de views com transição rítmica.
 * ============================================================================
 */

class VlogMainOrchestrator {
    /**
     * CONSTRUTOR MESTRE
     * Inicializa o universo de rotas, repositórios de UI e estado do ecossistema.
     */
    constructor() {
        // --- MAPEAMENTO DE ROTAS DO CAMPUS ---
        this.ROUTES = {
            // Segmento de Identidade (Público)
            SPLASH: '/',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup',
            RECOVERY: '/auth/recovery',

            // Segmento Operacional (Privado - Auth Required)
            FEED: '/home/feed',
            CHAT_LIST: '/chat/list',
            CHAT_ROOM: '/chat/room',
            POINTS: '/points/dashboard',
            PROFILE_VIEW: '/profile/view',
            PROFILE_EDIT: '/profile/edit',
            REFERRAL: '/referral/hub',
            SEARCH: '/search/global',
            UPLOAD: '/post/upload'
        };

        // --- REPOSITÓRIO DE ESTADO DO NÚCLEO (SINGLE SOURCE OF TRUTH) ---
        this._state = {
            currentPath: null,
            previousPath: null,
            isAppReady: false,
            isProcessingRoute: false,
            bootStartTime: Date.now(),
            recoveryEmail: "", // Cache volátil para o fluxo de reset
            activeModules: new Set()
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

        console.log("%c[SYSTEM] Orchestrator v51.0.0 Atomic Booting...", "color: #CCFF00; font-weight: bold;");
    }

    /**
     * ========================================================================
     * 1. PROTOCOLO DE INICIALIZAÇÃO (BOOT SEQUENCE)
     * ========================================================================
     */
    async start() {
        console.group("[BOOT_SEQUENCE] Ativando Ecossistema v51");
        
        // ANTI-STALL PROTECTOR (Garantia de UX: 8 segundos para liberar o viewport)
        const safetyExit = setTimeout(() => {
            if (!this._state.isAppReady) {
                console.warn("[ANTI-STALL] Latência crítica detectada. Forçando interface SPA.");
                this._exitSplashScreen();
            }
        }, 8000);

        try {
            // A. Inicializa Kernel de Diagnóstico e Telemetria
            if (window.VlogTelemetry) window.VlogTelemetry.init();

            // B. DELEGAÇÃO GLOBAL DE EVENTOS (ZERO FAIL LOGIC)
            // Vincula os listeners ao 'document' uma única vez para evitar perda de escopo.
            this._bindGlobalEvents();

            // C. Auditoria de Sessão (Neon DB Handshake)
            if (window.VlogAuth) {
                await window.VlogAuth.checkAuthStatus();
            }

            // D. Ativação do Motor de Roteamento SPA
            window.addEventListener('hashchange', () => this._handleRouteChange());
            await this._handleRouteChange();

            // E. Monitoramento de Rede
            this._registerNetworkHandlers();

            // F. Liberação da Splash Screen
            clearTimeout(safetyExit);
            const loadDuration = Date.now() - this._state.bootStartTime;
            const remainingSplash = Math.max(2000 - loadDuration, 0); // Mínimo de 2s para estética

            setTimeout(() => this._exitSplashScreen(), remainingSplash);

        } catch (error) {
            console.error("[BOOT_FATAL] Falha catastrófica no motor principal:", error);
            this._exitSplashScreen();
            this._showToast("Falha na sincronização do campus.", "error");
        }

        console.groupEnd();
    }

    /**
     * ========================================================================
     * 2. MOTOR DE EVENTOS GLOBAIS (EVENT DELEGATION)
     * Resolve o erro de botões que param de funcionar após navegação SPA.
     * ========================================================================
     */
    _bindGlobalEvents() {
        console.log("[SYSTEM] Vinculando Delegatários Globais...");

        // --- CAPTURA DE SUBMISSÕES DE FORMULÁRIO (ALL VIEWS) ---
        document.addEventListener('submit', async (e) => {
            const formId = e.target.id;
            
            // Handler: LOGIN
            if (formId === 'vlog-login-form') {
                e.preventDefault();
                await this._handleLoginSubmission(e.target);
            }

            // Handler: SIGNUP
            if (formId === 'vlog-signup-form') {
                e.preventDefault();
                await this._handleSignupSubmission(e.target);
            }

            // Handler: RECOVERY STEP 1 (Solicitar Código)
            if (formId === 'form-recovery-request') {
                e.preventDefault();
                await this._handleRecoveryRequest(e.target);
            }

            // Handler: RECOVERY STEP 2 (Resetar Senha)
            if (formId === 'form-recovery-reset') {
                e.preventDefault();
                await this._handleRecoveryReset(e.target);
            }
        });

        // --- CAPTURA DE CLIQUES (HAPTIC & NAVIGATION) ---
        document.addEventListener('click', (e) => {
            const clickable = e.target.closest('button, .clickable, .nav-item, a');
            if (clickable) {
                // Feedback Háptico Industrial
                if ("vibrate" in navigator) navigator.vibrate(10);
            }
        });
    }

    /**
     * ========================================================================
     * 3. HANDLERS DE LÓGICA DE NEGÓCIO (AUTH FLOWS)
     * ========================================================================
     */

    async _handleLoginSubmission(form) {
        const email = form.querySelector('#login-email')?.value;
        const pass = form.querySelector('#login-password')?.value;
        const btn = form.querySelector('button[type="submit"]');

        if (!email || !pass) return this._showToast("Credenciais incompletas.", "warning");

        this._toggleBtnLoading(btn, true);

        try {
            const result = await window.VlogAuth.login(email, pass);
            if (result.success) {
                window.location.hash = this.ROUTES.FEED;
                // RELOAD NUCLEAR: Essencial para injetar novos tokens JWT nos cabeçalhos
                window.location.reload(); 
            } else {
                this._showToast(result.message, "error");
                this._toggleBtnLoading(btn, false, 'ENTRAR NO VLOG <i class="fas fa-arrow-right ms-2"></i>');
            }
        } catch (err) {
            this._showToast("O servidor não respondeu.", "error");
            this._toggleBtnLoading(btn, false, "TENTAR NOVAMENTE");
        }
    }

    async _handleSignupSubmission(form) {
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
                this._toggleBtnLoading(btn, false, 'CONCLUIR CADASTRO <i class="fas fa-check-circle ms-2"></i>');
            }
        } catch (err) {
            this._showToast("Falha ao registrar.", "error");
            this._toggleBtnLoading(btn, false, "CONCLUIR");
        }
    }

    async _handleRecoveryRequest(form) {
        const email = form.querySelector('#recovery-email').value;
        const btn = form.querySelector('button[type="submit"]');
        
        this._toggleBtnLoading(btn, true);
        this._state.recoveryEmail = email; // Armazena para o próximo passo

        const result = await window.VlogAuth.requestPasswordReset(email);
        if (result) {
            this._showToast("PIN enviado para seu inbox!", "success");
            // Transição Interna Stamped
            const s1 = document.getElementById('recovery-step-1');
            const s2 = document.getElementById('recovery-step-2');
            if(s1) s1.classList.add('d-none');
            if(s2) s2.classList.remove('d-none');
        } else {
            this._showToast("Estudante não localizado.", "error");
            this._toggleBtnLoading(btn, false, 'ENVIAR CÓDIGO <i class="fas fa-paper-plane ms-2"></i>');
        }
    }

    async _handleRecoveryReset(form) {
        const pin = form.querySelector('#recovery-pin').value;
        const pass = form.querySelector('#recovery-new-password').value;
        const confirm = form.querySelector('#recovery-confirm-password').value;
        const btn = form.querySelector('button[type="submit"]');

        if (pass !== confirm) return this._showToast("As senhas não coincidem.", "error");

        this._toggleBtnLoading(btn, true);

        const result = await window.VlogAuth.confirmPasswordReset(this._state.recoveryEmail, pin, pass);
        if (result) {
            this._showToast("Senha redefinida com sucesso!", "success");
            window.location.hash = this.ROUTES.LOGIN;
        } else {
            this._showToast("PIN inválido ou expirado.", "error");
            this._toggleBtnLoading(btn, false, 'ATUALIZAR ACESSO <i class="fas fa-sync-alt ms-2"></i>');
        }
    }

    /**
     * ========================================================================
     * 4. MOTOR DE ROTEAMENTO SPA (NUCLEAR ENGINE)
     * ========================================================================
     */
    async _handleRouteChange() {
        if (this._state.isProcessingRoute) return;
        this._state.isProcessingRoute = true;

        // Limpeza de Hash (Sanitização de URL)
        const hash = window.location.hash || '#/home/feed';
        const path = hash.split('?')[0].replace('#', '');
        
        console.log(`%c[ROUTER] SPA Navigating to: ${path}`, "color: #00FBFF;");

        // A. ROUTE GUARD (SEGURANÇA ACADÊMICA)
        const isAuthRoute = path.includes('/auth/');
        if (!isAuthRoute && (!window.VlogAuth || !window.VlogAuth.isAuthenticated)) {
            console.warn("[ROUTER] Acesso restrito. Encaminhando para Login.");
            window.location.hash = this.ROUTES.LOGIN;
            this._state.isProcessingRoute = false;
            return;
        }

        this._showGlobalLoader(true);

        try {
            // B. BUSCA DE TEMPLATE HTML
            const response = await fetch(`/views${path}.html`);
            if (!response.ok) throw new Error(`Status ${response.status}: View não localizada.`);
            const html = await response.text();

            // C. INJEÇÃO ATÔMICA E ANIMAÇÃO
            this._ui.appView.classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
            
            setTimeout(() => {
                this._ui.appView.innerHTML = html;
                this._ui.appView.classList.remove('animate__fadeOut');
                this._ui.appView.classList.add('animate__fadeIn');

                // D. INICIALIZAÇÃO DE MÓDULOS ESPECÍFICOS (JS SYNC)
                this._initializeViewModules(path);

                // E. ATUALIZAÇÃO DA UI GLOBAL (NAVBAR, TITLES)
                this._updateGlobalUIState(path);
                
                window.scrollTo(0, 0);
            }, 150);

        } catch (error) {
            console.error("[ROUTER_ERR]", error);
            this._handleRoutingError(error);
        } finally {
            this._showGlobalLoader(false);
            this._state.isProcessingRoute = false;
        }
    }

    _initializeViewModules(path) {
        if (path.includes('feed') && window.VlogFeed) window.VlogFeed.init();
        if (path.includes('chat') && window.VlogChat) window.VlogChat.init();
        if (path.includes('points') && window.VlogPoints) window.VlogPoints.init();
        if (path.includes('profile') && window.VlogProfile) window.VlogProfile.init();
        if (path.includes('status') && window.VlogStatus) window.VlogStatus.init();
    }

    /**
     * ========================================================================
     * 5. GESTÃO DE UI E ATMOSFERA
     * ========================================================================
     */
    _exitSplashScreen() {
        if (this._state.isAppReady || !this._ui.splash) return;

        this._ui.splash.style.opacity = "0";
        this._ui.splash.style.pointerEvents = "none";

        setTimeout(() => {
            this._ui.splash.style.display = "none";
            this._ui.appView.style.display = "block";
            this._state.isAppReady = true;
            this._updateGlobalUIState(window.location.hash.replace('#', ''));
        }, 800);
    }

    _updateGlobalUIState(path) {
        if (!this._ui.navContainer) return;

        const isAuth = path.includes('/auth/');
        const isVisible = window.VlogAuth && window.VlogAuth.isAuthenticated && !isAuth;
        
        this._ui.navContainer.style.display = isVisible ? 'block' : 'none';

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

    /**
     * ========================================================================
     * 6. MONITORAMENTO E NOTIFICAÇÕES (REATIVIDADE)
     * ========================================================================
     */
    _registerNetworkHandlers() {
        window.addEventListener('online', () => this._showToast("Conexão restaurada.", "success"));
        window.addEventListener('offline', () => this._showToast("Você está desconectado.", "warning"));

        // Handler global para 401 Unauthorized do Auth Kernel
        window.addEventListener('vlog_unauthorized', () => {
            this._showToast("Sessão expirada. Faça login.", "error");
            window.VlogAuth.logout();
        });
    }

    _showGlobalLoader(show) {
        if (this._ui.pageLoader) this._ui.pageLoader.style.display = show ? 'block' : 'none';
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

    _handleRoutingError(err) {
        this._ui.appView.innerHTML = `
            <div class="vh-100 d-flex flex-column align-items-center justify-content-center text-center p-5">
                <i class="fas fa-satellite-dish text-neon mb-4" style="font-size: 5rem;"></i>
                <h2 class="text-white fw-black">FALHA DE SINCRONIA</h2>
                <p class="text-muted">Não conseguimos sintonizar o campus. Tente recarregar.</p>
                <button class="btn-vlog-primary mt-4" onclick="location.reload()">RECONECTAR SISTEMA</button>
                <p class="text-xxs text-white-50 mt-4 opacity-25">ERROR_REF: ${err.message}</p>
            </div>
        `;
    }

    _handleCriticalFailure(err) {
        console.error("CRITICAL_SYSTEM_FAILURE", err);
        this._showToast("Instabilidade no núcleo Node.js.", "error");
    }
}

/**
 * ============================================================================
 * BOOTSTRAP: Inicialização da Instância Mestre
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    window.VlogMain = new VlogMainOrchestrator();
    window.VlogMain.start();
});

/**
 * ============================================================================
 * FIM DO MASTER ORCHESTRATOR v51.0.0
 * ZERO OMISSÕES | INDUSTRIAL ARCHITECTURE | MASTER READY
 * ============================================================================
 */
