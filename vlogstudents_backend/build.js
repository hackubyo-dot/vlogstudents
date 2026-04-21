class VlogBuildEngine {
    generateSuccessTemplate(routes) {
        const routesHtml = routes.map(route => `
            <div class="route-card">
                <span class="method">${route.method}</span>
                <span class="path">${route.path}</span>
                <span class="status-badge">${route.status}</span>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html lang="pt-br">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>VlogStudents - Server Active</title>
                <style>
                    :root {
                        --neon-lime: #CCFF00;
                        --deep-black: #000000;
                        --glass-bg: rgba(255, 255, 255, 0.05);
                        --glass-border: rgba(255, 255, 255, 0.1);
                    }

                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }

                    body {
                        background-color: var(--deep-black);
                        color: white;
                        overflow-x: hidden;
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }

                    .space-container {
                        position: fixed;
                        top: 0; left: 0; width: 100%; height: 100%;
                        background: radial-gradient(circle at center, #111 0%, #000 100%);
                        z-index: -1;
                    }

                    .star {
                        position: absolute;
                        background: white;
                        border-radius: 50%;
                        opacity: 0.5;
                        animation: twinkle var(--duration) infinite ease-in-out;
                    }

                    @keyframes twinkle {
                        0%, 100% { opacity: 0.3; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.2); }
                    }

                    .main-frame {
                        width: 90%;
                        max-width: 900px;
                        background: var(--glass-bg);
                        backdrop-filter: blur(20px);
                        border: 1px solid var(--glass-border);
                        border-radius: 40px;
                        padding: 60px;
                        text-align: center;
                        box-shadow: 0 40px 100px rgba(0,0,0,0.5);
                        position: relative;
                        overflow: hidden;
                    }

                    .glow-orb {
                        position: absolute;
                        width: 300px;
                        height: 300px;
                        background: var(--neon-lime);
                        filter: blur(150px);
                        opacity: 0.1;
                        top: -150px;
                        right: -150px;
                    }

                    .status-header {
                        margin-bottom: 40px;
                    }

                    .success-title {
                        font-size: 80px;
                        font-weight: 900;
                        letter-spacing: -4px;
                        margin-bottom: 10px;
                        background: linear-gradient(to bottom, #fff 0%, #888 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }

                    .success-subtitle {
                        font-size: 24px;
                        font-weight: 600;
                        color: var(--neon-lime);
                        text-transform: uppercase;
                        letter-spacing: 4px;
                    }

                    .astronaut-svg {
                        width: 250px;
                        height: 250px;
                        margin: 20px 0;
                        filter: drop-shadow(0 0 30px rgba(204, 255, 0, 0.3));
                        animation: float 6s infinite ease-in-out;
                    }

                    @keyframes float {
                        0%, 100% { transform: translateY(0) rotate(0); }
                        50% { transform: translateY(-20px) rotate(5deg); }
                    }

                    .description {
                        color: #aaa;
                        line-height: 1.6;
                        max-width: 600px;
                        margin: 0 auto 40px;
                        font-size: 16px;
                    }

                    .routes-table {
                        text-align: left;
                        background: rgba(0,0,0,0.3);
                        border-radius: 24px;
                        padding: 20px;
                        border: 1px solid var(--glass-border);
                    }

                    .route-card {
                        display: flex;
                        align-items: center;
                        padding: 12px 16px;
                        border-bottom: 1px solid rgba(255,255,255,0.05);
                    }

                    .route-card:last-child { border-bottom: none; }

                    .method {
                        background: var(--neon-lime);
                        color: black;
                        font-size: 10px;
                        font-weight: 900;
                        padding: 4px 8px;
                        border-radius: 6px;
                        margin-right: 15px;
                        min-width: 50px;
                        text-align: center;
                    }

                    .path { font-family: 'Courier New', monospace; font-size: 14px; color: #eee; flex: 1; }

                    .status-badge { color: #55ff55; font-size: 12px; font-weight: bold; }

                    .footer-actions {
                        margin-top: 50px;
                        display: flex;
                        gap: 20px;
                        justify-content: center;
                    }

                    .btn {
                        padding: 16px 32px;
                        border-radius: 100px;
                        text-decoration: none;
                        font-weight: bold;
                        transition: 0.3s;
                    }

                    .btn-primary { background: var(--neon-lime); color: black; box-shadow: 0 10px 30px rgba(204, 255, 0, 0.2); }
                    .btn-primary:hover { transform: translateY(-5px); box-shadow: 0 15px 40px rgba(204, 255, 0, 0.4); }

                    .btn-secondary { background: var(--glass-bg); color: white; border: 1px solid var(--glass-border); }
                    .btn-secondary:hover { background: rgba(255,255,255,0.1); }
                </style>
            </head>
            <body>
                <div class="space-container" id="space"></div>
                
                <div class="main-frame">
                    <div class="glow-orb"></div>
                    <div class="status-header">
                        <h1 class="success-title">200 OK</h1>
                        <p class="success-subtitle">Master Engine is Live</p>
                    </div>

                    <svg class="astronaut-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm0 464c-114.7 0-208-93.3-208-208S141.3 48 256 48s208 93.3 208 208-93.3 208-208 208z" fill="#CCFF00" opacity="0.2"/>
                        <circle cx="256" cy="180" r="60" fill="#CCFF00"/>
                        <path d="M256 260c-60 0-110 40-110 90v40h220v-40c0-50-50-90-110-90z" fill="#CCFF00"/>
                    </svg>

                    <p class="description">
                        O ecossistema universitário <b>VlogStudents</b> foi compilado com sucesso. Todas as camadas de rede, segurança e persistência em nuvem estão operando em regime de alta disponibilidade.
                    </p>

                    <div class="routes-table">
                        ${routesHtml}
                    </div>

                    <div class="footer-actions">
                        <a href="https://vlogstudents.onrender.com/health" class="btn btn-primary">Verificar Saude</a>
                        <a href="#" class="btn btn-secondary">Documentacao API</a>
                    </div>
                </div>

                <script>
                    const space = document.getElementById('space');
                    for (let i = 0; i < 150; i++) {
                        const star = document.createElement('div');
                        star.className = 'star';
                        star.style.width = Math.random() * 3 + 'px';
                        star.style.height = star.style.width;
                        star.style.left = Math.random() * 100 + '%';
                        star.style.top = Math.random() * 100 + '%';
                        star.style.setProperty('--duration', (Math.random() * 3 + 2) + 's');
                        space.appendChild(star);
                    }
                </script>
            </body>
            </html>
        `;
    }
}

module.exports = new VlogBuildEngine();
