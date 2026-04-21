class VlogMasterBuildEngine {
    renderMasterTemplate(endpoints) {
        const routeCards = endpoints.map(route => `
            <div class="vlog-api-card">
                <div class="vlog-api-method-tag">${route.method}</div>
                <div class="vlog-api-path-text">${route.path}</div>
                <div class="vlog-api-scope-label">${route.scope}</div>
                <div class="vlog-api-status-indicator">
                    <div class="vlog-api-status-dot"></div>
                    <div class="vlog-api-status-text">${route.status}</div>
                </div>
            </div>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VlogStudents Master Engine - Successful Deployment</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono&display=swap" rel="stylesheet">
            <style>
                :root {
                    --neon-lime: #CCFF00;
                    --deep-black: #000000;
                    --surface-dark: #0A0A0A;
                    --glass-layer: rgba(255, 255, 255, 0.03);
                    --glass-border: rgba(255, 255, 255, 0.08);
                    --accent-purple: #8A2BE2;
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }

                body {
                    background-color: var(--deep-black);
                    color: white;
                    font-family: 'Inter', sans-serif;
                    overflow-x: hidden;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .vlog-starfield {
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: radial-gradient(circle at center, #111 0%, #000 100%);
                    z-index: -1;
                }

                .vlog-star {
                    position: absolute;
                    background: white;
                    border-radius: 50%;
                    opacity: 0.2;
                    animation: flicker var(--dur) infinite ease-in-out;
                }

                @keyframes flicker {
                    0%, 100% { opacity: 0.1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.5); }
                }

                .vlog-main-shell {
                    width: 95%;
                    max-width: 1000px;
                    background: var(--glass-layer);
                    backdrop-filter: blur(50px);
                    border: 1px solid var(--glass-border);
                    border-radius: 50px;
                    padding: 80px 40px;
                    text-align: center;
                    position: relative;
                    box-shadow: 0 60px 120px rgba(0,0,0,1);
                    margin: 40px 0;
                }

                .vlog-neon-glow-top {
                    position: absolute;
                    top: -200px; right: -200px;
                    width: 400px; height: 400px;
                    background: var(--neon-lime);
                    filter: blur(180px);
                    opacity: 0.12;
                }

                .vlog-neon-glow-bottom {
                    position: absolute;
                    bottom: -200px; left: -200px;
                    width: 400px; height: 400px;
                    background: var(--accent-purple);
                    filter: blur(180px);
                    opacity: 0.08;
                }

                .vlog-deploy-title {
                    font-size: 100px;
                    font-weight: 900;
                    letter-spacing: -5px;
                    margin-bottom: 5px;
                    background: linear-gradient(to bottom, #FFFFFF 30%, #444444 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .vlog-deploy-subtitle {
                    color: var(--neon-lime);
                    font-size: 22px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 10px;
                    margin-bottom: 50px;
                    text-shadow: 0 0 20px rgba(204, 255, 0, 0.4);
                }

                .vlog-hero-visual {
                    position: relative;
                    width: 280px;
                    height: 280px;
                    margin: 20px auto 60px;
                }

                .vlog-astronaut-svg {
                    width: 100%;
                    height: 100%;
                    animation: spaceFloat 7s infinite ease-in-out;
                    filter: drop-shadow(0 0 30px rgba(204, 255, 0, 0.2));
                }

                @keyframes spaceFloat {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-35px) rotate(8deg); }
                }

                .vlog-planet {
                    position: absolute;
                    width: 60px; height: 60px;
                    background: radial-gradient(circle at 30% 30%, #444, #000);
                    border-radius: 50%;
                    box-shadow: inset -5px -5px 15px rgba(255,255,255,0.1);
                    bottom: 20px; left: -40px;
                    animation: planetMove 20s infinite linear;
                }

                @keyframes planetMove {
                    0% { transform: translateX(0) rotate(0); }
                    100% { transform: translateX(100px) rotate(360deg); }
                }

                .vlog-status-description {
                    color: #999;
                    font-size: 17px;
                    line-height: 1.8;
                    max-width: 650px;
                    margin: 0 auto 60px;
                }

                .vlog-api-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 12px;
                    background: rgba(0,0,0,0.5);
                    border-radius: 30px;
                    padding: 24px;
                    border: 1px solid var(--glass-border);
                    text-align: left;
                }

                .vlog-api-card {
                    display: flex;
                    align-items: center;
                    padding: 16px 20px;
                    background: rgba(255,255,255,0.02);
                    border-radius: 18px;
                    border: 1px solid rgba(255,255,255,0.03);
                    transition: 0.3s ease;
                }

                .vlog-api-card:hover {
                    background: rgba(204, 255, 0, 0.05);
                    border-color: var(--neon-lime);
                    transform: scale(1.01);
                }

                .vlog-api-method-tag {
                    background: var(--neon-lime);
                    color: black;
                    font-size: 11px;
                    font-weight: 900;
                    padding: 5px 12px;
                    border-radius: 8px;
                    min-width: 75px;
                    text-align: center;
                }

                .vlog-api-path-text {
                    font-family: 'JetBrains Mono', monospace;
                    flex: 1;
                    padding-left: 25px;
                    color: #DDD;
                    font-size: 14px;
                }

                .vlog-api-scope-label {
                    color: #555;
                    font-size: 11px;
                    font-weight: bold;
                    margin-right: 30px;
                    text-transform: uppercase;
                }

                .vlog-api-status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .vlog-api-status-dot {
                    width: 10px; height: 10px;
                    background: #00FF66;
                    border-radius: 50%;
                    box-shadow: 0 0 15px #00FF66;
                }

                .vlog-api-status-text {
                    color: #00FF66;
                    font-size: 12px;
                    font-weight: 900;
                }

                .vlog-footer-btn {
                    margin-top: 60px;
                    padding: 22px 50px;
                    background: var(--neon-lime);
                    color: black;
                    text-decoration: none;
                    font-weight: 900;
                    font-size: 16px;
                    border-radius: 100px;
                    display: inline-block;
                    transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 20px 40px rgba(204, 255, 0, 0.25);
                    letter-spacing: 1px;
                }

                .vlog-footer-btn:hover {
                    transform: translateY(-8px) scale(1.05);
                    box-shadow: 0 30px 60px rgba(204, 255, 0, 0.4);
                }

                @media (max-width: 768px) {
                    .vlog-deploy-title { font-size: 60px; }
                    .vlog-api-path-text { display: none; }
                    .vlog-api-scope-label { display: none; }
                }

            </style>
        </head>
        <body>
            <div class="vlog-starfield" id="starfield"></div>
            
            <div class="vlog-main-shell">
                <div class="vlog-neon-glow-top"></div>
                <div class="vlog-neon-glow-bottom"></div>

                <div class="vlog-header-section">
                    <h1 class="vlog-deploy-title">LAUNCHED</h1>
                    <p class="vlog-deploy-subtitle">VlogStudents Master Node</p>
                </div>

                <div class="vlog-hero-visual">
                    <div class="vlog-planet"></div>
                    <svg class="vlog-astronaut-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="256" cy="180" r="80" fill="white" fill-opacity="0.1"/>
                        <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z" fill="var(--neon-lime)" fill-opacity="0.05"/>
                        <circle cx="256" cy="180" r="65" fill="var(--neon-lime)"/>
                        <path d="M256 260c-80 0-140 60-140 130v40h280v-40c0-70-60-130-140-130z" fill="var(--neon-lime)"/>
                    </svg>
                </div>

                <p class="vlog-status-description">
                    A infraestrutura <b>VlogStudents Enterprise</b> foi compilada com integridade absoluta. O cluster de banco de dados <b>Neon PostgreSQL</b> e o <b>Cloud Storage</b> foram mapeados com sucesso. O sistema está em regime de alta disponibilidade (99.9% Uptime).
                </p>

                <div class="vlog-api-grid">
                    ${routeCards}
                </div>

                <a href="https://vlogstudents.onrender.com/health" class="vlog-footer-btn">INSPECIONAR KERNEL</a>

                <div style="margin-top: 40px; color: #444; font-size: 10px; font-weight: bold; letter-spacing: 2px;">
                    © 2025 VLOGSTUDENTS TECHNOLOGY GROUP - BUILD DD6D9AE
                </div>
            </div>

            <script>
                const field = document.getElementById('starfield');
                const starCount = 200;
                for (let i = 0; i < starCount; i++) {
                    const star = document.createElement('div');
                    star.className = 'vlog-star';
                    const size = Math.random() * 3 + 'px';
                    star.style.width = size;
                    star.style.height = size;
                    star.style.left = Math.random() * 100 + '%';
                    star.style.top = Math.random() * 100 + '%';
                    star.style.setProperty('--dur', (Math.random() * 3 + 2) + 's');
                    field.appendChild(star);
                }
            </script>
        </body>
        </html>
        `;
    }
}

module.exports = new VlogMasterBuildEngine();
