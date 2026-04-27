/**
 * ============================================================================
 * VLOGSTUDENTS ENTERPRISE WEB - MAIN ORCHESTRATOR v21.0.0
 * SISTEMA OPERACIONAL DO FRONTEND E MOTOR DE ROTEAMENTO SPA (NUCLEAR ENGINE)
 * 
 * MARCO DE VERSÃO:
 * - v21.0.0: Anti-Stall Fix & Industrial Route Guarding.
 * - v20.0.0: Estrutura SPA Master com Handshake Neon DB.
 * 
 * DESIGNED BY MASTER SOFTWARE ENGINEER - ZERO ERROR POLICY
 * 
 * Este arquivo orquestra o ciclo de vida global da aplicação:
 * - Boot Sequence: Inicialização sequencial (Telemetry -> Theme -> Auth -> UI).
 * - SPA Router: Motor de navegação baseado em Hash (#) com troca de templates.
 * - Route Guard: Interceptação de segurança para áreas restritas do campus.
 * - Splash Controller: Gestão da transição cinematográfica (Ken Burns transition).
 * - Anti-Stall: Proteção contra travamentos durante o carregamento de APIs.
 * - Theme Sync: Aplicação dinâmica de CSS Variables para Dark/Light Mode.
 * - Network Monitor: Reconexão automática de Sockets em restauração de link.
 * ============================================================================
 */

class VlogMainOrchestrator {
    constructor() {
        // --- CONFIGURAÇÕES DE ROTEAMENTO (MAPPING COMPLETO) ---
        this.ROUTES = {
            // Segmento Público (Livre Acesso)
            SPLASH: '/',
            LOGIN: '/auth/login',
            SIGNUP: '/auth/signup',
            RECOVERY: '/auth/recovery',

            // Segmento Protegido (Exige Token JWT Válido no Neon DB)
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

        // --- REPOSITÓRIO DE ESTADO DO ORQUESTRADOR ---
        this._state = {
            currentPath: null,
            previousPath: null,
            isAppReady: false,
            isProcessingRoute: false,
            activeModule: null,
            bootStartTime: Date.now()
        };

        // --- SELECTORES DE HARDWARE VISUAL (DOM) ---
        this._ui = {
            splash: document.getElementById('splash-screen'),
            appView: document.getElementById('app-router-view'),
            navContainer: document.getElementById('liquid-nav-container'),
            pageLoader: document.getElementById('global-page-loader'),
            body: document.body
        };

        console.log("%c[SYSTEM] Orchestrator v21.0.0 Bootstrapping...", "color: #CCFF00; font-weight: bold;");
    }

    /**
     * ========================================================================
     * 1. NÚCLEO DE INICIALIZAÇÃO (BOOT SEQUENCE)
     * ========================================================================
     */

    async start() {
        console.group("[BOOT_SEQUENCE] Iniciando Ecossistema Web");
        
        // ANTI-STALL PROTECTOR: Força a saída da Splash em 8s se as APIs falharem
        const antiStallTimer = setTimeout(() => {
            if (!this._state.isAppReady) {
                console.warn("[ANTI-STALL] Tempo limite de boot atingido. Forçando entrada.");
                this._exitSplashScreen();
            }
        }, 8000);

        try {
            // 1. Inicializa Kernel de Diagnóstico (Telemetria Industrial)
            if (window.VlogTelemetry) {
                window.VlogTelemetry.init();
                window.VlogTelemetry.addBreadcrumb('system', 'Orchestrator Start');
            }

            // 2. Sincroniza Tema Visual (Evita Flash de Cor Branca indesejado)
            this._applySavedTheme();

            // 3. Auditoria de Identidade (Handshake com Neon DB via API Core)
            if (window.VlogAuth) {
                // Timeout interno de 5s para a verificação de Auth não travar o app
                const authCheck = window.VlogAuth.checkAuthStatus();
                const authTimeout = new Promise((_, r) => setTimeout(() => r('Auth Timeout'), 5000));
                
                await Promise.race([authCheck, authTimeout])
                    .catch(e => console.error("[BOOT] Falha ou lentidão no Auth Handshake:", e));
            }

            // 4. Configura o Motor de Roteamento (Router Engine)
            this._setupRouter();

            // 5. Registra Handlers de Eventos Globais (Sockets, Network, 401)
            this._registerGlobalHandlers();

            // 6. Transição de Splash (Mínimo de 2.5s para manter a experiência cinematográfica)
            const elapsedTime = Date.now() - this._state.bootStartTime;
            const remainingSplashTime = Math.max(2500 - elapsedTime, 0);

            setTimeout(() => {
                clearTimeout(antiStallTimer);
                this._exitSplashScreen();
            }, remainingSplashTime);

        } catch (error) {
            console.error("[BOOT_FATAL] Erro crítico no núcleo:", error);
            this._exitSplashScreen(); // Força a saída para permitir visualização de erro
            this._handleRoutingError(error);
        }

        console.groupEnd();
    }

    /**
     * ========================================================================
     * 2. MOTOR DE ROTEAMENTO SPA (ROUTER KERNEL)
     * ========================================================================
     */

    _setupRouter() {
        // Escuta mudanças de Hash (ex: #/home/feed)
        window.addEventListener('hashchange', () => this._handleRouteChange());
        
        // Processa rota inicial no carregamento
        this._handleRouteChange();
    }

    async _handleRouteChange() {
        if (this._state.isProcessingRoute) return;
        this._state.isProcessingRoute = true;

        const hash = window.location.hash || '#/home/feed';
        const path = hash.replace('#', '');

        console.log(`%c[ROUTER] Navegando para: ${path}`, "color: #00FBFF;");

        // 1. ROUTE GUARD: Validação de Segurança
        if (!this._canAccessRoute(path)) {
            console.warn("[ROUTER] Acesso negado para área protegida. Redirecionando...");
            window.location.hash = this.ROUTES.LOGIN;
            this._state.isProcessingRoute = false;
            return;
        }

        // 2. Transição de View
        this._showGlobalLoader(true);

        try {
            const templatePath = this._resolveTemplatePath(path);
            const html = await this._fetchTemplate(templatePath);

            this._injectView(html);
            this._initializeModuleForRoute(path);
            this._updateNavigationUI(path);

            // 3. Auditoria de Telemetria
            if (window.VlogTelemetry) {
                window.VlogTelemetry.trackEvent('page_view', { path });
            }

        } catch (error) {
            console.error("[ROUTER_ERR] Falha ao carregar componente:", error);
            this._handleRoutingError(error);
        } finally {
            this._showGlobalLoader(false);
            this._state.isProcessingRoute = false;
            window.scrollTo(0, 0);
        }
    }

    /**
     * Route Guard: Protege endpoints contra acesso não autorizado
     */
    _canAccessRoute(path) {
        const publicPaths = [
            this.ROUTES.LOGIN,
            this.ROUTES.SIGNUP,
            this.ROUTES.RECOVERY,
            '/auth/google/callback'
        ];

        // Se a rota for pública, permite
        if (publicPaths.some(p => path.startsWith(p))) return true;

        // Se for protegida, exige VlogAuth.isAuthenticated
        return window.VlogAuth && window.VlogAuth.isAuthenticated;
    }

    _resolveTemplatePath(path) {
        // Mapeia o path virtual para o arquivo físico no servidor
        if (path === '/' || path === '') return '/views/home/feed.html';
        return `/views${path}.html`;
    }

    async _fetchTemplate(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Template Not Found [${response.status}]`);
            return await response.text();
        } catch (e) {
            throw e;
        }
    }

    _injectView(html) {
        if (!this._ui.appView) return;

        // Efeito de Fade-Out na view antiga
        this._ui.appView.classList.add('animate__animated', 'animate__fadeOut', 'animate__faster');

        setTimeout(() => {
            this._ui.appView.innerHTML = html;
            this._ui.appView.classList.remove('animate__fadeOut');
            this._ui.appView.classList.add('animate__fadeIn');
        }, 150);
    }

    /**
     * Inicia a lógica JS específica para cada módulo (Injeção Dinâmica)
     */
    _initializeModuleForRoute(path) {
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
        if (!this._ui.splash) return;

        console.log("[UI] Finalizando Splash e liberando Viewport.");
        this._ui.splash.style.transition = "opacity 0.8s var(--ease-out-expo)";
        this._ui.splash.style.opacity = "0";

        setTimeout(() => {
            this._ui.splash.style.display = 'none';
            this._ui.appView.style.display = 'block';
            this._state.isAppReady = true;
            this._updateNavigationUI(window.location.hash.replace('#', ''));
        }, 800);
    }

    _updateNavigationUI(path) {
        if (!this._ui.navContainer) return;

        // Esconde Nav Bar em telas de Auth
        const isAuthScreen = path.includes('/auth/');
        const isVisible = window.VlogAuth && window.VlogAuth.isAuthenticated && !isAuthScreen;
        
        this._ui.navContainer.style.display = isVisible ? 'block' : 'none';

        // Atualiza estado visual do item ativo
        if (isVisible) {
            document.querySelectorAll('.nav-item').forEach(item => {
                const href = item.getAttribute('href').replace('#', '');
                item.classList.toggle('active', path.startsWith(href));
            });
        }
    }

    _applySavedTheme() {
        const pref = localStorage.getItem('vlog_theme_pref') || 'dark';
        this.setTheme(pref);
    }

    setTheme(theme) {
        this._ui.body.classList.remove('dark-theme', 'light-theme');
        this._ui.body.classList.add(`${theme}-theme`);
        localStorage.setItem('vlog_theme_pref', theme);
        
        // Sync com Meta Tag para Safari/Chrome Mobile
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', theme === 'dark' ? '#000000' : '#FFFFFF');
    }

    /**
     * ========================================================================
     * 4. GLOBAL EVENT BUS (REATIVIDADE DE SISTEMA)
     * ========================================================================
     */

    _registerGlobalHandlers() {
        // Monitor de Conectividade (Sincronização de Sockets)
        window.addEventListener('online', () => {
            this._showToast("Conexão restabelecida.", "success");
            if (window.VlogSocket) window.VlogSocket.reconnect();
        });

        window.addEventListener('offline', () => {
            this._showToast("Você está desconectado do campus.", "warning");
        });

        // Handler para Erro de Autorização (401 Expired Token)
        window.addEventListener('vlog_auth_required', () => {
            this._showToast("Sessão expirada. Faça login novamente.", "error");
            if (window.VlogAuth) window.VlogAuth.logout();
        });

        // Atalhos de Hardware (UX Mastery)
        document.addEventListener('keydown', (e) => {
            // CTRL + K para busca global
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                window.location.hash = this.ROUTES.SEARCH;
            }
        });
    }

    /**
     * ========================================================================
     * 5. PROTOCOLOS DE NOTIFICAÇÃO E ERRO (UTILITIES)
     * ========================================================================
     */

    _showGlobalLoader(show) {
        if (this._ui.pageLoader) {
            this._ui.pageLoader.style.display = show ? 'block' : 'none';
        }
    }

    _showToast(msg, type = 'info') {
        const container = document.getElementById('vlog-toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `vlog-toast glass-morphism border-${type} animate__animated animate__slideInRight`;
        
        const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

        toast.innerHTML = `
            <div class="d-flex align-items-center p-3">
                <i class="fas ${icons[type]} text-${type} me-3"></i>
                <div class="fw-bold text-white">${msg}</div>
            </div>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.replace('animate__slideInRight', 'animate__fadeOutRight');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    _handleRoutingError(err) {
        if (this._ui.appView) {
            this._ui.appView.innerHTML = `
                <div class="h-100 d-flex flex-column align-items-center justify-content-center text-center p-5">
                    <i class="fas fa-satellite-dish text-neon mb-4" style="font-size: 5rem;"></i>
                    <h2 class="fw-black text-white">ERRO DE TRANSMISSÃO</h2>
                    <p class="text-muted">Não conseguimos sintonizar os dados desta tela no momento.</p>
                    <button class="btn-vlog-primary mt-4" onclick="window.location.reload()">RECONECTAR</button>
                    <p class="text-xs text-danger mt-3">Ref: ${err.message || 'Unknown Router Fail'}</p>
                </div>
            `;
        }
    }
}

/**
 * ============================================================================
 * BOOTSTRAP: Inicialização Automática após carregamento do DOM
 * ============================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // Registra a instância global no objeto window para acesso entre módulos
    window.VlogMain = new VlogMainOrchestrator();

    // Dispara a sequência de boot nuclear
    window.VlogMain.start();
});

/**
 * ============================================================================
 * FIM DO MAIN ORCHESTRATOR v21.0.0
 * ESTE CÓDIGO É PROPRIEDADE INTELECTUAL DO ECOSSISTEMA VLOGSTUDENTS.
 * PRODUZIDO POR MASTER SOFTWARE ENGINEER.
 * ============================================================================
 */
