/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - MAIN ORCHESTRATOR v41.0.0
 * SISTEMA OPERACIONAL DO FRONTEND E MOTOR DE ROTEAMENTO SPA (NUCLEAR CORE)
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * MARCO DE VERSÃO v41.0.0:
 * - Event Relinking Logic: Resolve o erro de botões de login/signup não responsivos.
 * - Anti-Stall v3: Saída forçada da Splash em caso de latência crítica de rede.
 * - Industrial Route Guarding: Proteção de sessões via Neon DB Handshake.
 * - Global Telemetry Integration: Rastreamento de erros e performance em tempo real.
 * - Theme Engine Sync: Persistência de modo Dark/Light entre sessões.
 * ============================================================================
 */

class VlogMainOrchestrator {
    /**
     * CONSTRUTOR DO SISTEMA
     * Inicializa o mapeamento de rotas, repositórios de UI e estado operacional.
     */
    constructor() {
        // --- MAPEAMENTO DE ROTAS DO CAMPUS ---
        this.ROUTES = {
            // Segmento Público
            SPLASH: '/',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup',
            RECOVERY: '/auth/recovery',

            // Segmento Privado (Auth Required)
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

        // --- ESTADO DO NÚCLEO (SINGLE SOURCE OF TRUTH) ---
        this._state = {
            currentPath: null,
            previousPath: null,
            isAppReady: false,
            isProcessingRoute: false,
            bootStartTime: Date.now(),
            navigationHistory: []
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

        console.log("%c[SYSTEM] Orchestrator v41.0.0 Unified Booting...", "color: #CCFF00; font-weight: bold;");
    }

    /**
     * ========================================================================
     * 1. PROTOCOLO DE INICIALIZAÇÃO (BOOT SEQUENCE)
     * ========================================================================
     */
    async start() {
        console.group("[BOOT_SEQUENCE] Ativando Ecossistema Acadêmico");
        
        // ANTI-STALL PROTECTOR (8 segundos de garantia de UX)
        const safetyExit = setTimeout(() => {
            if (!this._state.isAppReady) {
                console.warn("[ANTI-STALL] Tempo limite de boot excedido. Forçando interface.");
                this._exitSplashScreen();
            }
        }, 8000);

        try {
            // A. Inicializa Kernel de Diagnóstico
            if (window.VlogTelemetry) {
                window.VlogTelemetry.init();
                window.VlogTelemetry.addBreadcrumb('system', 'Main Orchestrator Boot');
            }

            // B. Sincronização de Identidade (Handshake Neon DB)
            if (window.VlogAuth) {
                const authCheck = window.VlogAuth.checkAuthStatus();
                const timeout = new Promise((_, r) => setTimeout(() => r('Timeout'), 5000));
                
                // Tenta validar em 5s, se falhar, assume modo offline/cache
                await Promise.race([authCheck, timeout])
                    .catch(e => console.error("[BOOT] Auth Handshake demorou demais."));
            }

            // C. Configuração do Tema Visual
            this._applySavedTheme();

            // D. Ativação do Motor de Roteamento
            window.addEventListener('hashchange', () => this._handleRouteChange());
            await this._handleRouteChange();

            // E. Handlers Globais de Conectividade
            this._registerGlobalHandlers();

            // F. Conclusão da Transição de Splash
            clearTimeout(safetyExit);
            const elapsedTime = Date.now() - this._state.bootStartTime;
            const remainingTime = Math.max(2500 - elapsedTime, 0); // Mínimo de 2.5s de marca

            setTimeout(() => this._exitSplashScreen(), remainingTime);

        } catch (error) {
            console.error("[BOOT_FATAL] Erro no núcleoNode.js/Front:", error);
            this._exitSplashScreen(); // Permite ver o erro na tela
            this._handleCriticalFailure(error);
        }

        console.groupEnd();
    }

    /**
     * ========================================================================
     * 2. MOTOR DE ROTEAMENTO SPA (ROUTER ENGINE)
     * ========================================================================
     */
    async _handleRouteChange() {
        if (this._state.isProcessingRoute) return;
        this._state.isProcessingRoute = true;

        const hash = window.location.hash || '#/home/feed';
        const path = hash.replace('#', '');

        console.log(`%c[ROUTER] Sincronizando: ${path}`, "color: #00FBFF;");

        // 1. ROUTE GUARD (SEGURANÇA ACADÊMICA)
        const isAuthRoute = path.includes('/auth/');
        if (!isAuthRoute && (!window.VlogAuth || !window.VlogAuth.isAuthenticated)) {
            console.warn("[ROUTER] Área restrita. Redirecionando para Login.");
            window.location.hash = this.ROUTES.LOGIN;
            this._state.isProcessingRoute = false;
            return;
        }

        this._showLoader(true);

        try {
            // 2. BUSCA DE COMPONENTES (VIEWS)
            const templatePath = this._resolveTemplatePath(path);
            const response = await fetch(templatePath);
            if (!response.ok) throw new Error(`Status ${response.status}: Componente não localizado.`);
            
            const html = await response.text();

            // 3. INJEÇÃO ATÔMICA NO DOM
            this._ui.appView.classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');
            
            setTimeout(async () => {
                this._ui.appView.innerHTML = html;
                this._ui.appView.classList.remove('animate__fadeOut');
                this._ui.appView.classList.add('animate__fadeIn');

                // 4. BINDING DE EVENTOS (FIX DO BOTÃO)
                // Essencial: Vincula listeners de formulário toda vez que o HTML muda.
                this._attachScreenListeners(path);

                // 5. INICIALIZAÇÃO DE MÓDULOS DE NEGÓCIO
                this._initializeViewModules(path);

                // 6. ATUALIZAÇÃO DA UI DE NAVEGAÇÃO
                this._updateNavigationUI(path);
                
                window.scrollTo(0, 0);
            }, 150);

        } catch (error) {
            console.error("[ROUTER_ERROR]", error);
            this._handleRoutingError(error);
        } finally {
            this._showLoader(false);
            this._state.isProcessingRoute = false;
        }
    }

    _resolveTemplatePath(path) {
        if (path === '/' || path === '') return '/views/home/feed.html';
        return `/views${path}.html`;
    }

    /**
     * VINCULAÇÃO DE LISTENERS ESPECÍFICOS POR TELA
     * Resolve o erro de perda de escopo dos botões após a troca de rota.
     */
    _attachScreenListeners(path) {
        // --- LÓGICA DE LOGIN ---
        if (path === this.ROUTES.LOGIN) {
            const loginForm = document.getElementById('vlog-login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const email = document.getElementById('login-email').value;
                    const pass = document.getElementById('login-password').value;
                    const btn = document.getElementById('btn-login-submit');
                    
                    if (!email || !pass) {
                        this._showToast("Credenciais incompletas.", "warning");
                        return;
                    }

                    btn.disabled = true;
                    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>VALIDANDO...`;

                    const result = await window.VlogAuth.login(email, pass);
                    if (result.success) {
                        window.location.hash = this.ROUTES.FEED;
                        window.location.reload(); // Refresh para carregar novos Tokens JWT nos módulos
                    } else {
                        this._showToast(result.message, "error");
                        btn.disabled = false;
                        btn.innerHTML = `ENTRAR NO VLOG <i class="fas fa-arrow-right ms-2"></i>`;
                    }
                });
            }
        }

        // --- LÓGICA DE CADASTRO ---
        if (path === this.ROUTES.SIGNUP) {
            const signupForm = document.getElementById('vlog-signup-form');
            if (signupForm) {
                signupForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const btn = document.getElementById('btn-signup-submit');
                    btn.disabled = true;
                    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>ATIVANDO CONTA...`;

                    const userData = {
                        fullName: document.getElementById('signup-name').value,
                        email: document.getElementById('signup-email').value,
                        password: document.getElementById('signup-password').value,
                        university: document.getElementById('signup-university').value,
                        referralCode: document.getElementById('signup-referral')?.value || null
                    };

                    const result = await window.VlogAuth.register(userData);
                    if (result.success) {
                        window.location.hash = this.ROUTES.FEED;
                        window.location.reload();
                    } else {
                        this._showToast(result.message, "error");
                        btn.disabled = false;
                        btn.innerHTML = `CONCLUIR CADASTRO`;
                    }
                });
            }
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
     * 3. GESTÃO DE UI E ATMOSFERA (VISUAL KERNEL)
     * ========================================================================
     */
    _exitSplashScreen() {
        if (this._state.isAppReady || !this._ui.splash) return;
        
        console.log("[UI] Finalizando Splash e liberando Campus.");
        this._ui.splash.style.transition = "opacity 0.8s ease-out";
        this._ui.splash.style.opacity = "0";

        setTimeout(() => {
            this._ui.splash.style.display = "none";
            this._ui.appView.style.display = "block";
            this._state.isAppReady = true;
            this._updateNavigationUI(window.location.hash.replace('#', ''));
        }, 800);
    }

    _updateNavigationUI(path) {
        if (!this._ui.navContainer) return;
        
        const isAuth = path.includes('/auth/');
        const isVisible = window.VlogAuth && window.VlogAuth.isAuthenticated && !isAuth;
        
        this._ui.navContainer.style.display = isVisible ? 'block' : 'none';

        if (isVisible) {
            document.querySelectorAll('.nav-item').forEach(item => {
                const href = item.getAttribute('href').replace('#', '');
                item.classList.toggle('active', path.startsWith(href));
            });
        }
    }

    _applySavedTheme() {
        const theme = localStorage.getItem('vlog_theme_pref') || 'dark';
        this.setTheme(theme);
    }

    setTheme(theme) {
        this._ui.body.className = `${theme}-theme`;
        localStorage.setItem('vlog_theme_pref', theme);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#FFFFFF');
    }

    /**
     * ========================================================================
     * 4. PROTOCOLOS DE NOTIFICAÇÃO E ERRO (UTILITIES)
     * ========================================================================
     */
    _showLoader(show) {
        if (this._ui.pageLoader) this._ui.pageLoader.style.display = show ? 'block' : 'none';
    }

    _showToast(message, type = 'info') {
        const container = document.getElementById('vlog-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `vlog-toast glass-morphism border-${type} animate__animated animate__slideInRight`;
        
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

        toast.innerHTML = `
            <div class="d-flex align-items-center p-3">
                <i class="fas ${icons[type]} text-${type} me-3"></i>
                <div class="fw-bold text-white text-small">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.replace('animate__slideInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 600);
        }, 4000);
    }

    _registerGlobalHandlers() {
        // Monitor de Internet
        window.addEventListener('online', () => this._showToast("Conexão restaurada.", "success"));
        window.addEventListener('offline', () => this._showToast("Você está offline.", "warning"));

        // Handler global para 401 Unauthorized
        window.addEventListener('vlog_unauthorized', () => {
            this._showToast("Sessão expirada.", "error");
            window.VlogAuth.logout();
        });
    }

    _handleRoutingError(err) {
        this._ui.appView.innerHTML = `
            <div class="h-100 d-flex flex-column align-items-center justify-content-center text-center p-5">
                <i class="fas fa-satellite-dish text-neon mb-4" style="font-size: 5rem;"></i>
                <h2 class="fw-black text-white">ERRO DE CONEXÃO</h2>
                <p class="text-muted">Não conseguimos sintonizar o campus. Verifique sua rede.</p>
                <button class="btn-vlog-primary mt-4" onclick="location.reload()">TENTAR NOVAMENTE</button>
            </div>
        `;
    }

    _handleCriticalFailure(err) {
        console.error("CRITICAL_SYSTEM_FAILURE", err);
        this._showToast("Falha crítica no sistema acadêmico.", "error");
    }
}

/**
 * ============================================================================
 * BOOTSTRAP: Inicialização Automática
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    window.VlogMain = new VlogMainOrchestrator();
    window.VlogMain.start();
});

/**
 * ============================================================================
 * FIM DO MASTER ORCHESTRATOR v41.0.0
 * ZERO OMISSÕES | INDUSTRIAL ARCHITECTURE | MASTER READY
 * ============================================================================
 */
