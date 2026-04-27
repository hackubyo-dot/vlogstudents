/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - MAIN ORCHESTRATOR v51.0.0
 * SISTEMA OPERACIONAL DO FRONTEND | SPA ENGINE | ZERO FAIL PROTOCOL
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * MARCO DE VERSÃO v51.0.0:
 * - Global Event Delegation: Monitoramento de submissões no nível do 'document'.
 * - Anti-Stall v4: Saída de emergência da Splash Screen (8 segundos).
 * - Multi-Phase Recovery Logic: Gestão atômica do fluxo de Reset de Senha.
 * - Haptic Navigation Sync: Vibração em interações para Mobile Browsers.
 * - Stamped Content Injector: Motor de templates assíncronos com Fade-in.
 * - Route Guard Industrial: Handshake obrigatório com Neon DB e Auth Kernel.
 * ============================================================================
 */

class VlogMainOrchestrator {
    /**
     * CONSTRUTOR MESTRE
     * Centraliza a inteligência de rotas, estados de hardware e referências de UI.
     */
    constructor() {
        // --- DICIONÁRIO DE ROTAS DO ECOSSISTEMA ---
        this.ROUTES = {
            // Segmento Público (Livre)
            SPLASH: '/',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup',
            RECOVERY: '/auth/recovery',

            // Segmento Restrito (Requer Token JWT Válido)
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

        // --- REPOSITÓRIO DE ESTADO (SINGLE SOURCE OF TRUTH) ---
        this._state = {
            currentPath: null,
            previousPath: null,
            isAppReady: false,
            isProcessingRoute: false,
            bootStartTime: Date.now(),
            recoveryEmail: "", // Cache temporário para transição de passos no reset
            activeModules: new Set()
        };

        // --- MAPA DE HARDWARE VISUAL (DOM ELEMENTS) ---
        this._ui = {
            splash: document.getElementById('splash-screen'),
            appView: document.getElementById('app-router-view'),
            navContainer: document.getElementById('liquid-nav-container'),
            pageLoader: document.getElementById('global-page-loader'),
            toastContainer: document.getElementById('vlog-toast-container'),
            body: document.body
        };

        console.log("%c[SYSTEM] Orchestrator v51.0.0 Unified Engine Online.", "color: #CCFF00; font-weight: bold;");
    }

    /**
     * ========================================================================
     * 1. PROTOCOLO DE INICIALIZAÇÃO (BOOT SEQUENCE)
     * Executa a subida sequencial dos motores de sistema.
     * ========================================================================
     */
    async start() {
        console.group("[BOOT_SEQUENCE] Ativando Protocolos Master");
        
        // ANTI-STALL PROTECTOR (UX Guarantee)
        // Se o servidor ou rede travar, liberamos a tela em 8s para o usuário interagir.
        const safetyExit = setTimeout(() => {
            if (!this._state.isAppReady) {
                console.warn("[ANTI-STALL] Tempo de boot excedido. Forçando interface SPA.");
                this._exitSplashScreen();
            }
        }, 8000);

        try {
            // A. Inicialização de Telemetria e Diagnóstico
            if (window.VlogTelemetry) window.VlogTelemetry.init();

            // B. DELEGAÇÃO GLOBAL DE EVENTOS (ZERO FAIL)
            // Resolve o erro de botões mortos: Capturamos o submit no 'document'.
            this._bindGlobalEvents();

            // C. Auditoria de Identidade (Handshake com Neon DB via Auth Kernel)
            if (window.VlogAuth) {
                await window.VlogAuth.checkAuthStatus();
            } else {
                console.error("[CRITICAL] VlogAuth Kernel não localizado!");
            }

            // D. Ativação do Motor de Roteamento SPA
            window.addEventListener('hashchange', () => this._handleRouteChange());
            await this._handleRouteChange(); // Processa a rota inicial

            // E. Handlers de Monitoramento de Rede e Sessão
            this._registerSystemHandlers();

            // F. Liberação da Splash Screen Cinematográfica
            clearTimeout(safetyExit);
            const loadTime = Date.now() - this._state.bootStartTime;
            const remainingSplash = Math.max(2000 - loadTime, 0); // Mínimo de 2s para estética

            setTimeout(() => this._exitSplashScreen(), remainingSplash);

        } catch (error) {
            console.error("[BOOT_FATAL] Erro catastrófico no motor principal:", error);
            this._exitSplashScreen();
            this._showToast("Falha na sincronização do campus central.", "error");
        }

        console.groupEnd();
    }

    /**
     * ========================================================================
     * 2. MOTOR DE DELEGAÇÃO GLOBAL (EVENT DELEGATION)
     * Esta é a chave para o funcionamento 100% dos botões dinâmicos.
     * ========================================================================
     */
    _bindGlobalEvents() {
        console.log("[SYSTEM] Vinculando Delegatários Globais de Eventos...");

        // --- CAPTURA DE SUBMISSÕES DE FORMULÁRIOS (QUALQUER TELA) ---
        document.addEventListener('submit', async (e) => {
            const formId = e.target.id;
            
            // Handler: PROTOCOLO DE LOGIN
            if (formId === 'vlog-login-form') {
                e.preventDefault();
                await this._handleLoginSubmission(e.target);
            }

            // Handler: PROTOCOLO DE REGISTRO
            if (formId === 'vlog-signup-form') {
                e.preventDefault();
                await this._handleSignupSubmission(e.target);
            }

            // Handler: RECUPERAÇÃO PASSO 1 (SOLICITAR PIN)
            if (formId === 'form-recovery-request') {
                e.preventDefault();
                await this._handleRecoveryRequest(e.target);
            }

            // Handler: RECUPERAÇÃO PASSO 2 (RESETAR SENHA)
            if (formId === 'form-recovery-reset') {
                e.preventDefault();
                await this._handleRecoveryReset(e.target);
            }
        });

        // --- CAPTURA DE CLIQUES (UX & HAPTIC FEEDBACK) ---
        document.addEventListener('click', (e) => {
            const clickable = e.target.closest('button, .nav-item, .social-circle, .btn-fidelity-back, a');
            if (clickable) {
                // Micro-vibração industrial para browsers compatíveis
                if ("vibrate" in navigator) navigator.vibrate(10);
            }
        });
    }

    /**
     * ========================================================================
     * 3. HANDLERS DE AÇÃO DE NEGÓCIO (BUSINESS LOGIC)
     * Gerencia a comunicação entre a UI e o Kernel de Autenticação.
     * ========================================================================
     */

    // Lógica de Login
    async _handleLoginSubmission(form) {
        const emailInput = form.querySelector('#login-email');
        const passInput = form.querySelector('#login-password');
        const btn = form.querySelector('button[type="submit"]');

        if (!emailInput?.value || !passInput?.value) {
            return this._showToast("Credenciais acadêmicas incompletas.", "warning");
        }

        this._toggleBtnLoading(btn, true);

        try {
            // Chamada ao Kernel v45
            const result = await window.VlogAuth.login(emailInput.value, passInput.value);

            if (result.success) {
                this._showToast("Identidade validada com sucesso!", "success");
                window.location.hash = this.ROUTES.FEED;
                // RELOAD NUCLEAR: Essencial para injetar novos tokens JWT nos cabeçalhos de todos os módulos
                window.location.reload(); 
            } else {
                this._showToast(result.message || "Acesso negado.", "error");
                this._toggleBtnLoading(btn, false, 'ENTRAR NO VLOG <i class="fas fa-chevron-right ms-2"></i>');
            }
        } catch (err) {
            console.error("[LOGIN_SUBMIT_ERR]", err);
            this._showToast("O servidor master não respondeu.", "error");
            this._toggleBtnLoading(btn, false, "TENTAR NOVAMENTE");
        }
    }

    // Lógica de Registro (Signup)
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
                this._showToast("Conta criada! Bem-vindo ao ecossistema.", "success");
                window.location.hash = this.ROUTES.FEED;
                window.location.reload();
            } else {
                this._showToast(result.message, "error");
                this._toggleBtnLoading(btn, false, "CONCLUIR CADASTRO ACADÊMICO");
            }
        } catch (err) {
            this._showToast("Falha no motor de registro.", "error");
            this._toggleBtnLoading(btn, false, "CONCLUIR CADASTRO");
        }
    }

    // Lógica de Recuperação - Passo 1
    async _handleRecoveryRequest(form) {
        const email = form.querySelector('#recovery-email').value;
        const btn = form.querySelector('button[type="submit"]');
        
        this._toggleBtnLoading(btn, true);
        this._state.recoveryEmail = email; // Persistência em memória para o passo 2

        try {
            const success = await window.VlogAuth.requestPasswordReset(email);
            if (success) {
                this._showToast("Código PIN enviado ao seu e-mail.", "success");
                // Transição de tela local (Fidelity Recovery UI)
                if (window.VlogRecoveryUI) {
                    window.VlogRecoveryUI.showStep2();
                } else {
                    // Fallback se o objeto da view não estiver pronto
                    document.getElementById('recovery-step-1').classList.add('d-none');
                    document.getElementById('recovery-step-2').classList.remove('d-none');
                }
            } else {
                this._showToast("Estudante não identificado na base.", "error");
                this._toggleBtnLoading(btn, false, "ENVIAR CÓDIGO");
            }
        } catch (e) {
            this._showToast("Erro ao solicitar PIN.", "error");
            this._toggleBtnLoading(btn, false, "ENVIAR CÓDIGO");
        }
    }

    // Lógica de Recuperação - Passo 2 (Reset)
    async _handleRecoveryReset(form) {
        const pin = form.querySelector('#recovery-pin').value;
        const pass = form.querySelector('#recovery-new-password').value;
        const btn = form.querySelector('button[type="submit"]');

        this._toggleBtnLoading(btn, true);

        try {
            const success = await window.VlogAuth.confirmPasswordReset(this._state.recoveryEmail, pin, pass);
            if (success) {
                this._showToast("Segurança atualizada! Faça login.", "success");
                window.location.hash = this.ROUTES.LOGIN;
            } else {
                this._showToast("PIN inválido ou expirado.", "error");
                this._toggleBtnLoading(btn, false, "ATUALIZAR SENHA");
            }
        } catch (e) {
            this._showToast("Erro na redefinição de chave.", "error");
            this._toggleBtnLoading(btn, false, "ATUALIZAR SENHA");
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

        // Sanitização de Hash (URL Clean)
        const hash = window.location.hash || '#/home/feed';
        const path = hash.split('?')[0].replace('#', '');
        
        console.log(`%c[ROUTER] SPA Navigating to: ${path}`, "color: #00FBFF;");

        // A. ROUTE GUARD (SEGURANÇA ACADÊMICA)
        // Bloqueia acesso a rotas privadas se não houver autenticação validada
        const isAuthRoute = path.includes('/auth/');
        if (!isAuthRoute && (!window.VlogAuth || !window.VlogAuth.isAuthenticated)) {
            console.warn("[ROUTER] Área restrita detectada. Redirecionando para Login.");
            window.location.hash = this.ROUTES.LOGIN;
            this._state.isProcessingRoute = false;
            return;
        }

        this._showGlobalLoader(true);

        try {
            // B. BUSCA DE TEMPLATE HTML ASSÍNCRONO
            const response = await fetch(`/views${path}.html`);
            if (!response.ok) throw new Error(`Status ${response.status}: Componente não localizado.`);
            const html = await response.text();

            // C. INJEÇÃO ATÔMICA E ANIMAÇÃO DE ENTRADA (STAMPED)
            this._ui.appView.classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
            
            setTimeout(() => {
                this._ui.appView.innerHTML = html;
                this._ui.appView.classList.remove('animate__fadeOut');
                this._ui.appView.classList.add('animate__fadeIn');

                // D. SINCRONIZAÇÃO DE MÓDULOS ESPECÍFICOS (JS SYNC)
                this._initializeViewModules(path);

                // E. ATUALIZAÇÃO DA UI GLOBAL (NAVBAR, ESTADOS)
                this._updateGlobalUIState(path);
                
                window.scrollTo(0, 0);
            }, 150);

        } catch (error) {
            console.error("[ROUTER_ERR] Falha ao carregar view:", error);
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
        
        // Exibe ou esconde a barra de navegação baseada no estado de login
        this._ui.navContainer.style.display = isVisible ? 'block' : 'none';

        // Atualiza a classe 'active' no item de navegação correspondente
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
     * 6. MONITORAMENTO E NOTIFICAÇÕES (SYSTEM KERNEL)
     * ========================================================================
     */
    _registerSystemHandlers() {
        // Monitoramento de Conectividade Internet
        window.addEventListener('online', () => this._showToast("Conexão restabelecida.", "success"));
        window.addEventListener('offline', () => this._showToast("Você está offline. Algumas funções podem falhar.", "warning"));

        // Handler Global para 401 Unauthorized (Expulsão por token inválido)
        window.addEventListener('vlog_unauthorized', () => {
            this._showToast("Sua sessão expirou. Faça login novamente.", "error");
            if (window.VlogAuth) window.VlogAuth.logout();
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
        
        const icons = { 
            success: 'fa-check-circle', 
            error: 'fa-times-circle', 
            warning: 'fa-exclamation-triangle', 
            info: 'fa-info-circle' 
        };
        
        toast.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas ${icons[type]} text-${type} me-3"></i>
                <span class="fw-bold text-white text-small">${msg}</span>
            </div>
        `;

        container.appendChild(toast);

        // Auto-destruição do Toast
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
                <p class="text-muted">Não conseguimos sintonizar os dados desta tela. Verifique sua conexão.</p>
                <button class="btn-fidelity-primary mt-4 px-5" onclick="location.reload()">RECONECTAR SISTEMA</button>
                <p class="text-xxs text-white-50 mt-4 opacity-25">STAMP_REF: ${err.message}</p>
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
    // Registra o Singleton Global
    window.VlogMain = new VlogMainOrchestrator();

    // Dispara a ignição do ecossistema
    window.VlogMain.start();
});

/**
 * ============================================================================
 * FIM DO MASTER ORCHESTRATOR v51.0.0
 * ESTE CÓDIGO É A ESPINHA DORSAL DO FRONTEND VLOGSTUDENTS ENTERPRISE.
 * ============================================================================
 */
