class VlogBuildEngine {
    generateSuccessTemplate(routes) {
        const routeCards = routes.map(r => `
            <div class="vlog-route-item">
                <div class="vlog-method-tag">${r.method}</div>
                <div class="vlog-path-text">${r.path}</div>
                <div class="vlog-status-dot"></div>
                <div class="vlog-status-label">${r.status}</div>
            </div>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VlogStudents - Master Engine Active</title>
            <style>
                :root {
                    --neon: #CCFF00;
                    --bg: #000000;
                    --glass: rgba(255, 255, 255, 0.05);
                    --border: rgba(255, 255, 255, 0.1);
                }

                * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }

                body {
                    background-color: var(--bg);
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    overflow: hidden;
                }

                .space-bg {
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: radial-gradient(circle at center, #111 0%, #000 100%);
                    z-index: -1;
                }

                .vlog-star {
                    position: absolute;
                    background: white;
                    border-radius: 50%;
                    opacity: 0.3;
                    animation: twinkle var(--speed) infinite alternate;
                }

                @keyframes twinkle { from { opacity: 0.1; } to { opacity: 1; } }

                .vlog-main-container {
                    width: 90%;
                    max-width: 850px;
                    background: var(--glass);
                    backdrop-filter: blur(40px);
                    border: 1px solid var(--border);
                    border-radius: 40px;
                    padding: 60px;
                    text-align: center;
                    position: relative;
                    box-shadow: 0 50px 100px rgba(0,0,0,0.8);
                }

                .vlog-glow {
                    position: absolute;
                    top: -100px; right: -100px;
                    width: 300px; height: 300px;
                    background: var(--neon);
                    filter: blur(150px);
                    opacity: 0.15;
                }

                .vlog-title {
                    font-size: 80px;
                    font-weight: 900;
                    letter-spacing: -3px;
                    background: linear-gradient(to bottom, #fff, #444);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .vlog-subtitle {
                    color: var(--neon);
                    font-size: 20px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 6px;
                    margin-bottom: 40px;
                }

                .vlog-astronaut {
                    width: 200px;
                    height: 200px;
                    margin: 20px auto;
                    filter: drop-shadow(0 0 20px rgba(204, 255, 0, 0.4));
                    animation: floating 5s infinite ease-in-out;
                }

                @keyframes floating {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-25px); }
                }

                .vlog-description {
                    color: #888;
                    line-height: 1.6;
                    margin: 30px auto;
                    max-width: 500px;
                    font-size: 15px;
                }

                .vlog-routes-grid {
                    background: rgba(0,0,0,0.4);
                    border-radius: 20px;
                    padding: 15px;
                    text-align: left;
                    border: 1px solid var(--border);
                }

                .vlog-route-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .vlog-route-item:last-child { border-bottom: none; }

                .vlog-method-tag {
                    background: var(--neon);
                    color: black;
                    font-size: 10px;
                    font-weight: 900;
                    padding: 4px 10px;
                    border-radius: 6px;
                    margin-right: 20px;
                    min-width: 60px;
                    text-align: center;
                }

                .vlog-path-text { font-family: 'Courier New', monospace; flex: 1; color: #ccc; font-size: 13px; }

                .vlog-status-dot { width: 8px; height: 8px; background: #00ff00; border-radius: 50%; margin-right: 8px; box-shadow: 0 0 10px #00ff00; }

                .vlog-status-label { font-size: 11px; color: #00ff00; font-weight: bold; }

                .vlog-btn {
                    margin-top: 40px;
                    padding: 18px 40px;
                    background: var(--neon);
                    color: black;
                    text-decoration: none;
                    font-weight: 800;
                    border-radius: 100px;
                    display: inline-block;
                    transition: 0.3s;
                    box-shadow: 0 10px 30px rgba(204, 255, 0, 0.2);
                }

                .vlog-btn:hover { transform: translateY(-3px); box-shadow: 0 15px 40px rgba(204, 255, 0, 0.4); }

            </style>
        </head>
        <body>
            <div class="space-bg" id="space"></div>
            <div class="vlog-main-container">
                <div class="vlog-glow"></div>
                <h1 class="vlog-title">200 OK</h1>
                <p class="vlog-subtitle">Engine Online</p>

                <div class="vlog-astronaut">
                    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0z" fill="#CCFF00" fill-opacity="0.1"/>
                        <circle cx="256" cy="180" r="70" fill="#CCFF00"/>
                        <path d="M256 280c-70 0-130 50-130 110v30h260v-30c0-60-60-110-130-110z" fill="#CCFF00"/>
                    </svg>
                </div>

                <p class="vlog-description">
                    O servidor Master do <b>VlogStudents</b> foi implantado com integridade total. O banco de dados NeonDB e o Cloud Storage estão prontos para processar tráfego universitário em tempo real.
                </p>

                <div class="vlog-routes-grid">
                    ${routeCards}
                </div>

                <a href="https://vlogstudents.onrender.com/health" class="vlog-btn">VERIFICAR LATÊNCIA</a>
            </div>

            <script>
                const space = document.getElementById('space');
                for (let i = 0; i < 100; i++) {
                    const star = document.createElement('div');
                    star.className = 'vlog-star';
                    star.style.width = Math.random() * 3 + 'px';
                    star.style.height = star.style.width;
                    star.style.left = Math.random() * 100 + '%';
                    star.style.top = Math.random() * 100 + '%';
                    star.style.setProperty('--speed', (Math.random() * 2 + 1) + 's');
                    space.appendChild(star);
                }
            </script>
        </body>
        </html>
        `;
    }
}

module.exports = new VlogBuildEngine();
