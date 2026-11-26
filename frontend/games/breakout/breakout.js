/* ==========================================================================
   locate.me – Breakout easter egg
   Standalone, dependency-free arcade game. This file deliberately imports
   nothing from the app and exposes nothing globally. All state lives inside
   this IIFE; the only persisted values are the game's own namespaced
   localStorage keys (high score and mute preference). The community high
   score is loaded from and submitted to the backend on a best-effort basis,
   so the game stays fully playable offline.
   ========================================================================== */
(function () {
    'use strict';

    /* ------------------------------------------------------------------
       Configuration
       ------------------------------------------------------------------ */
    const W = 480;
    const H_BASE = 640;
    const H_TALL = 704; // 10% taller playfield on screens with enough room
    let H = H_BASE;
    const LEFT = 14;
    const RIGHT = W - 14;
    const TOP = 14;

    const PADDLE_BASE_W = 92;
    const PADDLE_WIDE_W = 146;
    const PADDLE_H = 12;
    let PADDLE_Y = H - 64;
    const PADDLE_SPEED = 640;

    const BALL_R = 6;
    const BASE_SPEED = 330;
    const SPEED_PER_LEVEL = 30;
    const MAX_SPEED = 550;
    const SLOW_FACTOR = 0.72;
    const STEP = 1 / 120;

    const BRICK_COLS = 9;
    const BRICK_ROWS = 6;
    const BRICK_GAP_X = 6;
    const BRICK_GAP_Y = 8;
    const BRICK_PAD_X = 26;
    const BRICK_TOP = 78;
    const BRICK_H = 22;
    const BRICK_W = Math.floor(
        (W - BRICK_PAD_X * 2 - BRICK_GAP_X * (BRICK_COLS - 1)) / BRICK_COLS
    );

    const ROW_COLORS = ['#fb7185', '#fcd34d', '#4ade80', '#7ec8e3', '#72b2dc', '#1a5f8c'];
    const ROW_POINTS = [60, 50, 40, 30, 20, 10];

    /* Levels 1–2 stay full; from level 3 the layouts cycle through dense,
       left-right symmetric shapes. '1' = brick, '0' = gap. */
    const FULL_LAYOUT = [
        '111111111',
        '111111111',
        '111111111',
        '111111111',
        '111111111',
        '111111111'
    ];

    const SYMMETRIC_LAYOUTS = [
        // Gate – bottom-centre opening
        [
            '111111111',
            '111111111',
            '111111111',
            '111111111',
            '111000111',
            '111000111'
        ],
        // Gem – clipped top/bottom corners
        [
            '011111110',
            '111111111',
            '111111111',
            '111111111',
            '111111111',
            '011111110'
        ],
        // Fortress – central opening
        [
            '111111111',
            '111111111',
            '111000111',
            '111000111',
            '111111111',
            '111111111'
        ],
        // Wave – alternating wide and narrow rows
        [
            '111111111',
            '011111110',
            '111111111',
            '011111110',
            '111111111',
            '011111110'
        ]
    ];

    const POWER_TYPES = {
        wide: { label: 'W', color: '#4ade80', message: 'WIDE PADDLE' },
        multi: { label: 'M', color: '#7ec8e3', message: 'MULTIBALL' },
        slow: { label: 'S', color: '#fcd34d', message: 'SLOW BALL' },
        life: { label: '+', color: '#fb7185', message: 'EXTRA LIFE' }
    };

    const STORAGE_HIGH = 'locate-me.breakout.highscore';
    const STORAGE_MUTED = 'locate-me.breakout.muted';
    const MASTER_VOLUME = 0.2;
    const MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */
    function $(id) {
        return document.getElementById(id);
    }

    function clamp(value, min, max) {
        return value < min ? min : value > max ? max : value;
    }

    function readStorage(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    }

    function writeStorage(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            /* Storage unavailable – the game still works for this session. */
        }
    }

    function readHighScore() {
        const value = parseInt(readStorage(STORAGE_HIGH) || '0', 10);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function formatScore(value) {
        return String(Math.max(0, Math.floor(value))).padStart(6, '0');
    }

    /* ------------------------------------------------------------------
       Community high score
       The backend keeps the personal best of every account and derives the
       community best from those rows. This file is standalone, so it repeats
       the two small pieces it needs from the app: the active userId and the
       API base. The local high score key stays an offline fallback only.
       ------------------------------------------------------------------ */
    const GAME = 'breakout';
    const DEMO_USER_ID = 'user123';
    const SESSION_KEY = 'locate-me.auth';
    const API_PATH = '/api';
    const PENDING = '\u2014';

    /* Same rule as js/config.js: local dev serves the PWA on :8000 and the
       Quarkus dev server on :8080; everywhere else the API is proxied. */
    function apiBase() {
        if (window.location.port === '8000') return 'http://localhost:8090';
        if (window.location.port === '8080') return 'http://localhost:8080';
        return '';
    }

    function activeUserId() {
        const saved = readStorage('userId');
        return (saved && saved.trim() !== '') ? saved.trim() : DEMO_USER_ID;
    }

    /* Mirrors js/auth.js readSession(): only an unexpired token that belongs
       to the active identity may be sent. Anything else falls back to the
       legacy userId parameter (demo and unmigrated accounts). */
    function authToken() {
        let raw;
        try {
            raw = window.localStorage.getItem(SESSION_KEY);
        } catch (e) {
            return null;
        }
        if (!raw) return null;

        let session;
        try {
            session = JSON.parse(raw);
        } catch (e) {
            return null;
        }
        if (!session
            || typeof session.token !== 'string' || session.token === ''
            || typeof session.userId !== 'string' || session.userId === ''
            || typeof session.expiresAt !== 'string') {
            return null;
        }

        const expires = Date.parse(session.expiresAt);
        if (!Number.isFinite(expires) || expires <= Date.now()) return null;
        if (session.userId.toLowerCase() !== activeUserId().toLowerCase()) return null;
        return session.token;
    }

    function highscoreRequest(method, body) {
        const headers = { Accept: 'application/json' };
        const token = authToken();
        if (token) headers.Authorization = 'Bearer ' + token;
        if (body) headers['Content-Type'] = 'application/json';

        const url = apiBase() + API_PATH + '/games/' + GAME +
            '/highscore?userId=' + encodeURIComponent(activeUserId());
        return fetch(url, {
            method: method,
            headers: headers,
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
            credentials: 'omit'
        }).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status);
            return response.json();
        });
    }

    /* ------------------------------------------------------------------
       DOM references
       ------------------------------------------------------------------ */
    const app = $('bp-app');
    const stage = $('bp-stage');
    const wrap = $('bp-canvas-wrap');
    const canvas = $('bp-canvas');
    const ctx = canvas.getContext('2d');

    const scoreEl = $('bp-score');
    const highEl = $('bp-high');
    const communityEl = $('bp-community');
    const communityHeroEl = $('bp-community-hero');
    const levelEl = $('bp-level');
    const livesEl = $('bp-lives');

    const overlay = $('bp-overlay');
    const overlayKicker = $('bp-overlay-kicker');
    const overlayTitle = $('bp-overlay-title');
    const overlayText = $('bp-overlay-text');
    const overlayActionBtn = $('bp-overlay-action');
    const overlayHint = $('bp-overlay-hint');

    const messageEl = $('bp-message');
    const announcer = $('bp-announcer');

    const leftBtn = $('bp-left');
    const rightBtn = $('bp-right');
    const pauseBtn = $('bp-pause');
    const muteBtn = $('bp-mute');
    const fullscreenBtn = $('bp-fullscreen');
    const soundOn = muteBtn.querySelector('.bp-sound-on');
    const soundOff = muteBtn.querySelector('.bp-sound-off');

    /* ------------------------------------------------------------------
       State
       ------------------------------------------------------------------ */
    const motionQuery = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    const state = {
        mode: 'boot',
        score: 0,
        high: readHighScore(),
        lives: 3,
        level: 1,
        newHigh: false,
        balls: [],
        bricks: [],
        powerups: [],
        particles: [],
        paddle: {
            x: (W - PADDLE_BASE_W) / 2,
            y: PADDLE_Y,
            w: PADDLE_BASE_W,
            h: PADDLE_H
        },
        input: { left: false, right: false },
        time: 0,
        shake: 0,
        flash: 0,
        slowActive: false,
        slowTimer: 0,
        wideTimer: 0,
        acc: 0,
        lastTs: 0,
        muted: readStorage(STORAGE_MUTED) === '1',
        reducedMotion: motionQuery ? motionQuery.matches : false,
        audio: { ctx: null, master: null }
    };

    const pointerDirs = new Map();
    let overlayActionFn = null;
    let messageTimer = 0;
    let announceTimer = 0;
    let lastWallSound = 0;
    let resizeScheduled = false;
    let resizeObserver = null;

    /* Community view: null until the backend answered. The game never blocks
       on it, so the arcade stays playable offline and for the demo user. */
    const community = {
        score: null,
        nickname: null
    };
    let submittedHigh = 0;

    /* ------------------------------------------------------------------
       HUD, overlay and announcements
       ------------------------------------------------------------------ */
    function updateHud() {
        scoreEl.textContent = formatScore(state.score);
        highEl.textContent = formatScore(state.high);
        levelEl.textContent = String(state.level).padStart(2, '0');
        livesEl.textContent = String(Math.max(0, state.lives));
    }

    function renderCommunity() {
        if (community.score === null) {
            communityEl.textContent = PENDING;
            communityEl.classList.add('is-pending');
        } else {
            communityEl.textContent = formatScore(community.score);
            communityEl.classList.remove('is-pending');
        }

        const nickname = community.nickname;
        communityHeroEl.textContent = nickname || PENDING;
        communityHeroEl.title = nickname || '';
        communityHeroEl.classList.toggle('is-pending', !nickname);
    }

    function applyHighscore(payload, initial) {
        if (!payload) return;
        const personal = payload.personal;
        const best = payload.community;

        if (personal && typeof personal.score === 'number') {
            // The first successful answer is authoritative for the HIGH card,
            // so a local leftover from another device or identity cannot mask
            // it. Later answers only raise it, never lower a score the player
            // just achieved.
            if (initial && state.score === 0 && !state.newHigh) {
                state.high = personal.score;
                writeStorage(STORAGE_HIGH, String(state.high));
                updateHud();
            } else if (personal.score > state.high) {
                state.high = personal.score;
                writeStorage(STORAGE_HIGH, String(state.high));
                updateHud();
            }
        }

        if (best && typeof best.score === 'number') {
            community.score = best.score;
            community.nickname = (typeof best.nickname === 'string' && best.nickname !== '')
                ? best.nickname
                : 'anonymous';
            renderCommunity();
        }
    }

    function loadHighscore() {
        renderCommunity();
        highscoreRequest('GET').then(function (payload) {
            applyHighscore(payload, true);
        }).catch(function () {
            /* Offline or rejected: keep the cached high and show dashes. */
        });
    }

    function submitHighscore() {
        const score = state.high;
        if (!(score > 0) || score <= submittedHigh) return;
        submittedHigh = score;
        highscoreRequest('POST', { score: score }).then(function (payload) {
            applyHighscore(payload, false);
        }).catch(function () {
            /* Best effort: the next game over retries this score. */
            submittedHigh = 0;
        });
    }

    function showOverlay(config) {
        overlayKicker.textContent = config.kicker || '';
        overlayTitle.textContent = config.title || '';
        overlayText.textContent = config.text || '';
        overlayActionBtn.textContent = config.actionLabel || 'Continue';
        overlayHint.textContent = config.hint || '';
        overlayActionFn = config.action || null;
        overlay.hidden = false;
    }

    function hideOverlay() {
        overlay.hidden = true;
        overlayActionFn = null;
        if (overlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    }

    overlayActionBtn.addEventListener('click', function () {
        const action = overlayActionFn;
        if (action) action();
    });

    function showMessage(text, duration) {
        messageEl.textContent = text;
        messageEl.classList.add('is-visible');
        window.clearTimeout(messageTimer);
        messageTimer = window.setTimeout(function () {
            messageEl.classList.remove('is-visible');
        }, duration || 1200);
    }

    function announce(text) {
        window.clearTimeout(announceTimer);
        announcer.textContent = '';
        announceTimer = window.setTimeout(function () {
            announcer.textContent = text;
        }, 30);
    }

    /* ------------------------------------------------------------------
       Synthesized arcade sound (Web Audio API, no files)
       ------------------------------------------------------------------ */
    function ensureAudio() {
        if (state.muted) return null;

        if (!state.audio.ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            try {
                const audioCtx = new Ctor();
                const master = audioCtx.createGain();
                master.gain.value = MASTER_VOLUME;
                master.connect(audioCtx.destination);
                state.audio.ctx = audioCtx;
                state.audio.master = master;
            } catch (e) {
                return null;
            }
        }

        if (state.audio.ctx.state === 'suspended') {
            state.audio.ctx.resume().catch(function () {});
        }
        return state.audio.ctx;
    }

    function tone(freq, options) {
        if (state.muted) return;
        const audioCtx = ensureAudio();
        if (!audioCtx || !state.audio.master) return;

        const opts = options || {};
        const end = opts.end == null ? freq : opts.end;
        const duration = opts.dur == null ? 0.08 : opts.dur;
        const type = opts.type || 'square';
        const volume = opts.vol == null ? 0.35 : opts.vol;
        const delay = opts.delay || 0;
        const start = audioCtx.currentTime + delay;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, freq), start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(state.audio.master);
        osc.start(start);
        osc.stop(start + duration + 0.03);
    }

    const sfx = {
        launch: function () {
            tone(300, { end: 540, dur: 0.09, vol: 0.35 });
        },
        paddle: function () {
            tone(210, { end: 330, dur: 0.06, vol: 0.42 });
        },
        wall: function () {
            tone(170, { end: 110, dur: 0.035, vol: 0.18 });
        },
        brick: function (row) {
            tone(470 + row * 35, { end: 760 + row * 35, dur: 0.07, vol: 0.34 });
        },
        armor: function () {
            tone(190, { end: 130, dur: 0.09, type: 'sawtooth', vol: 0.3 });
        },
        power: function () {
            [440, 554, 659, 880].forEach(function (freq, index) {
                tone(freq, { dur: 0.09, type: 'triangle', vol: 0.35, delay: index * 0.055 });
            });
        },
        extraLife: function () {
            [523, 784, 1047].forEach(function (freq, index) {
                tone(freq, { dur: 0.12, type: 'square', vol: 0.34, delay: index * 0.08 });
            });
        },
        lifeLost: function () {
            tone(270, { end: 70, dur: 0.45, type: 'sawtooth', vol: 0.4 });
        },
        levelClear: function () {
            [523, 659, 784, 1047].forEach(function (freq, index) {
                tone(freq, { dur: 0.16, type: 'square', vol: 0.32, delay: index * 0.09 });
            });
        },
        gameOver: function () {
            [392, 330, 262, 196, 131].forEach(function (freq, index) {
                tone(freq, { dur: 0.22, type: 'triangle', vol: 0.36, delay: index * 0.13 });
            });
        },
        newHigh: function () {
            [784, 988, 1175, 1568].forEach(function (freq, index) {
                tone(freq, { dur: 0.12, type: 'square', vol: 0.32, delay: index * 0.08 });
            });
        },
        pause: function () {
            tone(300, { end: 220, dur: 0.08, vol: 0.26 });
        },
        resume: function () {
            tone(220, { end: 340, dur: 0.08, vol: 0.26 });
        }
    };

    function updateMuteButton() {
        muteBtn.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
        const label = state.muted ? 'Unmute sound' : 'Mute sound';
        muteBtn.setAttribute('aria-label', label);
        muteBtn.title = label;
        soundOn.classList.toggle('hidden', state.muted);
        soundOff.classList.toggle('hidden', !state.muted);
    }

    function applyMute() {
        if (state.audio.master && state.audio.ctx) {
            state.audio.master.gain.setTargetAtTime(
                state.muted ? 0 : MASTER_VOLUME,
                state.audio.ctx.currentTime,
                0.01
            );
        }
    }

    muteBtn.addEventListener('click', function () {
        state.muted = !state.muted;
        writeStorage(STORAGE_MUTED, state.muted ? '1' : '0');
        if (!state.muted) {
            ensureAudio();
            applyMute();
            sfx.power();
        } else {
            applyMute();
        }
        updateMuteButton();
        announce(state.muted ? 'Sound muted' : 'Sound on');
    });

    /* ------------------------------------------------------------------
       Pause handling
       ------------------------------------------------------------------ */
    function updatePauseButton() {
        const active = state.mode === 'playing' || state.mode === 'paused';
        pauseBtn.disabled = !active;
        const label = state.mode === 'paused' ? 'Resume game' : 'Pause game';
        pauseBtn.setAttribute('aria-label', label);
        pauseBtn.title = label;
    }

    function pauseGame(silent) {
        if (state.mode !== 'playing') return;
        state.mode = 'paused';
        state.acc = 0;
        resetInput();
        if (!silent) sfx.pause();
        showOverlay({
            kicker: 'PAUSED',
            title: 'Take a breath',
            text: 'The ball is waiting right where you left it.',
            actionLabel: 'RESUME',
            action: resumeGame,
            hint: 'Press P or Escape to resume'
        });
        updatePauseButton();
        announce('Game paused.');
    }

    function resumeGame() {
        if (state.mode !== 'paused') return;
        state.mode = 'playing';
        state.acc = 0;
        hideOverlay();
        sfx.resume();
        updatePauseButton();
        announce('Game resumed.');
    }

    function togglePause() {
        if (state.mode === 'playing') {
            pauseGame(false);
        } else if (state.mode === 'paused') {
            resumeGame();
        }
    }

    pauseBtn.addEventListener('click', togglePause);

    /* ------------------------------------------------------------------
       Level / brick generation
       ------------------------------------------------------------------ */
    function buildBricks(level) {
        state.bricks = [];
        const armorModulo = level >= 6 ? 5 : level >= 4 ? 6 : level >= 2 ? 7 : 0;
        const layout = level <= 2
            ? FULL_LAYOUT
            : SYMMETRIC_LAYOUTS[(level - 3) % SYMMETRIC_LAYOUTS.length];

        for (let row = 0; row < BRICK_ROWS; row++) {
            for (let col = 0; col < BRICK_COLS; col++) {
                if (layout[row][col] !== '1') continue;

                const mirrorCol = Math.min(col, BRICK_COLS - 1 - col);
                const armored = armorModulo > 0 &&
                    (row + mirrorCol + level) % armorModulo === 0;
                const maxHp = armored ? 2 : 1;

                state.bricks.push({
                    x: BRICK_PAD_X + col * (BRICK_W + BRICK_GAP_X),
                    y: BRICK_TOP + row * (BRICK_H + BRICK_GAP_Y),
                    w: BRICK_W,
                    h: BRICK_H,
                    row: row,
                    col: col,
                    color: ROW_COLORS[row],
                    points: ROW_POINTS[row] * (armored ? 2 : 1),
                    hp: maxHp,
                    maxHp: maxHp,
                    damaged: false,
                    alive: true
                });
            }
        }
    }

    /* ------------------------------------------------------------------
       Scoring, lives and level flow
       ------------------------------------------------------------------ */
    function addScore(points) {
        state.score += points;
        if (state.score > state.high) {
            state.high = state.score;
            state.newHigh = true;
            writeStorage(STORAGE_HIGH, String(state.high));
        }
        updateHud();
    }

    function saveHighScore() {
        if (state.high > 0) writeStorage(STORAGE_HIGH, String(state.high));
    }

    function currentBallSpeed() {
        const base = Math.min(MAX_SPEED, BASE_SPEED + (state.level - 1) * SPEED_PER_LEVEL);
        return base * (state.slowActive ? SLOW_FACTOR : 1);
    }

    function resetBall() {
        const paddle = state.paddle;
        state.balls = [{
            x: paddle.x + paddle.w / 2,
            y: paddle.y - BALL_R - 2,
            vx: 0,
            vy: 0,
            r: BALL_R,
            stuck: true,
            trail: []
        }];
    }

    function clearPowerups() {
        state.powerups = [];
        state.wideTimer = 0;
        state.slowActive = false;
        state.slowTimer = 0;
        state.paddle.w = PADDLE_BASE_W;
        state.paddle.x = clamp(state.paddle.x, LEFT, RIGHT - state.paddle.w);
    }

    function launchBall() {
        if (state.mode !== 'ready') return;
        const ball = state.balls[0];
        if (!ball || !ball.stuck) return;

        const angle = (Math.random() * 0.9) - 0.45;
        const speed = currentBallSpeed();
        ball.vx = Math.sin(angle) * speed;
        ball.vy = -Math.cos(angle) * speed;
        ball.stuck = false;

        state.mode = 'playing';
        state.acc = 0;
        hideOverlay();
        updatePauseButton();
        sfx.launch();
        announce('Ball launched. Level ' + state.level + '.');
    }

    function startNewGame() {
        resetInput();
        state.score = 0;
        state.lives = 3;
        state.level = 1;
        state.newHigh = false;
        state.paddle.w = PADDLE_BASE_W;
        state.paddle.x = (W - state.paddle.w) / 2;
        state.powerups = [];
        state.particles = [];
        state.shake = 0;
        state.flash = 0;
        clearPowerups();
        buildBricks(1);
        resetBall();
        updateHud();
        state.mode = 'ready';
        hideOverlay();
        launchBall();
        announce('New game. Level 1.');
    }

    function nextLevel() {
        state.level += 1;
        state.powerups = [];
        state.particles = [];
        clearPowerups();
        buildBricks(state.level);
        resetBall();
        updateHud();
        state.mode = 'ready';
        hideOverlay();
        launchBall();
    }

    function onLevelClear() {
        if (state.mode !== 'playing') return;
        state.mode = 'levelclear';
        state.balls = [];
        state.acc = 0;
        clearPowerups();

        const bonus = state.level * 100 + state.lives * 25;
        addScore(bonus);
        saveHighScore();
        sfx.levelClear();

        showOverlay({
            kicker: 'LEVEL CLEAR',
            title: 'Level ' + state.level + ' cleared',
            text: 'Bonus +' + bonus + '. Score ' + formatScore(state.score) + '.',
            actionLabel: 'NEXT LEVEL',
            action: nextLevel,
            hint: 'The next wave is faster.'
        });
        updatePauseButton();
        announce('Level ' + state.level + ' cleared. Bonus ' + bonus + ' points.');
    }

    function loseBall() {
        state.lives -= 1;
        clearPowerups();
        state.shake = state.reducedMotion ? 0 : 9;
        state.flash = state.reducedMotion ? 0 : 0.35;
        updateHud();
        sfx.lifeLost();

        if (state.lives <= 0) {
            state.lives = 0;
            state.mode = 'gameover';
            state.balls = [];
            state.acc = 0;
            saveHighScore();

            const newHigh = state.newHigh;
            if (newHigh) submitHighscore();
            showOverlay({
                kicker: 'GAME OVER',
                title: newHigh ? 'New high score' : 'Game over',
                text: newHigh
                    ? 'Score ' + formatScore(state.score) + '. Not bad for an earthling.'
                    : 'Score ' + formatScore(state.score) + '. High ' + formatScore(state.high) + '.',
                actionLabel: 'PLAY AGAIN',
                action: startNewGame,
                hint: 'The arcade never closes.'
            });
            updatePauseButton();
            sfx.gameOver();
            if (newHigh) window.setTimeout(sfx.newHigh, 800);
            announce('Game over. Score ' + state.score + '.');
        } else {
            state.mode = 'ready';
            resetBall();
            state.acc = 0;
            showOverlay({
                kicker: 'BALL LOST',
                title: state.lives + (state.lives === 1 ? ' LIFE LEFT' : ' LIVES LEFT'),
                text: 'The ball is back on your paddle.',
                actionLabel: 'LAUNCH',
                action: launchBall,
                hint: 'Press Space or tap Launch'
            });
            updatePauseButton();
            announce('Ball lost. ' + state.lives + ' lives left.');
        }
    }

    /* ------------------------------------------------------------------
       Power-ups
       ------------------------------------------------------------------ */
    function spawnExtraBalls() {
        const source = state.balls.filter(function (ball) {
            return !ball.stuck;
        })[0] || state.balls[0];
        if (!source) return;

        const speed = Math.hypot(source.vx, source.vy) || currentBallSpeed();
        const baseAngle = Math.atan2(source.vy, source.vx);
        const offsets = [-0.38, 0.38];

        for (let i = 0; i < offsets.length && state.balls.length < 6; i++) {
            const angle = baseAngle + offsets[i];
            state.balls.push({
                x: source.x,
                y: source.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: BALL_R,
                stuck: false,
                trail: []
            });
        }
    }

    function applyPowerup(type) {
        const info = POWER_TYPES[type];
        if (!info) return;

        let message = info.message;

        if (type === 'wide') {
            state.paddle.w = PADDLE_WIDE_W;
            state.paddle.x = clamp(state.paddle.x, LEFT, RIGHT - state.paddle.w);
            state.wideTimer = 12;
        } else if (type === 'multi') {
            spawnExtraBalls();
        } else if (type === 'slow') {
            if (!state.slowActive) {
                state.slowActive = true;
                state.balls.forEach(function (ball) {
                    if (!ball.stuck) {
                        ball.vx *= SLOW_FACTOR;
                        ball.vy *= SLOW_FACTOR;
                    }
                });
            }
            state.slowTimer = 8;
        } else if (type === 'life') {
            if (state.lives < 5) {
                state.lives += 1;
            } else {
                addScore(250);
                message = 'BONUS +250';
            }
        }

        updateHud();
        showMessage(message);
        if (type === 'life') {
            sfx.extraLife();
        } else {
            sfx.power();
        }
        announce(message);
    }

    function powerChanceForLevel(level) {
        if (level <= 1) return 0.13;
        if (level <= 3) return 0.10;
        return 0.08;
    }

    function pickPowerupType(level) {
        if (level <= 1) {
            const types = ['wide', 'multi', 'slow', 'life'];
            return types[Math.floor(Math.random() * types.length)];
        }

        const roll = Math.random();
        if (roll < 0.30) return 'wide';
        if (roll < 0.60) return 'multi';
        if (roll < 0.85) return 'slow';
        return 'life';
    }

    function maybeDropPowerup(brick) {
        if (state.powerups.length >= 4 ||
            Math.random() >= powerChanceForLevel(state.level)) {
            return;
        }

        let type = pickPowerupType(state.level);
        if (type === 'life' && state.lives >= 5) type = 'wide';

        state.powerups.push({
            x: brick.x + brick.w / 2,
            y: brick.y + brick.h / 2,
            vy: 130,
            size: 18,
            type: type,
            phase: Math.random() * Math.PI * 2
        });
    }

    /* ------------------------------------------------------------------
       Particles
       ------------------------------------------------------------------ */
    function addParticles(x, y, color, count, gravity) {
        if (state.reducedMotion || count <= 0) return;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 150;
            const life = 0.35 + Math.random() * 0.35;
            state.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                gravity: gravity,
                life: life,
                maxLife: life,
                size: 2 + Math.floor(Math.random() * 3),
                color: color
            });
        }

        if (state.particles.length > 220) {
            state.particles.splice(0, state.particles.length - 220);
        }
    }

    function spawnBrickParticles(brick, count) {
        addParticles(
            brick.x + brick.w / 2,
            brick.y + brick.h / 2,
            brick.color,
            count,
            380
        );
    }

    /* ------------------------------------------------------------------
       Input
       ------------------------------------------------------------------ */
    function inputState() {
        let left = state.input.left;
        let right = state.input.right;

        pointerDirs.forEach(function (dir) {
            if (dir === 'left') left = true;
            else if (dir === 'right') right = true;
        });

        return { left: left, right: right };
    }

    function direction() {
        const input = inputState();
        return (input.right ? 1 : 0) - (input.left ? 1 : 0);
    }

    function syncPads() {
        const input = inputState();
        leftBtn.classList.toggle('is-active', input.left);
        rightBtn.classList.toggle('is-active', input.right);
    }

    function resetInput() {
        state.input.left = false;
        state.input.right = false;
        pointerDirs.clear();
        syncPads();
    }

    function bindHold(button, dir) {
        button.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            if (!state.muted) ensureAudio();
            pointerDirs.set(event.pointerId, dir);
            try {
                button.setPointerCapture(event.pointerId);
            } catch (e) {
                /* Pointer capture is a nice-to-have, not a requirement. */
            }
            syncPads();
        });

        function release(event) {
            pointerDirs.delete(event.pointerId);
            syncPads();
        }

        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
        button.addEventListener('contextmenu', function (event) {
            event.preventDefault();
        });
    }

    window.addEventListener('pointerup', function (event) {
        if (pointerDirs.delete(event.pointerId)) syncPads();
    });
    window.addEventListener('pointercancel', function (event) {
        if (pointerDirs.delete(event.pointerId)) syncPads();
    });

    function isLeftKey(key) {
        return key === 'ArrowLeft' || key === 'a' || key === 'A';
    }

    function isRightKey(key) {
        return key === 'ArrowRight' || key === 'd' || key === 'D';
    }

    function primaryAction() {
        if (state.mode === 'ready') {
            launchBall();
        } else if (state.mode === 'paused') {
            resumeGame();
        } else if (overlayActionFn) {
            overlayActionFn();
        }
    }

    document.addEventListener('keydown', function (event) {
        if (isLeftKey(event.key)) {
            state.input.left = true;
            event.preventDefault();
            syncPads();
            if (!state.muted) ensureAudio();
            return;
        }

        if (isRightKey(event.key)) {
            state.input.right = true;
            event.preventDefault();
            syncPads();
            if (!state.muted) ensureAudio();
            return;
        }

        if (event.repeat) return;

        if (event.code === 'Space' || event.key === ' ') {
            const target = event.target;
            if (target instanceof HTMLElement &&
                target.closest('button, a, input, select, textarea')) {
                return;
            }
            event.preventDefault();
            if (!state.muted) ensureAudio();
            primaryAction();
            return;
        }

        if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
            event.preventDefault();
            togglePause();
        }
    });

    document.addEventListener('keyup', function (event) {
        if (isLeftKey(event.key)) state.input.left = false;
        if (isRightKey(event.key)) state.input.right = false;
        syncPads();
    });

    canvas.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        if (!state.muted) ensureAudio();
        if (state.mode === 'ready') launchBall();
    });

    document.addEventListener('pointerdown', function () {
        if (!state.muted) ensureAudio();
    }, { passive: true, once: true });

    document.addEventListener('keydown', function () {
        if (!state.muted) ensureAudio();
    }, { once: true });

    /* ------------------------------------------------------------------
       Fullscreen
       ------------------------------------------------------------------ */
    function initFullscreen() {
        if (!app.requestFullscreen || !document.fullscreenEnabled) {
            fullscreenBtn.hidden = true;
            return;
        }

        fullscreenBtn.addEventListener('click', function () {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(function () {});
            } else {
                app.requestFullscreen().catch(function () {});
            }
        });

        document.addEventListener('fullscreenchange', function () {
            const active = document.fullscreenElement === app;
            const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
            fullscreenBtn.setAttribute('aria-label', label);
            fullscreenBtn.title = label;
            scheduleResize();
        });
    }

    /* ------------------------------------------------------------------
       Update
       ------------------------------------------------------------------ */
    function updatePaddle(dt) {
        if (state.mode !== 'playing' && state.mode !== 'ready') return;

        const paddle = state.paddle;
        const dir = direction();
        if (dir !== 0) {
            paddle.x = clamp(
                paddle.x + dir * PADDLE_SPEED * dt,
                LEFT,
                RIGHT - paddle.w
            );
        }

        if (state.mode === 'ready') {
            const ball = state.balls[0];
            if (ball && ball.stuck) {
                ball.x = paddle.x + paddle.w / 2;
                ball.y = paddle.y - ball.r - 2;
            }
        }
    }

    function updateParticles(dt) {
        for (let i = state.particles.length - 1; i >= 0; i--) {
            const particle = state.particles[i];
            particle.life -= dt;
            if (particle.life <= 0) {
                state.particles.splice(i, 1);
                continue;
            }
            particle.vy += particle.gravity * dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
        }
    }

    function updateEffects(dt) {
        state.shake = Math.max(0, state.shake - dt * 30);
        state.flash = Math.max(0, state.flash - dt * 2.4);
    }

    function updatePowerTimers(dt) {
        if (state.wideTimer > 0) {
            state.wideTimer -= dt;
            if (state.wideTimer <= 0) {
                state.wideTimer = 0;
                state.paddle.w = PADDLE_BASE_W;
                state.paddle.x = clamp(state.paddle.x, LEFT, RIGHT - state.paddle.w);
            }
        }

        if (state.slowActive) {
            state.slowTimer -= dt;
            if (state.slowTimer <= 0) {
                state.slowActive = false;
                state.slowTimer = 0;
                state.balls.forEach(function (ball) {
                    if (!ball.stuck) {
                        ball.vx /= SLOW_FACTOR;
                        ball.vy /= SLOW_FACTOR;
                    }
                });
            }
        }
    }

    function circleHitsBrick(ball, brick) {
        const closestX = clamp(ball.x, brick.x, brick.x + brick.w);
        const closestY = clamp(ball.y, brick.y, brick.y + brick.h);
        const dx = ball.x - closestX;
        const dy = ball.y - closestY;
        return dx * dx + dy * dy <= ball.r * ball.r;
    }

    function resolveBrickCollision(ball, brick) {
        const centerX = brick.x + brick.w / 2;
        const centerY = brick.y + brick.h / 2;
        const dx = ball.x - centerX;
        const dy = ball.y - centerY;
        const overlapX = brick.w / 2 + ball.r - Math.abs(dx);
        const overlapY = brick.h / 2 + ball.r - Math.abs(dy);

        if (overlapX < overlapY) {
            const side = dx === 0 ? (ball.vx >= 0 ? 1 : -1) : (dx < 0 ? -1 : 1);
            ball.x = side < 0 ? brick.x - ball.r : brick.x + brick.w + ball.r;
            ball.vx = side * Math.abs(ball.vx);
        } else {
            const side = dy === 0 ? (ball.vy >= 0 ? 1 : -1) : (dy < 0 ? -1 : 1);
            ball.y = side < 0 ? brick.y - ball.r : brick.y + brick.h + ball.r;
            ball.vy = side * Math.abs(ball.vy);
        }
    }

    function hitBrick(brick) {
        brick.hp -= 1;

        if (brick.hp > 0) {
            brick.damaged = true;
            sfx.armor();
            spawnBrickParticles(brick, 4);
            return;
        }

        brick.alive = false;
        addScore(brick.points);
        sfx.brick(brick.row);
        spawnBrickParticles(brick, 10);
        maybeDropPowerup(brick);
        state.bricks = state.bricks.filter(function (item) {
            return item.alive;
        });
    }

    function collideBricks(ball) {
        for (let i = 0; i < state.bricks.length; i++) {
            const brick = state.bricks[i];
            if (!brick.alive) continue;
            if (circleHitsBrick(ball, brick)) {
                resolveBrickCollision(ball, brick);
                hitBrick(brick);
                return;
            }
        }
    }

    function playWallSound() {
        if (state.time - lastWallSound > 0.05) {
            lastWallSound = state.time;
            sfx.wall();
        }
    }

    function updateBalls(dt) {
        const paddle = state.paddle;

        for (let i = state.balls.length - 1; i >= 0; i--) {
            const ball = state.balls[i];
            if (ball.stuck) continue;

            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;

            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 7) ball.trail.shift();

            if (ball.x - ball.r < LEFT) {
                ball.x = LEFT + ball.r;
                ball.vx = Math.abs(ball.vx);
                playWallSound();
            } else if (ball.x + ball.r > RIGHT) {
                ball.x = RIGHT - ball.r;
                ball.vx = -Math.abs(ball.vx);
                playWallSound();
            }

            if (ball.y - ball.r < TOP) {
                ball.y = TOP + ball.r;
                ball.vy = Math.abs(ball.vy);
                playWallSound();
            }

            if (ball.vy > 0 &&
                ball.y + ball.r >= paddle.y &&
                ball.y - ball.r <= paddle.y + paddle.h &&
                ball.x + ball.r >= paddle.x &&
                ball.x - ball.r <= paddle.x + paddle.w) {

                const relative = clamp(
                    (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2),
                    -1,
                    1
                );
                const angle = relative * 1.05;
                const speed = currentBallSpeed();

                ball.vx = Math.sin(angle) * speed;
                ball.vy = -Math.cos(angle) * speed;
                ball.y = paddle.y - ball.r - 0.1;
                sfx.paddle();
            }

            collideBricks(ball);

            if (ball.y - ball.r > H + 20) {
                state.balls.splice(i, 1);
            }
        }

        if (state.balls.length === 0) {
            loseBall();
        }
    }

    function updatePowerups(dt) {
        const paddle = state.paddle;

        for (let i = state.powerups.length - 1; i >= 0; i--) {
            const powerup = state.powerups[i];
            powerup.y += powerup.vy * dt;

            if (powerup.y - powerup.size / 2 > H + 20) {
                state.powerups.splice(i, 1);
                continue;
            }

            const hitPaddle =
                powerup.y + powerup.size / 2 >= paddle.y &&
                powerup.y - powerup.size / 2 <= paddle.y + paddle.h &&
                powerup.x + powerup.size / 2 >= paddle.x &&
                powerup.x - powerup.size / 2 <= paddle.x + paddle.w;

            if (hitPaddle) {
                const type = powerup.type;
                state.powerups.splice(i, 1);
                addParticles(
                    powerup.x,
                    powerup.y,
                    POWER_TYPES[type].color,
                    8,
                    180
                );
                applyPowerup(type);
            }
        }
    }

    function update(dt) {
        state.time += dt;
        updateEffects(dt);
        updateParticles(dt);
        updatePaddle(dt);

        if (state.mode !== 'playing') return;

        updatePowerTimers(dt);
        updateBalls(dt);
        if (state.mode !== 'playing') return;

        updatePowerups(dt);
        if (state.bricks.length === 0) onLevelClear();
    }

    /* ------------------------------------------------------------------
       Rendering
       ------------------------------------------------------------------ */
    function roundRect(x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + width, y, x + width, y + height, r);
        ctx.arcTo(x + width, y + height, x, y + height, r);
        ctx.arcTo(x, y + height, x, y, r);
        ctx.arcTo(x, y, x + width, y, r);
        ctx.closePath();
    }

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, H);
        gradient.addColorStop(0, '#0f1b31');
        gradient.addColorStop(0.55, '#0b1220');
        gradient.addColorStop(1, '#08101f');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(114, 178, 220, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 32) {
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, H);
        }
        for (let y = 0; y <= H; y += 32) {
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(W, y + 0.5);
        }
        ctx.stroke();

        const glow = ctx.createRadialGradient(W / 2, 180, 20, W / 2, 180, 340);
        glow.addColorStop(0, 'rgba(114, 178, 220, 0.08)');
        glow.addColorStop(1, 'rgba(114, 178, 220, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = 'rgba(114, 178, 220, 0.18)';
        ctx.strokeRect(LEFT - 0.5, TOP - 0.5, RIGHT - LEFT + 1, H - TOP - 0.5);
    }

    function drawBricks() {
        for (let i = 0; i < state.bricks.length; i++) {
            const brick = state.bricks[i];

            ctx.fillStyle = brick.color;
            ctx.fillRect(brick.x, brick.y, brick.w, brick.h);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
            ctx.fillRect(brick.x, brick.y, brick.w, 2);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
            ctx.fillRect(brick.x, brick.y + brick.h - 2, brick.w, 2);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(brick.x + brick.w - 2, brick.y, 2, brick.h);

            if (brick.maxHp > 1) {
                ctx.strokeStyle = 'rgba(248, 250, 252, 0.60)';
                ctx.lineWidth = 1;
                ctx.strokeRect(brick.x + 1.5, brick.y + 1.5, brick.w - 3, brick.h - 3);

                if (brick.damaged) {
                    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
                    ctx.beginPath();
                    ctx.moveTo(brick.x + brick.w * 0.32, brick.y + 3);
                    ctx.lineTo(brick.x + brick.w * 0.48, brick.y + brick.h * 0.5);
                    ctx.lineTo(brick.x + brick.w * 0.38, brick.y + brick.h - 3);
                    ctx.moveTo(brick.x + brick.w * 0.48, brick.y + brick.h * 0.5);
                    ctx.lineTo(brick.x + brick.w * 0.7, brick.y + brick.h * 0.38);
                    ctx.stroke();
                }
            }
        }
    }

    function drawPaddle() {
        const paddle = state.paddle;

        ctx.save();
        ctx.shadowColor = 'rgba(114, 178, 220, 0.75)';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#72b2dc';
        roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 5);
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
        ctx.fillRect(paddle.x + 6, paddle.y + 2, paddle.w - 12, 2);

        ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
        ctx.fillRect(paddle.x + 6, paddle.y + paddle.h - 3, paddle.w - 12, 1);

        ctx.fillStyle = 'rgba(2, 6, 23, 0.30)';
        ctx.fillRect(paddle.x + paddle.w / 2 - 2, paddle.y + 3, 4, 6);
    }

    function drawBalls() {
        for (let i = 0; i < state.balls.length; i++) {
            const ball = state.balls[i];

            for (let t = 0; t < ball.trail.length; t++) {
                const point = ball.trail[t];
                const alpha = ((t + 1) / ball.trail.length) * 0.18;
                ctx.fillStyle = 'rgba(126, 200, 227, ' + alpha.toFixed(3) + ')';
                ctx.fillRect(point.x - 2, point.y - 2, 4, 4);
            }

            ctx.save();
            ctx.shadowColor = 'rgba(126, 200, 227, 0.90)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(ball.x - 4, ball.y - 4, 8, 8);
            ctx.restore();

            ctx.strokeStyle = 'rgba(2, 6, 23, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(ball.x - 4.5, ball.y - 4.5, 9, 9);
        }
    }

    function drawPowerups() {
        for (let i = 0; i < state.powerups.length; i++) {
            const powerup = state.powerups[i];
            const info = POWER_TYPES[powerup.type];
            const size = powerup.size;
            const pulse = 0.55 + Math.sin(state.time * 7 + powerup.phase) * 0.25;

            ctx.save();
            ctx.shadowColor = info.color;
            ctx.shadowBlur = 10;
            ctx.fillStyle = info.color;
            roundRect(powerup.x - size / 2, powerup.y - size / 2, size, size, 5);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(248, 250, 252, ' + pulse.toFixed(3) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();

            ctx.fillStyle = '#06101f';
            ctx.font = '700 11px ' + MONO_FONT;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(info.label, powerup.x, powerup.y + 1);
        }
    }

    function drawParticles() {
        for (let i = 0; i < state.particles.length; i++) {
            const particle = state.particles[i];
            const alpha = Math.max(0, particle.life / particle.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = particle.color;
            ctx.fillRect(
                particle.x - particle.size / 2,
                particle.y - particle.size / 2,
                particle.size,
                particle.size
            );
        }
        ctx.globalAlpha = 1;
    }

    function render() {
        if (!ctx) return;

        ctx.save();

        if (state.shake > 0.2 && !state.reducedMotion) {
            const amount = state.shake;
            ctx.translate(
                (Math.random() - 0.5) * amount,
                (Math.random() - 0.5) * amount
            );
        }

        drawBackground();
        drawBricks();
        drawPowerups();
        drawPaddle();
        drawBalls();
        drawParticles();

        if (state.flash > 0 && !state.reducedMotion) {
            ctx.fillStyle = 'rgba(248, 250, 252, ' +
                Math.min(0.5, state.flash * 0.55).toFixed(3) + ')';
            ctx.fillRect(0, 0, W, H);
        }

        ctx.restore();
    }

    /* ------------------------------------------------------------------
       Canvas sizing and main loop
       ------------------------------------------------------------------ */
    function setupCanvas() {
        if (!ctx) return;

        const stageWidth = stage.clientWidth;
        const stageHeight = stage.clientHeight;
        if (!stageWidth || !stageHeight) return;

        const scale = Math.max(
            0.1,
            Math.min((stageWidth - 2) / W, (stageHeight - 2) / H)
        );
        const cssWidth = Math.max(1, Math.floor(W * scale));
        const cssHeight = Math.max(1, Math.floor(H * scale));

        wrap.style.width = cssWidth + 'px';
        wrap.style.height = cssHeight + 'px';

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
        const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }

        ctx.setTransform(pixelWidth / W, 0, 0, pixelHeight / H, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function configurePlayfieldHeight() {
        const stageWidth = stage.clientWidth - 2;
        const stageHeight = stage.clientHeight - 2;
        const availableLogicalHeight = stageWidth > 0 && stageHeight > 0
            ? (W * stageHeight) / stageWidth
            : 0;

        // Only use the taller field when it still fits at full width. This
        // gives tall phones the extra 10% without making the canvas narrower
        // on short screens, landscape phones or desktop.
        H = availableLogicalHeight >= H_TALL ? H_TALL : H_BASE;
        PADDLE_Y = H - 64;
        state.paddle.y = PADDLE_Y;
        state.paddle.x = clamp(state.paddle.x, LEFT, RIGHT - state.paddle.w);
    }

    function scheduleResize() {
        if (resizeScheduled) return;
        resizeScheduled = true;
        window.requestAnimationFrame(function () {
            resizeScheduled = false;
            setupCanvas();
        });
    }

    function frame(timestamp) {
        if (!state.lastTs) state.lastTs = timestamp;
        let dt = (timestamp - state.lastTs) / 1000;
        state.lastTs = timestamp;

        if (!Number.isFinite(dt) || dt < 0) dt = 0;
        if (dt > 0.05) dt = 0.05;

        state.acc += dt;

        let steps = 0;
        while (state.acc >= STEP && steps < 10) {
            if (state.mode === 'paused' || state.mode === 'gameover') {
                state.acc = 0;
                break;
            }
            update(STEP);
            state.acc -= STEP;
            steps += 1;
        }

        render();
        window.requestAnimationFrame(frame);
    }

    /* ------------------------------------------------------------------
       Lifecycle
       ------------------------------------------------------------------ */
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            resetInput();
            if (state.mode === 'playing') pauseGame(true);
            saveHighScore();
        } else if (state.audio.ctx &&
                   state.audio.ctx.state === 'suspended' &&
                   !state.muted) {
            state.audio.ctx.resume().catch(function () {});
        }
    });

    window.addEventListener('blur', function () {
        resetInput();
        if (state.mode === 'playing') pauseGame(true);
    });

    window.addEventListener('pagehide', saveHighScore);
    window.addEventListener('beforeunload', saveHighScore);

    if (motionQuery && motionQuery.addEventListener) {
        motionQuery.addEventListener('change', function (event) {
            state.reducedMotion = event.matches;
        });
    }

    function initBackNavigation() {
        const backLink = document.querySelector('.bp-back');
        if (!backLink) return;

        backLink.addEventListener('click', function (event) {
            if (event.button !== 0 ||
                event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            try {
                if (window.history.length <= 1) return;
                const referrer = document.referrer;
                if (!referrer || new URL(referrer).origin !== window.location.origin) {
                    return;
                }
            } catch (e) {
                return;
            }

            // Returning through history lets Chrome restore the app from the
            // back-forward cache instead of reloading it. Android standalone
            // reloads can otherwise mis-measure the viewport and clip the
            // bottom navigation.
            event.preventDefault();
            window.history.back();
        });
    }

    function init() {
        updateHud();
        updateMuteButton();
        updatePauseButton();
        loadHighscore();

        // When embedded, the host owns the way back; keep the game chrome clean.
        try {
            if (window.self !== window.top) {
                const back = document.querySelector('.bp-back');
                if (back) back.hidden = true;
            }
        } catch (e) {
            /* Cross-origin embedding must never prevent the game from starting. */
        }

        bindHold(leftBtn, 'left');
        bindHold(rightBtn, 'right');
        initFullscreen();
        initBackNavigation();

        window.addEventListener('resize', scheduleResize);
        if (window.ResizeObserver) {
            resizeObserver = new ResizeObserver(scheduleResize);
            resizeObserver.observe(stage);
        }

        configurePlayfieldHeight();

        buildBricks(1);
        resetBall();
        state.mode = 'ready';
        showOverlay({
            kicker: 'INSERT COIN',
            title: 'Breakout',
            text: 'Clear every brick. Keep the ball alive.',
            actionLabel: 'START',
            action: startNewGame,
            hint: 'Hold the arrows to move · Space launches'
        });

        setupCanvas();
        render();
        window.requestAnimationFrame(frame);
    }

    init();
})();
