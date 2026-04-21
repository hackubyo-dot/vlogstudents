class VlogMasterBuildEngine {
    generateMasterTemplate(inventory) {
        const apiCardsHtml = inventory.map(item => `
            <div class="vlog-route-card">
                <div class="vlog-method-box">${item.method}</div>
                <div class="vlog-path-box">${item.path}</div>
                <div class="vlog-scope-box">${item.scope}</div>
                <div class="vlog-status-container">
                    <div class="vlog-status-dot"></div>
                    <div class="vlog-status-text">${item.status}</div>
                </div>
            </div>
        `).join('');

        return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>VlogStudents - Master Kernel Status</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Space+Mono&display=swap" rel="stylesheet">
            <style>
                :root {
                    --neon: #CCFF00;
                    --bg-deep: #000000;
                    --surface: #0A0A0A;
                    --glass: rgba(255, 255, 255, 0.03);
                    --glass-edge: rgba(255, 255, 255, 0.08);
                    --accent: #8A2BE2;
                }

                * { margin: 0; padding: 0; box-sizing: border-box; }

                body {
                    background-color: var(--bg-deep);
                    color: white;
                    font-family: 'Inter', sans-serif;
                    overflow-x: hidden;
                    min-height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .vlog-galaxy {
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    background: radial-gradient(circle at center, #111 0%, #000 100%);
                    z-index: -1;
                }

                .vlog-particle {
                    position: absolute;
                    background: white;
                    border-radius: 50%;
                    opacity: 0.2;
                    animation: pulse var(--time) infinite ease-in-out;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 0.1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.3); }
                }

                .vlog-root-frame {
                    width: 95%;
                    max-width: 1000px;
                    background: var(--glass);
                    backdrop-filter: blur(60px);
                    border: 1px solid var(--glass-edge);
                    border-radius: 60px;
                    padding: 80px 40px;
                    text-align: center;
                    position: relative;
                    box-shadow: 0 80px 160px rgba(0,0,0,0.9);
                    margin: 60px 0;
                }

                .vlog-top-aura {
                    position: absolute;
                    top: -200px; right: -200px;
                    width: 450px; height: 450px;
                    background: var(--neon);
                    filter: blur(200px);
                    opacity: 0.1;
                }

                .vlog-kernel-title {
                    font-size: 110px;
                    font-weight: 900;
                    letter-spacing: -6px;
                    margin-bottom: 2px;
                    background: linear-gradient(to bottom, #FFF 30%, #555 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .vlog-kernel-subtitle {
                    color: var(--neon);
                    font-size: 24px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 12px;
                    margin-bottom: 60px;
                    text-shadow: 0 0 30px rgba(204, 255, 0, 0.3);
                }

                .vlog-astronaut-container {
                    position: relative;
                    width: 300px;
                    height: 300px;
                    margin: 0 auto 70px;
                }

                .vlog-astronaut-svg {
                    width: 100%;
                    height: 100%;
                    animation: floatingAnim 8s infinite ease-in-out;
                    filter: drop-shadow(0 0 40px rgba(204, 255, 0, 0.25));
                }

                @keyframes floatingAnim {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-40px) rotate(10deg); }
                }

                .vlog-planet-orb {
                    position: absolute;
                    width: 70px; height: 70px;
                    background: radial-gradient(circle at 30% 30%, #555, #000);
                    border-radius: 50%;
                    box-shadow: inset -6px -6px 20px rgba(255,255,255,0.05);
                    bottom: 30px; left: -50px;
                    animation: orbit 25s infinite linear;
                }

                @keyframes orbit {
                    0% { transform: translateX(0) scale(1); }
                    50% { transform: translateX(150px) scale(1.1); }
                    100% { transform: translateX(0) scale(1); }
                }

                .vlog-manifest-text {
                    color: #999;
                    font-size: 18px;
                    line-height: 1.8;
                    max-width: 700px;
                    margin: 0 auto 60px;
                }

                .vlog-inventory-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                    background: rgba(0,0,0,0.6);
                    border-radius: 35px;
                    padding: 30px;
                    border: 1px solid var(--glass-edge);
                    text-align: left;
                }

                .vlog-route-card {
                    display: flex;
                    align-items: center;
                    padding: 18px 25px;
                    background: rgba(255,255,255,0.01);
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.02);
                    transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .vlog-route-card:hover {
                    background: rgba(204, 255, 0, 0.04);
                    border-color: var(--neon);
                    transform: translateX(10px) scale(1.02);
                }

                .vlog-method-box {
                    background: var(--neon);
                    color: black;
                    font-size: 11px;
                    font-weight: 950;
                    padding: 6px 14px;
                    border-radius: 10px;
                    min-width: 80px;
                    text-align: center;
                }

                .vlog-path-box {
                    font-family: 'Space Mono', monospace;
                    flex: 1;
                    padding-left: 30px;
                    color: #EEE;
                    font-size: 15px;
                }

                .vlog-scope-box {
                    color: #666;
                    font-size: 12px;
                    font-weight: 900;
                    margin-right: 40px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .vlog-status-container {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .vlog-status-dot {
                    width: 12px; height: 12px;
                    background: #00FF66;
                    border-radius: 50%;
                    box-shadow: 0 0 20px #00FF66;
                    animation: pulseDot 2s infinite;
                }

                @keyframes pulseDot { 
                    0% { transform: scale(1); opacity: 1; } 
                    50% { transform: scale(1.3); opacity: 0.7; } 
                    100% { transform: scale(1); opacity: 1; }
                }

                .vlog-status-text {
                    color: #00FF66;
                    font-size: 13px;
                    font-weight: 900;
                }

                .vlog-master-btn {
                    margin-top: 70px;
                    padding: 24px 60px;
                    background: var(--neon);
                    color: black;
                    text-decoration: none;
                    font-weight: 900;
                    font-size: 18px;
                    border-radius: 100px;
                    display: inline-block;
                    transition: 0.5s;
                    box-shadow: 0 25px 50px rgba(204, 255, 0, 0.2);
                    letter-spacing: 2px;
                    text-transform: uppercase;
                }

                .vlog-master-btn:hover {
                    transform: translateY(-10px) scale(1.05);
                    box-shadow: 0 35px 70px rgba(204, 255, 0, 0.4);
                }

                @media (max-width: 800px) {
                    .vlog-kernel-title { font-size: 65px; }
                    .vlog-path-box { display: none; }
                    .vlog-scope-box { display: none; }
                    .vlog-master-btn { width: 100%; padding: 20px; }
                }

            </style>
        </head>
        <body>
            <div class="vlog-galaxy" id="galaxy"></div>
            
            <div class="vlog-root-frame">
                <div class="vlog-top-aura"></div>

                <div class="vlog-header">
                    <h1 class="vlog-kernel-title">SUCCESS</h1>
                    <p class="vlog-kernel-subtitle">Master Engine Online</p>
                </div>

                <div class="vlog-astronaut-container">
                    <div class="vlog-planet-orb"></div>
                    <svg class="vlog-astronaut-svg" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="256" cy="180" r="80" fill="white" fill-opacity="0.1"/>
                        <circle cx="256" cy="180" r="65" fill="var(--neon)"/>
                        <path d="M256 260c-80 0-140 60-140 130v40h280v-40c0-70-60-130-140-130z" fill="var(--neon)"/>
                    </svg>
                </div>

                <p class="vlog-manifest-text">
                    A infraestrutura <b>VlogStudents Enterprise</b> foi compilada com integridade total. O sistema está em regime de alta disponibilidade (99.9% Uptime).
                </p>

                <div class="vlog-inventory-grid">
                    ${apiCardsHtml}
                </div>

                <a href="https://vlogstudents.onrender.com/api/v1/health" class="vlog-master-btn">VERIFICAR LATÊNCIA</a>

                <div style="margin-top: 50px; color: #333; font-size: 11px; font-weight: 900; letter-spacing: 3px;">
                    © 2025 VLOGSTUDENTS TECH GROUP
                </div>
            </div>

            <script>
                const galaxy = document.getElementById('galaxy');
                for (let i = 0; i < 200; i++) {
                    const p = document.createElement('div');
                    p.className = 'vlog-particle';
                    const size = Math.random() * 3 + 'px';
                    p.style.width = size;
                    p.style.height = size;
                    p.style.left = Math.random() * 100 + '%';
                    p.style.top = Math.random() * 100 + '%';
                    p.style.setProperty('--time', (Math.random() * 3 + 2) + 's');
                    galaxy.appendChild(p);
                }
            </script>
        </body>
        </html>
        `;
    }
}

module.exports = new VlogMasterBuildEngine();
