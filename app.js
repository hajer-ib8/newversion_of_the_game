document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const grid = document.getElementById('wumpus-grid');
    const scoreDisplay = document.getElementById('score-display');
    const gameStatusMessage = document.getElementById('game-status-message');
    
    // Percepts
    const perceptStench = document.getElementById('percept-stench');
    const perceptBreeze = document.getElementById('percept-breeze');
    const perceptGlitter = document.getElementById('percept-glitter');
    const perceptBump = document.getElementById('percept-bump');
    const perceptScream = document.getElementById('percept-scream');
    const allPercepts = [perceptStench, perceptBreeze, perceptGlitter, perceptBump, perceptScream];

    // Status
    const statusArrow = document.getElementById('status-arrow');
    const statusGold = document.getElementById('status-gold');
    
    // --- Buttons ---
    // Desktop
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    const btnMove = document.getElementById('btn-move');
    const btnShoot = document.getElementById('btn-shoot');
    const btnGrab = document.getElementById('btn-grab');
    const btnNewGame = document.getElementById('btn-new-game'); 
    
    // NEW: Mobile
    const btnLeftMobile = document.getElementById('btn-left-mobile');
    const btnRightMobile = document.getElementById('btn-right-mobile');
    const btnMoveMobile = document.getElementById('btn-move-mobile');
    const btnShootMobile = document.getElementById('btn-shoot-mobile');
    const btnGrabMobile = document.getElementById('btn-grab-mobile');

    // --- Navbar & Modal Elements ---
    const navNewGame = document.getElementById('nav-new-game');
    const navHowToPlay = document.getElementById('nav-how-to-play');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const modalClose = document.getElementById('modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    // --- Game State Variables ---
    const GRID_WIDTH = 4;
    const GRID_HEIGHT = 4;
    let world = [];
    let agent = { x: 0, y: 0, dir: 'right', hasArrow: true, hasGold: false };
    let wumpusPos = { x: -1, y: -1 };
    let goldPos = { x: -1, y: -1 };
    let pitPos = [];
    let wumpusAlive = true;
    let score = 0;
    let gameOver = true;
    let soundEnabled = true; 
    let audioCtx;

    // --- Audio Functions ---
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    function playTone(freq, duration, type, volume = 0.1) {
        if (!audioCtx || !soundEnabled) return;
        try {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
            gain.gain.setValueAtTime(volume, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + duration);
        } catch (e) {
            console.error("Audio playback error:", e);
        }
    }

    // Pleasant short ascending move sound for the index/app version
    function playMoveSound() {
        if (!audioCtx || !soundEnabled) return;
        try {
            const now = audioCtx.currentTime;
            const duration = 0.14;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filter = audioCtx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + duration);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.linearRampToValueAtTime(0.16, now + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(2500, now);

            osc.connect(gain);
            gain.connect(filter);
            filter.connect(audioCtx.destination);

            osc.start(now);
            osc.stop(now + duration + 0.02);
        } catch (e) {
            console.error('Move sound playback error:', e);
        }
    }

    const sounds = {
        turn: () => playTone(300, 0.1, 'sawtooth'),
        move: () => playMoveSound(),
        bump: () => { playTone(100, 0.15, 'square', 0.2); perceptBump.classList.add('active'); },
        shoot: () => playTone(1000, 0.3, 'triangle'),
        scream: () => { playTone(1200, 0.5, 'sawtooth', 0.2); perceptScream.classList.add('active'); },
        death: () => playTone(200, 0.8, 'square', 0.2),
        win: () => {
            playTone(523, 0.1, 'sine');
            setTimeout(() => playTone(659, 0.1, 'sine'), 100);
            setTimeout(() => playTone(784, 0.1, 'sine'), 200);
            setTimeout(() => playTone(1046, 0.2, 'sine'), 300);
        },
        breeze: () => { playTone(1500, 0.4, 'sine', 0.05); perceptBreeze.classList.add('active'); },
        stench: () => { playTone(100, 0.4, 'square', 0.05); perceptStench.classList.add('active'); },
        glitter: () => { playTone(2000, 0.15, 'triangle', 0.15); perceptGlitter.classList.add('active'); },
        grab: () => playTone(1500, 0.1, 'sine')
    };

    // --- Game Logic (No changes here) ---

    function initializeGame() {
        initAudio();
        agent = { x: 0, y: 0, dir: 'right', hasArrow: true, hasGold: false };
        wumpusAlive = true;
        score = 0;
        gameOver = false;
        pitPos = [];
        world = [];
        grid.classList.remove('game-over');
        for (let y = 0; y < GRID_HEIGHT; y++) {
            world[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                world[y][x] = { pit: false, wumpus: false, gold: false, visited: false };
            }
        }
        placeItem('pit', 2);
        wumpusPos = placeItem('wumpus', 1)[0];
        goldPos = placeItem('gold', 1)[0];
        function placeItem(item, count) {
            let placed = 0, positions = [];
            while (placed < count) {
                const x = Math.floor(Math.random() * GRID_WIDTH);
                const y = Math.floor(Math.random() * GRID_HEIGHT);
                if ((x !== 0 || y !== 0) && !world[y][x].pit && !world[y][x].wumpus && !world[y][x].gold) {
                    world[y][x][item] = true;
                    if (item === 'pit') pitPos.push({ x, y });
                    positions.push({ x, y });
                    placed++;
                }
            }
            return positions;
        }
        world[0][0].visited = true;
        createVisualGrid();
        updateUI();
        checkSensors();
        updateScore(0);
        updateGameStatus('play', 'اللعبة جارية. حظًا موفقًا!');
    }

    function createVisualGrid() {
        grid.innerHTML = '';
        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.id = `cell-${x}-${y}`;
                cell.dataset.coords = `[${x + 1}, ${y + 1}]`;
                let content = '';
                if (world[y][x].wumpus) content += '<span class="cell-content wumpus">🐱</span>';
                if (world[y][x].pit) content += '<span class="cell-content pit">🕳️</span>';
                if (world[y][x].gold) content += '<span class="cell-content gold">💰</span>';
                content += `<span class="agent"></span>`;
                cell.innerHTML = content;
                grid.appendChild(cell);
            }
        }
    }

    function updateUI() {
        if (!world.length) return;
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                const cell = document.getElementById(`cell-${x}-${y}`);
                if (!cell) continue;
                cell.classList.remove('current');
                if (world[y][x].visited) cell.classList.add('visited');
                const agentSpan = cell.querySelector('.agent');
                if (x === agent.x && y === agent.y) {
                    cell.classList.add('current');
                    let agentChar = '';
                    switch (agent.dir) {
                        case 'right': agentChar = '►'; break;
                        case 'up': agentChar = '▲'; break;
                        case 'left': agentChar = '◄'; break;
                        case 'down': agentChar = '▼'; break;
                    }
                    agentSpan.textContent = agentChar;
                } else {
                    agentSpan.textContent = '';
                }
            }
        }
        statusArrow.textContent = `🏹 سهم: ${agent.hasArrow ? 1 : 0}`;
        statusArrow.classList.toggle('active', agent.hasArrow);
        statusGold.textContent = `💰 ذهب: ${agent.hasGold ? 'نعم' : 'لا'}`;
        statusGold.classList.toggle('active', agent.hasGold);
    }

    function updateScore(change) {
        if (gameOver) return;
        score += change;
        scoreDisplay.textContent = `النقاط: ${score}`;
    }

    function clearPercepts() {
        allPercepts.forEach(p => p.classList.remove('active'));
    }

    function checkSensors() {
        if (gameOver) return;
        clearPercepts();
        const { x, y } = agent;
        let playedSounds = new Set();
        if (world[y][x].gold) {
            if (!playedSounds.has('glitter')) { sounds.glitter(); playedSounds.add('glitter'); }
        }
        const neighbors = [[x, y + 1], [x, y - 1], [x - 1, y], [x + 1, y]];
        for (const [nx, ny] of neighbors) {
            if (isValid(nx, ny)) {
                if (world[ny][nx].pit) {
                    if (!playedSounds.has('breeze')) { sounds.breeze(); playedSounds.add('breeze'); }
                }
                if (world[ny][nx].wumpus && wumpusAlive) {
                    if (!playedSounds.has('stench')) { sounds.stench(); playedSounds.add('stench'); }
                }
            }
        }
    }

    function checkGameState() {
        const { x, y } = agent;
        if (agent.hasGold && x === 0 && y === 0) {
            updateScore(1000);
            endGame('win', 'لقد هربت بالذهب! 🎉');
            sounds.win();
            return;
        }
        if (world[y][x].wumpus && wumpusAlive) {
            updateScore(-1000);
            endGame('lose', 'لقد أكلك الوومبوس! 🐱');
            sounds.death();
            return;
        }
        if (world[y][x].pit) {
            updateScore(-1000);
            endGame('lose', 'لقد سقطت في حفرة! 🕳️');
            sounds.death();
            return;
        }
    }
    
    function updateGameStatus(type, message) {
        gameStatusMessage.textContent = message;
        gameStatusMessage.className = '';
        gameStatusMessage.classList.add(type);
    }

    function endGame(type, message) {
        gameOver = true;
        grid.classList.add('game-over');
        updateGameStatus(type, message);
        scoreDisplay.textContent = `النقاط النهائية: ${score}`;
    }

    function isValid(x, y) {
        return x >= 0 && x < GRID_WIDTH && y >= 0 && y < GRID_HEIGHT;
    }

    // --- Actuator Functions (No changes here) ---

    function turnLeft() {
        if (gameOver) return;
        sounds.turn();
        switch (agent.dir) {
            case 'right': agent.dir = 'up'; break;
            case 'up': agent.dir = 'left'; break;
            case 'left': agent.dir = 'down'; break;
            case 'down': agent.dir = 'right'; break;
        }
        updateScore(-1); updateUI(); clearPercepts();
    }

    function turnRight() {
        if (gameOver) return;
        sounds.turn();
        switch (agent.dir) {
            case 'right': agent.dir = 'down'; break;
            case 'down': agent.dir = 'left'; break;
            case 'left': agent.dir = 'up'; break;
            case 'up': agent.dir = 'right'; break;
        }
        updateScore(-1); updateUI(); clearPercepts();
    }

    function moveForward() {
        if (gameOver) return;
        updateScore(-1);
        let newX = agent.x, newY = agent.y;
        switch (agent.dir) {
            case 'right': newX++; break;
            case 'up': newY++; break;
            case 'left': newX--; break;
            case 'down': newY--; break;
        }
        if (!isValid(newX, newY)) {
            sounds.bump(); return;
        }
        sounds.move();
        agent.x = newX; agent.y = newY;
        world[newY][newX].visited = true;
        updateUI();
        checkGameState();
        if (!gameOver) checkSensors();
    }

    function grab() {
        if (gameOver) return;
        updateScore(-1);
        if (world[agent.y][agent.x].gold) {
            agent.hasGold = true;
            world[agent.y][agent.x].gold = false;
            sounds.grab();
            const cell = document.getElementById(`cell-${agent.x}-${agent.y}`);
            const goldSpan = cell.querySelector('.cell-content.gold');
            if (goldSpan) goldSpan.style.visibility = 'hidden';
            updateUI();
            checkSensors();
        }
    }

    function shoot() {
        if (gameOver || !agent.hasArrow) return;
        sounds.shoot();
        updateScore(-10);
        agent.hasArrow = false;
        let hit = false;
        if (agent.dir === 'right' && agent.y === wumpusPos.y && agent.x < wumpusPos.x) hit = true;
        else if (agent.dir === 'left' && agent.y === wumpusPos.y && agent.x > wumpusPos.x) hit = true;
        else if (agent.dir === 'up' && agent.x === wumpusPos.x && agent.y < wumpusPos.y) hit = true;
        else if (agent.dir === 'down' && agent.x === wumpusPos.x && agent.y > wumpusPos.y) hit = true;
        if (hit && wumpusAlive) {
            wumpusAlive = false;
            sounds.scream();
            world[wumpusPos.y][wumpusPos.x].wumpus = false;
            const wumpusCell = document.getElementById(`cell-${wumpusPos.x}-${wumpusPos.y}`);
            const wumpusSpan = wumpusCell.querySelector('.cell-content.wumpus');
            if (wumpusSpan) wumpusSpan.textContent = '💀';
            setTimeout(checkSensors, 100);
        }
        updateUI();
    }

    // --- Modal Functions ---
    
    function openModal(title, contentHTML) {
        modalTitle.textContent = title;
        modalBody.innerHTML = contentHTML;
        modalOverlay.style.display = 'flex';
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
    }


    // --- Event Listeners ---
    
    // --- NEW: Attach listeners to BOTH sets of controls ---
    
    // Desktop Controls
    btnLeft.addEventListener('click', () => { initAudio(); turnLeft(); });
    btnRight.addEventListener('click', () => { initAudio(); turnRight(); });
    btnMove.addEventListener('click', () => { initAudio(); moveForward(); });
    btnShoot.addEventListener('click', () => { initAudio(); shoot(); });
    btnGrab.addEventListener('click', () => { initAudio(); grab(); });
    btnNewGame.addEventListener('click', initializeGame);
    
    // Mobile Controls
    btnLeftMobile.addEventListener('click', () => { initAudio(); turnLeft(); });
    btnRightMobile.addEventListener('click', () => { initAudio(); turnRight(); });
    btnMoveMobile.addEventListener('click', () => { initAudio(); moveForward(); });
    btnShootMobile.addEventListener('click', () => { initAudio(); shoot(); });
    btnGrabMobile.addEventListener('click', () => { initAudio(); grab(); });

    
    // Keyboard
    window.addEventListener('keydown', (e) => {
        initAudio();
        if (modalOverlay.style.display === 'flex') {
            if (e.key === 'Escape') closeModal();
            return;
        }
        if (gameOver) {
            if (e.key === 'Enter') initializeGame();
            return;
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        switch (e.key) {
            case 'ArrowLeft': case 'a': turnLeft(); break;
            case 'ArrowRight': case 'd': turnRight(); break;
            case 'ArrowUp': case 'w': moveForward(); break;
            case 'f': shoot(); break;
            case 'g': case ' ': grab(); break;
            case 'Escape': closeModal(); break;
        }
    });

    // --- Navbar & Modal Listeners ---
    
    navNewGame.addEventListener('click', (e) => { e.preventDefault(); initializeGame(); });
    
    navHowToPlay.addEventListener('click', (e) => {
        e.preventDefault();
        const content = `
            <p><strong>الهدف:</strong> ابحث عن الذهب (💰) وارجع إلى الخلية الأولى [1,1] للهروب.</p>
            <hr>
            <h3>المخاطر والإدراكات</h3>
            <ul>
                <li><strong>الوومبوس (🐱):</strong> دخول غرفته يعني الموت. الغرف المجاورة تحتوي على <strong>رائحة كريهة (🤢)</strong>. يمكنك قتله بسهمك الواحد، مما يسبب <strong>صرخة (😱)</strong>.</li>
                <li><strong>الحفرة (🕳️):</strong> دخول حفرة يعني الموت. الغرف المجاورة تحتوي على <strong>نسيم (💨)</strong>.</li>
                <li><strong>الذهب (💰):</strong> الغرفة التي تحتوي على الذهب تحتوي على <strong>لمعان (✨)</strong>.</li>
            </ul>
        `;
        openModal('كيفية اللعب', content);
    });

    // Modal Closing
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Start the game on load
    initializeGame();
});