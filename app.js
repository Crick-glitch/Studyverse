class StudyVerse {
    constructor() {
        this.data = {
            level: 1,
            totalXP: 0,
            currentLevelXP: 0,
            streak: 0,
            totalTasksCompleted: 0,
            tasks: [],
            // Study sessions and economy
            sessions: [],
            currentSessionId: null,
            studyEnergy: 0,
            flashcards: [],
            skillPoints: 0,
            playerClass: null,
            unlockedSkills: {},
            skillModifiers: {},
            // Whether combat is quiz-only (can be toggled in Settings)
            quizOnlyCombat: true,
            // Avatar / player display
            avatarName: 'Adventurer',
            avatarEmoji: null,
            avatarImage: null,
            soundEnabled: true,
            lastActivityDate: new Date().toDateString(),
            // Raid System
            playerStats: {
                attack: 10,
                defense: 5,
                maxHealth: 100,
                currentHealth: 100
            },
            equipment: {
                weapon: null,
                armor: null
            },
            raidWins: 0,
            raidLosses: 0,
            lastRaidTime: 0,
            raidCooldown: 300000, // 5 minutes in milliseconds
            raidHistory: []
            ,
            // Persist UI prefs
            sessionBarCollapsed: false,
            // Timer persistence (seconds remaining when saved, running flag, and last started timestamp)
            timerSecondsSaved: 25 * 60,
            timerRunning: false,
            timerLastStarted: null
        };

        this.xpThresholds = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250];
        this.motivationalQuotes = [
            "Do something today that your future self will thank you for.",
            "Success is the sum of small efforts repeated day in and day out.",
            "The only way to do great work is to love what you do.",
            "Don't watch the clock; do what it does. Keep going.",
            "Your limitation—it's only your imagination.",
            "Great things never come from comfort zones.",
            "Dream it. Believe it. Build it.",
            "Success doesn't just find you. You have to go out and get it.",
            "The harder you work for something, the greater you'll feel when you achieve it.",
            "Dream bigger. Do bigger."
        ];

        // Boss templates
        this.bossTemplates = [
            { name: 'Goblin Chieftain', sprite: '👹', baseHP: 60, baseATK: 8, baseDEF: 3 },
            { name: 'Orc Warlord', sprite: '🗡️', baseHP: 80, baseATK: 12, baseDEF: 4 },
            { name: 'Dragon Hatchling', sprite: '🐉', baseHP: 100, baseATK: 15, baseDEF: 6 },
            { name: 'Undead Mage', sprite: '💀', baseHP: 70, baseATK: 14, baseDEF: 3 },
            { name: 'Shadow Assassin', sprite: '👤', baseHP: 65, baseATK: 16, baseDEF: 2 }
        ];

        // Skill tree definitions with dependencies and apply effects (balanced)
        this.skillDefinitions = [
            { id: 'power_strike', icon: '⚔️', name: 'Power Strike', cost: 1, desc: '+2 ATK', deps: [], apply: () => { this.data.playerStats.attack += 2; } },
            { id: 'berserk', icon: '🔥', name: 'Berserk', cost: 3, desc: '+30% ATK when HP < 50%', deps: ['power_strike'], apply: () => { this.data.skillModifiers = this.data.skillModifiers || {}; this.data.skillModifiers.berserkMultiplier = 1.3; } },
            { id: 'iron_skin', icon: '🛡️', name: 'Iron Skin', cost: 1, desc: '+2 DEF', deps: [], apply: () => { this.data.playerStats.defense += 2; } },
            { id: 'stone_wall', icon: '🧱', name: 'Stone Wall', cost: 3, desc: '-35% incoming damage when HP < 30%', deps: ['iron_skin'], apply: () => { this.data.skillModifiers = this.data.skillModifiers || {}; this.data.skillModifiers.stoneWallMultiplier = 0.65; } },
            { id: 'scholar_insight', icon: '📚', name: 'Scholar Insight', cost: 2, desc: '+12% Session XP', deps: [], apply: () => { this.data.skillModifiers = this.data.skillModifiers || {}; this.data.skillModifiers.insight = (this.data.skillModifiers.insight || 0) + 0.12; } },
            { id: 'sage_memory', icon: '🧠', name: 'Sage Memory', cost: 3, desc: 'Reduces SRS interval growth', deps: ['scholar_insight'], apply: () => { this.data.skillModifiers = this.data.skillModifiers || {}; this.data.skillModifiers.sageMemoryFactor = 0.85; } }
        ];

        // Combat question queue
        this.combatQuestions = [];
        this.currentQuestionIndex = 0;

        // Loot table
        this.lootTable = [
            { name: 'Iron Sword', type: 'weapon', attack: 3, defense: 0, sprite: '⚔️' },
            { name: 'Steel Sword', type: 'weapon', attack: 5, defense: 0, sprite: '🗡️' },
            { name: 'Dragon Slayer', type: 'weapon', attack: 8, defense: 0, sprite: '⚔️' },
            { name: 'Leather Armor', type: 'armor', attack: 0, defense: 2, sprite: '🛡️' },
            { name: 'Iron Plate', type: 'armor', attack: 0, defense: 4, sprite: '🛡️' },
            { name: 'Dragon Scale', type: 'armor', attack: 0, defense: 6, sprite: '🛡️' }
        ];

        this.loadData();
        // Load question bank provided via a separate data file (questions.js)
        // questions.js attaches the bank to `window.QUESTION_BANK` for file:// compatibility
        this.questionBank = (window && window.QUESTION_BANK) ? window.QUESTION_BANK : [];
        // restore runtime state from persisted data
        this.currentSessionId = this.data.currentSessionId || null;
        this.timerSeconds = Number(this.data.timerSecondsSaved || 25 * 60);
        this._sessionBarCollapsed = !!this.data.sessionBarCollapsed;
        this.initializeEventListeners();
        this.updateAllUI();
        this.checkStreakReset();
        this.startTimerUpdate();

        // If a timer was running when last saved, resume it (adjusting for elapsed time)
        try {
            if (this.data.timerRunning) {
                const saved = Number(this.data.timerSecondsSaved || this.timerSeconds);
                const last = Number(this.data.timerLastStarted || 0);
                const elapsed = last ? Math.floor((Date.now() - last) / 1000) : 0;
                const remaining = Math.max(0, saved - elapsed);
                this.timerSeconds = remaining;
                if (remaining <= 0) {
                    // Timer expired while closed
                    setTimeout(() => this.timerComplete(), 50);
                } else {
                    // Resume ticking
                    setTimeout(() => { this.startTimer(); this.updateAllUI(); }, 50);
                }
            } else {
                // show stored timer value
                this.updateTimerDisplay();
            }
        } catch (e) {}
    }

    // Storage Management
    loadData() {
        const saved = localStorage.getItem('studyverse-data');
        if (saved) {
            this.data = { ...this.data, ...JSON.parse(saved) };
        }
    }

    saveData() {
        localStorage.setItem('studyverse-data', JSON.stringify(this.data));
    }

    // Event Listeners
    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Dashboard
        document.getElementById('add-task-btn').addEventListener('click', () => this.addTask());
        document.getElementById('task-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Tasks Page
        document.getElementById('add-task-btn-2').addEventListener('click', () => this.addTaskFromTasksPage());
        document.getElementById('task-input-2').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTaskFromTasksPage();
        });
        document.getElementById('status-filter').addEventListener('change', () => this.updateTasksList());
        document.getElementById('difficulty-filter').addEventListener('change', () => this.updateTasksList());

        // Raid System
        document.getElementById('start-raid-btn').addEventListener('click', () => this.startRaid());

        // Combat (legacy buttons may be removed when quiz-only combat is enforced)
        const attackBtn = document.getElementById('attack-btn');
        if (attackBtn) attackBtn.addEventListener('click', () => this.playerAttack());
        const defendBtn = document.getElementById('defend-btn');
        if (defendBtn) defendBtn.addEventListener('click', () => this.playerDefend());
        const retreatBtn = document.getElementById('retreat-btn');
        if (retreatBtn) retreatBtn.addEventListener('click', () => this.playerRetreat());

        // Settings - timer controls may be removed from Settings UI; guard listeners
        const timerStartEl = document.getElementById('timer-start');
        if (timerStartEl) timerStartEl.addEventListener('click', () => this.startTimer());
        const timerPauseEl = document.getElementById('timer-pause');
        if (timerPauseEl) timerPauseEl.addEventListener('click', () => this.pauseTimer());
        const timerResetEl = document.getElementById('timer-reset');
        if (timerResetEl) timerResetEl.addEventListener('click', () => this.resetTimer());
        document.getElementById('sound-toggle').addEventListener('change', () => this.toggleSound());
        const quizToggle = document.getElementById('quiz-only-toggle');
        if (quizToggle) quizToggle.addEventListener('change', (e) => this.setQuizOnlyCombat(!!e.target.checked));
        document.getElementById('reset-btn').addEventListener('click', () => this.showResetModal());
        document.getElementById('cancel-reset').addEventListener('click', () => this.hideResetModal());
        document.getElementById('confirm-reset').addEventListener('click', () => this.resetProgress());

        // Sessions UI (Quest Board)
        const createSessionBtn = document.getElementById('create-session-btn');
        if (createSessionBtn) {
            createSessionBtn.addEventListener('click', (e) => {
                // prevent double-creating sessions via rapid clicks
                if (createSessionBtn.dataset.debounceActive === '1') return;
                createSessionBtn.dataset.debounceActive = '1';
                createSessionBtn.disabled = true;
                setTimeout(() => { createSessionBtn.dataset.debounceActive = '0'; createSessionBtn.disabled = false; }, 800);
                const title = document.getElementById('session-title')?.value || 'Quick Session';
                const subject = document.getElementById('session-subject')?.value || 'Other';
                const duration = parseInt(document.getElementById('session-duration')?.value || '25', 10);
                const difficulty = document.getElementById('session-difficulty')?.value || 'medium';
                this.createSession(title, subject, duration, difficulty);
            });
        }

        const activeList = document.getElementById('active-sessions-list');
        if (activeList) {
            activeList.addEventListener('click', (e) => {
                const btn = e.target.closest('.start-session');
                if (!btn) return;
                // debounce rapid clicks to avoid starting multiple sessions
                if (btn.dataset.debounceActive === '1') return;
                btn.dataset.debounceActive = '1';
                setTimeout(() => { btn.dataset.debounceActive = '0'; }, 800);
                const card = btn.closest('.session-card');
                const id = card?.dataset.id || btn.dataset.id;
                if (id) this.startSession(id);
            });
        }

        // Active session bar controls (pause / finish)
        const sessionPauseBtn = document.getElementById('session-pause');
        if (sessionPauseBtn) sessionPauseBtn.addEventListener('click', () => {
            if (this.timerInterval) { this.pauseTimer(); sessionPauseBtn.textContent = 'Resume'; }
            else { this.startTimer(); sessionPauseBtn.textContent = 'Pause'; }
            this.renderActiveSessionBar();
        });

        const sessionFinishBtn = document.getElementById('session-finish');
        if (sessionFinishBtn) sessionFinishBtn.addEventListener('click', () => {
            if (this.currentSessionId) this.finalizeSession();
        });

        // Active session hide/show controls
        const sessionHideBtn = document.getElementById('session-hide');
        if (sessionHideBtn) sessionHideBtn.addEventListener('click', () => {
            this._sessionBarCollapsed = true;
            this.data.sessionBarCollapsed = true;
            this.saveData();
            this.renderActiveSessionBar();
        });

        const sessionShowBtn = document.getElementById('session-show-btn');
        if (sessionShowBtn) sessionShowBtn.addEventListener('click', () => {
            this._sessionBarCollapsed = false;
            this.data.sessionBarCollapsed = false;
            this.saveData();
            this.renderActiveSessionBar();
        });

        // Rename / Customize buttons in Camp (simple handlers)
        const renameBtn = document.getElementById('rename-btn');
        if (renameBtn) renameBtn.addEventListener('click', () => {
            // Open profile modal focused on name
            this.showProfileModal();
            setTimeout(() => {
                const el = document.getElementById('profile-name-input'); if (el) el.focus();
            }, 120);
        });

        // Avatar edit button (top-right of avatar card)
        const avatarEditBtn = document.getElementById('avatar-edit-btn');
        if (avatarEditBtn) avatarEditBtn.addEventListener('click', () => {
            this.showProfileModal();
        });

        // Mobile menu toggle (shows/hides nav menu on small screens)
        const mobileBtn = document.querySelector('.mobile-menu-btn');
        const navMenu = document.querySelector('.nav-menu');
        if (mobileBtn && navMenu) mobileBtn.addEventListener('click', () => navMenu.classList.toggle('open'));

        // Export / Import Flashcards (CSV)
        const exportBtn = document.getElementById('export-flashcards-btn');
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportFlashcardsCSV());
        const importBtn = document.getElementById('import-flashcards-btn');
        const importInput = document.getElementById('import-flashcards-input');
        if (importBtn && importInput) {
            // Using vanilla FileReader & Blob APIs; no external libraries required.
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => { this.importFlashcardsCSV(ev.target.result); };
                reader.readAsText(file);
                importInput.value = '';
            });
        }

        // Timer
        this.timerInterval = null;
        this.timerSeconds = 25 * 60;

        // Session focus tracking
        this.sessionFocusLostSeconds = 0;
        this.sessionLastHiddenTime = null;
        this._boundVisibilityHandler = null;
        this._boundBlurHandler = null;
        this._boundFocusHandler = null;

        // Combat state
        this.inCombat = false;
        this.currentBoss = null;
        this.currentBossHP = 0;
        this.playerDefending = false;
        this.bossDefending = false;
        this.combatInProgress = false;
    }

    // Timer Update Loop - Real-time display
    startTimerUpdate() {
        setInterval(() => {
            if (this.timerInterval) {
                this.updateTimerDisplay();
                this.renderActiveSessionBar();
            }
        }, 100);
    }

    // Navigation
    handleNavigation(e) {
        e.preventDefault();
        const page = e.target.dataset.page;
        
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`${page}-page`).classList.add('active');

        if (page === 'stats') {
            this.updateStatsPage();
        } else if (page === 'tasks') {
            this.updateTasksList();
        }
    }

    // Task Management
    addTask() {
        const input = document.getElementById('task-input');
        const difficulty = document.getElementById('difficulty-select').value;
        
        if (input.value.trim()) {
            this.createTask(input.value, difficulty);
            input.value = '';
            document.getElementById('difficulty-select').value = 'medium';
        }
    }

    addTaskFromTasksPage() {
        const input = document.getElementById('task-input-2');
        const difficulty = document.getElementById('difficulty-select-2').value;
        
        if (input.value.trim()) {
            this.createTask(input.value, difficulty);
            input.value = '';
            document.getElementById('difficulty-select-2').value = 'medium';
        }
    }

    createTask(title, difficulty) {
        const task = {
            id: Date.now().toString(),
            title,
            difficulty,
            completed: false,
            createdDate: new Date().toDateString()
        };
        this.data.tasks.push(task);
        this.saveData();
        this.playSound('complete');
        this.updateAllUI();
    }

    completeTask(taskId) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (task && !task.completed) {
            task.completed = true;
            const xpGained = this.getXPForDifficulty(task.difficulty);
            this.addXP(xpGained);
            this.data.totalTasksCompleted++;
            this.saveData();
            this.playSound('xp');
            this.showXPBurst(xpGained);
            this.updateAllUI();
        }
    }

    deleteTask(taskId) {
        this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
        this.saveData();
        this.updateAllUI();
    }

    // XP and Leveling
    addXP(amount) {
        this.data.totalXP += amount;
        this.data.currentLevelXP += amount;

        const nextLevelThreshold = this.xpThresholds[this.data.level] || 
                                   this.xpThresholds[this.xpThresholds.length - 1] + (this.data.level - this.xpThresholds.length + 1) * 500;

        if (this.data.currentLevelXP >= nextLevelThreshold) {
            this.levelUp();
        }
    }

    levelUp() {
        this.data.level++;
        this.data.currentLevelXP = 0;
        // Increase stats on level up
        this.data.playerStats.attack += 2;
        this.data.playerStats.defense += 1;
        this.data.playerStats.maxHealth += 10;
        this.data.playerStats.currentHealth = this.data.playerStats.maxHealth;
        // Award a skill point on level up
        this.data.skillPoints = (this.data.skillPoints || 0) + 1;
        this.showToast('+1 Skill Point');
        this.playSound('levelup');
        this.createConfetti();
        this.showLevelUpMessage();
    }

    getXPForDifficulty(difficulty) {
        const xpMap = { easy: 10, medium: 25, hard: 50 };
        return xpMap[difficulty] || 25;
    }

    // Raid System
    startRaid() {
        const energyCost = 3;
        if (this.data.studyEnergy < energyCost) {
            this.showToast('Not enough Energy to start a raid');
            return;
        }

        const now = Date.now();
        const timeSinceLastRaid = now - this.data.lastRaidTime;

        if (timeSinceLastRaid < this.data.raidCooldown) {
            const secondsRemaining = Math.ceil((this.data.raidCooldown - timeSinceLastRaid) / 1000);
            alert(`Raid on cooldown. Try again in ${secondsRemaining} seconds.`);
            return;
        }

        // Deduct energy (cost to attempt raid)
        this.data.studyEnergy -= energyCost;
        this.data.lastRaidTime = now;

        // Determine subject from selector (prefer explicit selector; otherwise use last session subject)
        const subjEl = document.getElementById('raid-subject-select');
        let subject = 'Any';
        if (subjEl) {
            const val = String(subjEl.value || '').trim();
            if (val && val.toLowerCase() !== 'any') subject = val;
            else if (this.data.lastSessionSubject) subject = this.data.lastSessionSubject;
            else subject = 'Any';
        } else {
            subject = this.data.lastSessionSubject || 'Any';
        }

        // Generate boss
        const bossTemplate = this.bossTemplates[Math.floor(Math.random() * this.bossTemplates.length)];
        const levelScaling = 1 + (this.data.level * 0.1);

        this.currentBoss = {
            name: bossTemplate.name,
            sprite: bossTemplate.sprite,
            maxHP: Math.floor(bossTemplate.baseHP * levelScaling),
            currentHP: Math.floor(bossTemplate.baseHP * levelScaling),
            attack: Math.floor(bossTemplate.baseATK * levelScaling),
            defense: Math.floor(bossTemplate.baseDEF * levelScaling)
        };

        this.currentBossHP = this.currentBoss.currentHP;
        this.playerDefending = false;
        this.bossDefending = false;
        this.inCombat = true;
        this.combatInProgress = false;

        // Build combat questions from flashcards (prefer due cards) or fallback
        this.combatQuestions = this.getQuestionsForSubject(subject, 10, true);
        this.currentQuestionIndex = 0;

        this.saveData();
        this.updateAllUI();
        this.showCombatModal();
        this.showCombatQuestion(0);
    }

    showCombatModal() {
        document.getElementById('combat-modal').style.display = 'flex';
        document.getElementById('dungeon-name').textContent = `Dungeon Level ${this.data.level}`;
        document.getElementById('boss-name').textContent = this.currentBoss.name;
        document.getElementById('boss-sprite').textContent = this.currentBoss.sprite;
        // Hide legacy action buttons when quiz-only combat is enabled
        const actions = document.getElementById('combat-actions');
        if (actions) {
            if (this.data.quizOnlyCombat) actions.style.display = 'none';
            else actions.style.display = 'flex';
        }
        this.updateCombatDisplay();
        this.clearCombatLog();
        this.addCombatLog('Battle started!', 'neutral');
    }

    updateCombatDisplay() {
        // Player stats
        document.getElementById('combat-player-hp').textContent = this.data.playerStats.currentHealth;
        document.getElementById('combat-player-atk').textContent = this.data.playerStats.attack;
        document.getElementById('combat-player-def').textContent = this.data.playerStats.defense;
        
        const playerHPPercent = (this.data.playerStats.currentHealth / this.data.playerStats.maxHealth) * 100;
        document.getElementById('player-health-bar').style.width = playerHPPercent + '%';
        document.getElementById('player-health-bar').textContent = 
            `${this.data.playerStats.currentHealth}/${this.data.playerStats.maxHealth}`;

        // Boss stats
        document.getElementById('combat-boss-hp').textContent = this.currentBoss.currentHP;
        document.getElementById('combat-boss-atk').textContent = this.currentBoss.attack;
        document.getElementById('combat-boss-def').textContent = this.currentBoss.defense;
        
        const bossHPPercent = (this.currentBoss.currentHP / this.currentBoss.maxHP) * 100;
        document.getElementById('boss-health-bar').style.width = bossHPPercent + '%';
        document.getElementById('boss-health-bar').textContent = 
            `${this.currentBoss.currentHP}/${this.currentBoss.maxHP}`;
    }

    playerAttack() {
        if (!this.inCombat || this.combatInProgress) return;
        this.combatInProgress = true;

        this.disableCombatActions();

        // Calculate damage
        const baseDamage = this.data.playerStats.attack;
        const variance = Math.floor(Math.random() * 5) - 2;
        const bossDef = this.bossDefending ? this.currentBoss.defense * 1.5 : this.currentBoss.defense;
        const damage = Math.max(1, baseDamage + variance - bossDef);

        this.currentBoss.currentHP -= damage;
        this.addCombatLog(`You attack for ${damage} damage!`, 'player');
        this.updateCombatDisplay();

        if (this.currentBoss.currentHP <= 0) {
            this.endCombat(true);
            return;
        }

        // Boss attacks after 2-3 seconds
        setTimeout(() => this.bossAttack(), 2000 + Math.random() * 1000);
    }

    playerDefend() {
        if (!this.inCombat || this.combatInProgress) return;
        this.combatInProgress = true;

        this.disableCombatActions();

        this.playerDefending = true;
        this.addCombatLog('You take a defensive stance!', 'player');

        // Boss attacks after 2-3 seconds
        setTimeout(() => this.bossAttack(), 2000 + Math.random() * 1000);
    }

    playerRetreat() {
        if (!this.inCombat || this.combatInProgress) return;

        // Always succeed (per user preference)
        this.addCombatLog('You successfully retreated!', 'player');
        this.closeCombat();
    }

    bossAttack() {
        if (!this.inCombat) return;

        const baseDamage = this.currentBoss.attack;
        const variance = Math.floor(Math.random() * 5) - 2;
        const playerDef = this.playerDefending ? this.data.playerStats.defense * 1.5 : this.data.playerStats.defense;
        let damage = Math.max(1, baseDamage + variance - playerDef);
        // Stone Wall: support numeric multiplier (new) or legacy boolean flag
        let stoneMul = null;
        if (this.data.skillModifiers) {
            if (typeof this.data.skillModifiers.stoneWallMultiplier === 'number') stoneMul = this.data.skillModifiers.stoneWallMultiplier;
            else if (this.data.skillModifiers.stoneWall) stoneMul = 0.7;
        }
        if (stoneMul && this.data.playerStats.currentHealth <= (this.data.playerStats.maxHealth * 0.3)) {
            damage = Math.max(1, Math.floor(damage * stoneMul));
        }

        this.data.playerStats.currentHealth -= damage;
        this.addCombatLog(`${this.currentBoss.name} attacks for ${damage} damage!`, 'boss');

        this.playerDefending = false;
        this.bossDefending = Math.random() > 0.7; // 30% chance boss defends

        if (this.bossDefending) {
            this.addCombatLog(`${this.currentBoss.name} takes a defensive stance!`, 'boss');
        }

        if (this.data.playerStats.currentHealth <= 0) {
            this.endCombat(false);
            return;
        }

        this.updateCombatDisplay();
        this.combatInProgress = false;
        this.enableCombatActions();
    }

    endCombat(victory) {
        this.inCombat = false;
        this.data.lastRaidTime = Date.now();

        const resultDiv = document.getElementById('combat-result');
        resultDiv.style.display = 'block';

        if (victory) {
            this.data.raidWins++;
            const loot = this.generateLoot();
            let xpReward = Math.floor(50 * (1 + this.data.level * 0.2));

            // Scholar class: bonus XP and energy
            let energyReward = Math.max(1, Math.floor(this.currentBoss.maxHP / 80));
            if (this.data.playerClass === 'scholar') {
                xpReward = Math.ceil(xpReward * 1.15);
                energyReward += 1;
            }
            // skill tree insight bonus
            const insight = (this.data.skillModifiers && this.data.skillModifiers.insight) ? this.data.skillModifiers.insight : 0;
            if (insight) xpReward = Math.ceil(xpReward * (1 + insight));

            this.addXP(xpReward);
            this.addCombatLog(`VICTORY! You gained ${xpReward} XP!`, 'heal');
            this.data.studyEnergy = (this.data.studyEnergy || 0) + energyReward;

            resultDiv.innerHTML = `
                <div class="combat-result victory">
                    <div class="result-title">🎉 VICTORY! 🎉</div>
                    <div class="result-details">You defeated ${this.currentBoss.name}!</div>
                    <div class="loot-container">
                        <div class="loot-title">⭐ Loot Received:</div>
                        <div class="loot-item">
                            <span class="item-name">${loot.name}</span>
                            <span class="item-stat">${loot.type === 'weapon' ? '+' + loot.attack + ' ATK' : '+' + loot.defense + ' DEF'}</span>
                        </div>
                        <div class="loot-item">
                            <span class="item-name">+${xpReward} XP</span>
                        </div>
                        <div class="loot-item">
                            <span class="item-name">+${energyReward} Energy</span>
                        </div>
                    </div>
                    <button onclick="app.closeCombat()" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Continue</button>
                </div>
            `;

            this.playSound('levelup');
            this.createConfetti();
            this.equipItem(loot);
        } else {
            this.data.raidLosses++;
            this.addCombatLog('DEFEAT! You were defeated...', 'damage');

            resultDiv.innerHTML = `
                <div class="combat-result defeat">
                    <div class="result-title">💀 DEFEAT 💀</div>
                    <div class="result-details">You were defeated by ${this.currentBoss.name}...</div>
                    <div class="result-details">But you'll be stronger next time!</div>
                    <button onclick="app.closeCombat()" class="btn btn-secondary" style="width: 100%; margin-top: 1rem;">Try Again</button>
                </div>
            `;

            this.playSound('complete');
        }

        // Add to raid history
        this.data.raidHistory.unshift({
            boss: this.currentBoss.name,
            victory: victory,
            date: new Date().toLocaleString(),
            level: this.data.level
        });

        if (this.data.raidHistory.length > 20) {
            this.data.raidHistory.pop();
        }

        this.saveData();
        this.updateAllUI();
        this.disableCombatActions();
    }

    closeCombat() {
        document.getElementById('combat-modal').style.display = 'none';
        document.getElementById('combat-result').style.display = 'none';
        this.data.playerStats.currentHealth = this.data.playerStats.maxHealth;
        this.enableCombatActions();
        this.updateAllUI();
    }

    disableCombatActions() {
        const container = document.getElementById('combat-actions');
        if (container) container.style.display = 'none';
        const attack = document.getElementById('attack-btn'); if (attack) attack.disabled = true;
        const defend = document.getElementById('defend-btn'); if (defend) defend.disabled = true;
        const retreat = document.getElementById('retreat-btn'); if (retreat) retreat.disabled = true;
    }

    enableCombatActions() {
        const container = document.getElementById('combat-actions');
        if (container) container.style.display = 'flex';
        const attack = document.getElementById('attack-btn'); if (attack) attack.disabled = false;
        const defend = document.getElementById('defend-btn'); if (defend) defend.disabled = false;
        const retreat = document.getElementById('retreat-btn'); if (retreat) retreat.disabled = false;
        // If quiz-only combat is enabled, hide the actions
        if (this.data.quizOnlyCombat) {
            if (container) container.style.display = 'none';
        }
    }

    generateLoot() {
        return this.lootTable[Math.floor(Math.random() * this.lootTable.length)];
    }

    equipItem(item) {
        if (item.type === 'weapon') {
            if (this.data.equipment.weapon) {
                this.data.playerStats.attack -= this.data.equipment.weapon.attack;
            }
            this.data.equipment.weapon = item;
            this.data.playerStats.attack += item.attack;
        } else if (item.type === 'armor') {
            if (this.data.equipment.armor) {
                this.data.playerStats.defense -= this.data.equipment.armor.defense;
            }
            this.data.equipment.armor = item;
            this.data.playerStats.defense += item.defense;
        }
        this.saveData();
    }

    addCombatLog(message, type = 'neutral') {
        const log = document.getElementById('combat-log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    clearCombatLog() {
        const log = document.getElementById('combat-log');
        log.innerHTML = '';
    }

    // Streak Management
    checkStreakReset() {
        const today = new Date().toDateString();
        const lastDate = this.data.lastActivityDate;

        if (lastDate !== today) {
            const lastDateObj = new Date(lastDate);
            const todayObj = new Date(today);
            const daysDiff = Math.floor((todayObj - lastDateObj) / (1000 * 60 * 60 * 24));

            if (daysDiff === 1) {
                this.data.streak++;
            } else if (daysDiff > 1) {
                this.data.streak = 1;
            }
            this.data.lastActivityDate = today;
            this.saveData();
        }
    }

    // Timer
    startTimer() {
        if (this.timerInterval) return;

        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) startBtn.disabled = true;
        if (pauseBtn) pauseBtn.disabled = false;

        // persist running state
        this.data.timerRunning = true;
        this.data.timerLastStarted = Date.now();
        this.data.timerSecondsSaved = Number(this.timerSeconds || 0);
        this.saveData();

        this._timerTickCounter = 0;
        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            this._timerTickCounter = (this._timerTickCounter || 0) + 1;
            // periodically persist remaining seconds to surviving reloads
            if (this._timerTickCounter % 5 === 0) {
                this.data.timerSecondsSaved = Number(this.timerSeconds || 0);
                this.data.timerLastStarted = Date.now();
                this.saveData();
            }

            if (this.timerSeconds <= 0) {
                this.timerComplete();
            }
        }, 1000);
    }

    pauseTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;

        // persist paused state
        this.data.timerRunning = false;
        this.data.timerSecondsSaved = Number(this.timerSeconds || 0);
        this.data.timerLastStarted = null;
        this.saveData();
    }

    resetTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.timerSeconds = 25 * 60;
        this.updateTimerDisplay();
        const startBtn = document.getElementById('timer-start');
        const pauseBtn = document.getElementById('timer-pause');
        if (startBtn) startBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = true;
        const completeMsg = document.getElementById('timer-complete-message'); if (completeMsg) completeMsg.style.display = 'none';

        // persist reset state
        this.data.timerRunning = false;
        this.data.timerSecondsSaved = this.timerSeconds;
        this.data.timerLastStarted = null;
        this.saveData();
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        const text = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const timerVal = document.getElementById('timer-value');
        if (timerVal) timerVal.textContent = text;
        const activeTimer = document.getElementById('active-timer');
        if (activeTimer) activeTimer.textContent = text;
    }

    timerComplete() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;

        // persist stopped/completed state
        this.data.timerRunning = false;
        this.data.timerSecondsSaved = 0;
        this.data.timerLastStarted = null;
        this.saveData();

        // If a study session was running, finalize it instead of generic timer complete
        if (this.currentSessionId) {
            this.finalizeSession();
            const startBtn = document.getElementById('timer-start'); if (startBtn) startBtn.disabled = false;
            const pauseBtn = document.getElementById('timer-pause'); if (pauseBtn) pauseBtn.disabled = true;
            return;
        }

        this.playSound('levelup');
        const completeMsg = document.getElementById('timer-complete-message'); if (completeMsg) completeMsg.style.display = 'block';
        const startBtn = document.getElementById('timer-start'); if (startBtn) startBtn.disabled = false;
        const pauseBtn = document.getElementById('timer-pause'); if (pauseBtn) pauseBtn.disabled = true;
    }

    // Settings
    toggleSound() {
        this.data.soundEnabled = !this.data.soundEnabled;
        this.saveData();
    }

    showResetModal() {
        document.getElementById('reset-modal').style.display = 'flex';
    }

    hideResetModal() {
        document.getElementById('reset-modal').style.display = 'none';
    }

    resetProgress() {
        // Reset full player data including histories and sessions
        this.data = {
            level: 1,
            totalXP: 0,
            currentLevelXP: 0,
            streak: 0,
            totalTasksCompleted: 0,
            tasks: [],
            sessions: [],
            currentSessionId: null,
            studyEnergy: 0,
            flashcards: [],
            skillPoints: 0,
            playerClass: null,
            unlockedSkills: {},
            skillModifiers: {},
            quizOnlyCombat: true,
            avatarName: 'Adventurer',
            avatarEmoji: null,
            avatarImage: null,
            soundEnabled: true,
            lastActivityDate: new Date().toDateString(),
            playerStats: {
                attack: 10,
                defense: 5,
                maxHealth: 100,
                currentHealth: 100
            },
            equipment: {
                weapon: null,
                armor: null
            },
            raidWins: 0,
            raidLosses: 0,
            lastRaidTime: 0,
            raidCooldown: 300000,
            raidHistory: []
        };
        this.saveData();
        this.hideResetModal();
        this.updateAllUI();
        this.playSound('complete');
    }

    // Sound Effects
    playSound(type) {
        if (!this.data.soundEnabled) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            switch (type) {
                case 'xp':
                    oscillator.frequency.value = 800;
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.1);
                    break;
                case 'levelup':
                    oscillator.frequency.value = 1200;
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.3);
                    break;
                case 'complete':
                    oscillator.frequency.value = 600;
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.15);
                    break;
            }
        } catch (e) {
            // Audio context error - continue without sound
        }
    }

    // Visual Effects
    showXPBurst(xp) {
        const burst = document.createElement('div');
        burst.textContent = `+${xp} XP`;
        burst.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #D4AF37;
            font-size: 2rem;
            font-weight: bold;
            font-family: Cinzel;
            pointer-events: none;
            z-index: 9999;
            animation: xp-burst 1s ease-out forwards;
            text-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
        `;
        document.body.appendChild(burst);
        setTimeout(() => burst.remove(), 1000);
    }

    showLevelUpMessage() {
        const message = document.createElement('div');
        message.textContent = '🎉 LEVEL UP! 🎉';
        message.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 4rem;
            font-weight: bold;
            color: #D4AF37;
            font-family: Cinzel;
            text-shadow: 0 0 30px rgba(212, 175, 55, 0.8);
            z-index: 9998;
            animation: level-up-flash 0.6s ease-out forwards;
            pointer-events: none;
        `;
        document.body.appendChild(message);
        setTimeout(() => message.remove(), 600);
    }

    createConfetti() {
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${['#A78BFA', '#06B6D4', '#D4AF37'][Math.floor(Math.random() * 3)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                border-radius: 50%;
                pointer-events: none;
                z-index: 9997;
                animation: confetti-fall ${2 + Math.random() * 1}s linear forwards;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }
    }

    // UI Updates
    updateAllUI() {
        this.renderActiveSessionBar();
        this.updateDashboard();
        this.updateActiveSessionsUI();
        this.updateTasksList();
        this.updateStatsPage();
        this.updateSettings();
        this.updateRaidUI();
        this.renderFlashcardsUI();
        this.renderSkillTreeUI();
    }

    updateRaidUI() {
        const now = Date.now();
        const timeSinceLastRaid = now - this.data.lastRaidTime;
        const raidBtn = document.getElementById('start-raid-btn');
        const cooldownDisplay = document.getElementById('raid-cooldown-display');

        if (timeSinceLastRaid < this.data.raidCooldown) {
            raidBtn.disabled = true;
            const secondsRemaining = Math.ceil((this.data.raidCooldown - timeSinceLastRaid) / 1000);
            cooldownDisplay.style.display = 'block';
            cooldownDisplay.textContent = `⏱️ Raid available in ${secondsRemaining}s`;
        } else {
            raidBtn.disabled = false;
            cooldownDisplay.style.display = 'none';
        }

        document.getElementById('player-attack').textContent = this.data.playerStats.attack;
        document.getElementById('player-defense').textContent = this.data.playerStats.defense;
        document.getElementById('player-health').textContent = this.data.playerStats.maxHealth;
        document.getElementById('raid-wins').textContent = this.data.raidWins;

        // Update equipment display
        const weaponSlot = document.getElementById('weapon-slot');
        const armorSlot = document.getElementById('armor-slot');

        if (this.data.equipment.weapon) {
            weaponSlot.innerHTML = `
                <div class="item-icon">${this.data.equipment.weapon.sprite}</div>
                <div class="item-title">${this.data.equipment.weapon.name}</div>
                <div class="item-bonus">+${this.data.equipment.weapon.attack} ATK</div>
            `;
        } else {
            weaponSlot.textContent = 'None';
        }

        if (this.data.equipment.armor) {
            armorSlot.innerHTML = `
                <div class="item-icon">${this.data.equipment.armor.sprite}</div>
                <div class="item-title">${this.data.equipment.armor.name}</div>
                <div class="item-bonus">+${this.data.equipment.armor.defense} DEF</div>
            `;
        } else {
            armorSlot.textContent = 'None';
        }

        const energyDisplay = document.getElementById('raid-energy-display');
        if (energyDisplay) energyDisplay.textContent = `Energy: ${this.data.studyEnergy}`;

        // Prefill raid subject selector with last session subject when selector is 'any' or unset
        try {
            const subjEl = document.getElementById('raid-subject-select');
            if (subjEl && this.data.lastSessionSubject) {
                const curr = String(subjEl.value || '').toLowerCase();
                if (!curr || curr === 'any') {
                    const subjVal = this.data.lastSessionSubject;
                    const exists = Array.from(subjEl.options).some(o => String(o.value) === subjVal);
                    if (!exists) {
                        const opt = document.createElement('option');
                        opt.value = subjVal;
                        opt.text = subjVal;
                        subjEl.appendChild(opt);
                    }
                    subjEl.value = subjVal;
                }
            }
        } catch (e) {}
    }

    // Player class selection
    setPlayerClass(className) {
        this.data.playerClass = className;
        this.saveData();
        this.showToast(`Class set: ${className}`);
        this.updateAllUI();
    }

    spendSkillPoint(skill) {
        if (!this.data.skillPoints || this.data.skillPoints <= 0) { this.showToast('No skill points available'); return; }
        switch (skill) {
            case 'power':
                this.data.playerStats.attack += 2;
                this.showToast('Power Strike unlocked: +2 ATK');
                break;
            case 'fortify':
                this.data.playerStats.defense += 1;
                this.showToast('Fortify unlocked: +1 DEF');
                break;
            case 'focus':
                this.data.playerStats.maxHealth += 5;
                this.data.playerStats.currentHealth += 5;
                this.showToast('Focus unlocked: +5 Max HP');
                break;
            default:
                this.showToast('Unknown skill');
                return;
        }
        this.data.skillPoints -= 1;
        this.saveData();
        this.updateAllUI();
    }

    // Unlockable skill tree nodes (now checks dependencies)
    unlockSkill(skillId) {
        this.data.unlockedSkills = this.data.unlockedSkills || {};
        const def = (this.skillDefinitions || []).find(s => s.id === skillId);
        if (!def) { this.showToast('Unknown skill'); return; }
        if (this.data.unlockedSkills[skillId]) { this.showToast(`${def.name} already unlocked`); return; }

        // Check dependencies
        const unmet = (def.deps || []).filter(d => !this.data.unlockedSkills[d]);
        if (unmet.length > 0) {
            const names = (this.skillDefinitions || []).filter(s => unmet.includes(s.id)).map(s => s.name).join(', ');
            this.showToast(`Requires: ${names}`);
            return;
        }

        if ((this.data.skillPoints || 0) < def.cost) { this.showToast('Not enough skill points'); return; }

        this.data.skillPoints -= def.cost;
        this.data.unlockedSkills[skillId] = true;
        try { if (typeof def.apply === 'function') def.apply(); } catch (e) {}
        this.saveData();
        this.showToast(`Unlocked ${def.name}`);
        this.updateAllUI();
    }

    renderSkillTreeUI() {
        const container = document.getElementById('skill-tree-container');
        if (!container) return;
        const skills = this.skillDefinitions || [];

        container.innerHTML = skills.map(s => {
            const unlocked = this.data.unlockedSkills && this.data.unlockedSkills[s.id];
            const depsMet = (s.deps || []).every(d => this.data.unlockedSkills && this.data.unlockedSkills[d]);
            const canUnlock = !unlocked && depsMet && ((this.data.skillPoints || 0) >= s.cost);
            const unmetDeps = (s.deps || []).filter(d => !(this.data.unlockedSkills && this.data.unlockedSkills[d]));
            const unmetNames = unmetDeps.map(id => (this.skillDefinitions.find(x => x.id === id) || {}).name || id).join(', ');
            const pointsShortage = Math.max(0, (s.cost || 0) - (this.data.skillPoints || 0));
            const buttonTitle = unlocked ? 'Unlocked' : (!depsMet ? `Requires: ${unmetNames}` : (pointsShortage > 0 ? `Need ${pointsShortage} more skill points` : `Unlock ${s.name}`));
            return `
                <div class="skill-node ${unlocked ? 'unlocked' : (depsMet ? 'available' : 'locked')}" title="${s.desc}" tabindex="0" data-skill-id="${s.id}" role="group" aria-label="${s.name}: ${s.desc}">
                    <div>
                        <div class="skill-head">
                            <div class="skill-icon">${s.icon || '✨'}</div>
                            <div class="skill-meta">
                                <div class="skill-title">${s.name}</div>
                                <div class="skill-desc">${s.desc}</div>
                            </div>
                            <div class="skill-right">
                                ${unlocked ? '<div class="skill-unlocked">✓</div>' : `<div class="skill-cost-badge" aria-hidden="true">${s.cost}</div>`}
                            </div>
                        </div>
                        ${unmetDeps.length ? `<div class="deps">Requires: ${unmetNames}</div>` : ''}
                    </div>
                    <div class="skill-footer">
                        ${unlocked ? '<div class="skill-unlocked">Unlocked</div>' : `<button class="btn btn-primary unlock-skill" data-id="${s.id}" ${canUnlock ? '' : 'disabled'} title="${buttonTitle}">Unlock</button>`}
                    </div>
                </div>
            `;
        }).join('');

        // Click handlers for unlock buttons
        container.querySelectorAll('.unlock-skill').forEach(b => b.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id; if (!id) return; this.unlockSkill(id);
        }));

        // Keyboard accessibility: Enter/Space triggers unlock (if available)
        container.querySelectorAll('.skill-node').forEach(node => {
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const btn = node.querySelector('.unlock-skill');
                    if (btn && !btn.disabled) { btn.click(); return; }
                    const id = node.dataset.skillId;
                    if (id) this.unlockSkill(id);
                }
            });
        });
    }

    // Create a review session based on due flashcards
    createReviewSession(startNow = false) {
        const due = (this.data.flashcards || []).filter(f => Date.parse(f.nextReview || 0) <= Date.now());
        if (due.length === 0) { this.showToast('No flashcards are due for review'); return; }
        // estimate 1 minute per 2 cards, minimum 5 minutes
        const mins = Math.max(5, Math.ceil(due.length / 2));
        const id = this.createSession('Review Session', 'Flashcards', mins, 'easy');
        if (startNow) this.startSession(id);
        this.showToast(`Review session created (${due.length} cards) — ${mins} min`);
    }

    // Flashcards / Lab
    addFlashcard(question, correct, wrong1, wrong2, subject = 'Other') {
        const card = {
            id: Date.now().toString(),
            question: question,
            answers: [correct, wrong1, wrong2],
            correct: correct,
            subject: subject,
            ease: 2.5,
            interval: 0,
            repetitions: 0,
            nextReview: new Date().toISOString()
        };
        this.data.flashcards.push(card);
        this.saveData();
        this.renderFlashcardsUI();
        this.showToast('Flashcard added');
    }

    renderFlashcardsUI() {
        const list = document.getElementById('flashcard-list');
        if (!list) return;
        list.innerHTML = '';
        if (!this.data.flashcards || this.data.flashcards.length === 0) {
            list.innerHTML = `<div class="empty-state"><p>No flashcards yet</p></div>`;
            return;
        }

        this.data.flashcards.forEach(fc => {
            const el = document.createElement('div');
            el.className = 'task-item';
            const nextReview = fc.nextReview ? new Date(fc.nextReview).toLocaleString() : 'ASAP';
            el.innerHTML = `
                <div style="display:flex; gap:0.5rem; align-items:center; justify-content:space-between; width:100%;">
                    <div style="flex:1;">
                        <div style="font-weight:700;">${fc.question}</div>
                        <div style="font-size:0.85rem; color:var(--text-secondary);">Subject: ${fc.subject} • Next: ${nextReview}</div>
                    </div>
                    <div style="display:flex; gap:0.5rem;">
                        <button class="btn btn-primary practice-flashcard" data-id="${fc.id}">Practice</button>
                        <button class="btn btn-secondary delete-flashcard" data-id="${fc.id}">Delete</button>
                    </div>
                </div>
            `;
            list.appendChild(el);
        });

        // Delegate buttons
        list.querySelectorAll('.practice-flashcard').forEach(b => b.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const card = this.data.flashcards.find(x => x.id === id);
            if (card) {
                this.startPractice(card.subject);
            }
        }));

        list.querySelectorAll('.delete-flashcard').forEach(b => b.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            this.data.flashcards = this.data.flashcards.filter(x => x.id !== id);
            this.saveData();
            this.renderFlashcardsUI();
        }));
    }

    // Build quiz questions for a subject. Prefer `this.questionBank` when available.
    // If dueOnly=true, only return cards due for review (nextReview <= now)
    getQuestionsForSubject(subject = 'Any', count = 10, dueOnly = false, difficulty = null) {
        const questions = [];

        // 1) Use question bank if available
        if (Array.isArray(this.questionBank) && this.questionBank.length > 0) {
            // filter by subject and optional difficulty
            let bankPool = this.questionBank.slice();
            if (subject !== 'Any' || difficulty) {
                bankPool = this.questionBank.filter(q => {
                    const subOk = (subject === 'Any') || (String(q.subject || '').toLowerCase() === String(subject || '').toLowerCase());
                    const diffOk = !difficulty || (String(q.difficulty || '').toLowerCase() === String(difficulty || '').toLowerCase());
                    return subOk && diffOk;
                });
            }
            // shuffle
            const shuffledBank = bankPool.sort(() => Math.random() - 0.5);
            for (let i = 0; i < Math.min(count, shuffledBank.length); i++) {
                const q = shuffledBank[i];
                // ensure choices array and correctIndex
                const choices = Array.isArray(q.choices) ? q.choices.slice() : [];
                const correctIndex = (typeof q.correctIndex === 'number') ? q.correctIndex : choices.indexOf(q.correct || '');
                questions.push({ id: q.id || `bank-${i}`, text: q.text || '', choices, correctIndex: Number.isFinite(correctIndex) ? correctIndex : 0 });
            }
        }

        // 2) If not enough from bank, fall back to flashcards (optionally due-only)
        if (questions.length < count) {
            let pool = (subject === 'Any') ? (this.data.flashcards || []).slice() : (this.data.flashcards || []).filter(f => f.subject === subject);
            if (dueOnly) {
                const now = Date.now();
                pool = pool.filter(f => Date.parse(f.nextReview || 0) <= now);
            }

            if (pool && pool.length > 0) {
                const shuffled = pool.sort(() => Math.random() - 0.5);
                const needed = count - questions.length;
                for (let i = 0; i < Math.min(needed, shuffled.length); i++) {
                    const card = shuffled[i];
                    const choices = [card.correct, ...card.answers.filter(a => a !== card.correct)];
                    const uniq = Array.from(new Set(choices)).sort(() => Math.random() - 0.5).slice(0, 3);
                    const correctIndex = uniq.indexOf(card.correct);
                    questions.push({ id: card.id, text: card.question, choices: uniq, correctIndex });
                }
            }
        }

        // 3) Final fallback: generate arithmetic questions
        if (questions.length < count) {
            questions.push(...this.generateArithmeticQuestions(count - questions.length));
        }

        return questions.slice(0, count);
    }

    generateArithmeticQuestions(count = 6) {
        const qs = [];
        for (let i = 0; i < count; i++) {
            const a = Math.floor(Math.random() * 12) + 1;
            const b = Math.floor(Math.random() * 12) + 1;
            const correct = (a * b).toString();
            const wrong1 = (a * b + (Math.floor(Math.random() * 5) + 1)).toString();
            const wrong2 = (a * b - (Math.floor(Math.random() * 4) + 1)).toString();
            const choices = [correct, wrong1, wrong2].sort(() => Math.random() - 0.5);
            qs.push({ id: `gen-${Date.now()}-${i}`, text: `What is ${a} × ${b}?`, choices, correctIndex: choices.indexOf(correct) });
        }
        return qs;
    }

    // Simple SM-2 like SRS updater for flashcards
    updateFlashcardSRS(cardId, correct) {
        const card = this.data.flashcards.find(c => c.id === cardId);
        if (!card) return;

        const quality = correct ? 5 : 2; // map correctness to quality

        if (quality >= 3) {
            card.repetitions = (card.repetitions || 0) + 1;
            if (card.repetitions === 1) card.interval = 1;
            else if (card.repetitions === 2) card.interval = 6;
            else {
                // Growth factor respects 'ease', but can be reduced by 'sageMemory' skill (numeric factor supported)
                let growthFactor = (card.ease || 2.5);
                if (this.data.skillModifiers) {
                    const sageFactor = (typeof this.data.skillModifiers.sageMemoryFactor === 'number') ? this.data.skillModifiers.sageMemoryFactor : (this.data.skillModifiers.sageMemory ? 0.85 : null);
                    if (sageFactor) growthFactor = Math.max(1.2, growthFactor * sageFactor);
                }
                card.interval = Math.max(1, Math.round((card.interval || 6) * growthFactor));
            }
            card.ease = Math.max(1.3, (card.ease || 2.5) + 0.1 - (5 - quality) * 0.08);
        } else {
            card.repetitions = 0;
            card.interval = 1;
            // Slightly gentler ease penalty if sageMemory is active (supports numeric or legacy boolean)
            const hasSage = this.data.skillModifiers && (typeof this.data.skillModifiers.sageMemoryFactor === 'number' || this.data.skillModifiers.sageMemory);
            const easePenalty = hasSage ? 0.12 : 0.2;
            card.ease = Math.max(1.3, (card.ease || 2.5) - easePenalty);
        }

        card.nextReview = new Date(Date.now() + (card.interval || 1) * 24 * 60 * 60 * 1000).toISOString();
        this.saveData();
        this.renderFlashcardsUI();
    }

    /* ---------------- CSV Export / Import for Flashcards (vanilla JS) ---------------- */
    escapeCSV(field) {
        if (field == null) return '';
        const s = String(field);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    }

    exportFlashcardsCSV() {
        const cards = this.data.flashcards || [];
        if (!cards.length) { this.showToast('No flashcards to export'); return; }
        const header = ['question','correct','wrong1','wrong2','subject','ease','interval','repetitions','nextReview'];
        const rows = cards.map(c => {
            const wrongs = (c.answers || []).filter(a => a !== c.correct);
            const w1 = wrongs[0] || '';
            const w2 = wrongs[1] || '';
            return [c.question || '', c.correct || '', w1, w2, c.subject || '', c.ease || '', c.interval || '', c.repetitions || '', c.nextReview || ''].map(f => this.escapeCSV(f)).join(',');
        });
        const csv = header.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `studyverse_flashcards_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.showToast('Flashcards exported');
    }

    // Simple CSV parser that handles quoted fields. Implemented in plain JS to avoid external deps.
    parseCSV(text) {
        const rows = [];
        let cur = '';
        let row = [];
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (ch === '"') {
                if (inQuotes && text[i+1] === '"') { cur += '"'; i++; }
                else { inQuotes = !inQuotes; }
                continue;
            }
            if (ch === ',' && !inQuotes) { row.push(cur); cur = ''; continue; }
            if ((ch === '\n' || ch === '\r') && !inQuotes) {
                if (ch === '\r' && text[i+1] === '\n') { i++; }
                row.push(cur); cur = '';
                rows.push(row); row = [];
                continue;
            }
            cur += ch;
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows;
    }

    importFlashcardsCSV(text) {
        if (!text) { this.showToast('Empty CSV'); return; }
        const parsed = this.parseCSV(text.trim());
        if (!parsed || parsed.length < 2) { this.showToast('Invalid CSV'); return; }
        const header = parsed[0].map(h => String(h || '').trim().toLowerCase());
        const idx = {
            question: header.indexOf('question'),
            correct: header.indexOf('correct'),
            wrong1: header.indexOf('wrong1'),
            wrong2: header.indexOf('wrong2'),
            subject: header.indexOf('subject'),
            ease: header.indexOf('ease'),
            interval: header.indexOf('interval'),
            repetitions: header.indexOf('repetitions'),
            nextReview: header.indexOf('nextreview')
        };
        let imported = 0; let skipped = 0;
        for (let r = 1; r < parsed.length; r++) {
            const row = parsed[r];
            if (!row || row.length === 0) continue;
            const q = (row[idx.question] || row[0] || '').trim();
            const correct = (row[idx.correct] || row[1] || '').trim();
            if (!q || !correct) { skipped++; continue; }
            // dedupe by question text
            if ((this.data.flashcards || []).some(f => String(f.question || '').trim() === q)) { skipped++; continue; }
            const wrong1 = (row[idx.wrong1] || row[2] || '').trim();
            const wrong2 = (row[idx.wrong2] || row[3] || '').trim();
            const subject = (row[idx.subject] || row[4] || 'Other').trim() || 'Other';
            const ease = parseFloat(row[idx.ease] || row[5]) || 2.5;
            const interval = parseInt(row[idx.interval] || row[6]) || 0;
            const repetitions = parseInt(row[idx.repetitions] || row[7]) || 0;
            const nextReview = (row[idx.nextReview] || row[8] || new Date().toISOString()).trim();

            const card = {
                id: Date.now().toString() + '-' + r,
                question: q,
                answers: [correct, wrong1 || '', wrong2 || ''],
                correct: correct,
                subject: subject,
                ease: ease,
                interval: interval,
                repetitions: repetitions,
                nextReview: nextReview
            };
            this.data.flashcards = this.data.flashcards || [];
            this.data.flashcards.push(card);
            imported++;
        }
        this.saveData();
        this.renderFlashcardsUI();
        this.showToast(`Imported ${imported} flashcards, skipped ${skipped}`);
    }

    // Show quiz question UI inside combat modal
    showCombatQuestion(index = 0) {
        const container = document.getElementById('combat-question');
        if (!container) return;
        this.disableCombatActions();
        if (!this.combatQuestions || this.combatQuestions.length === 0) {
            container.style.display = 'none';
            return;
        }

        this.currentQuestionIndex = index;
        const q = this.combatQuestions[index];
        container.style.display = 'block';
        container.innerHTML = '';

        const progress = document.createElement('div');
        progress.className = 'question-progress';
        progress.style.marginBottom = '0.5rem';
        progress.style.fontWeight = '700';
        progress.textContent = `Question ${index + 1} / ${this.combatQuestions.length}`;
        container.appendChild(progress);

        const qText = document.createElement('div');
        qText.className = 'question-text';
        qText.style.fontWeight = '700';
        qText.style.marginBottom = '0.5rem';
        qText.textContent = q.text;
        container.appendChild(qText);

        q.choices.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'option-button';
            btn.textContent = opt;
            btn.dataset.index = i;
            btn.addEventListener('click', (e) => {
                // disable all option buttons and retreat to prevent multi-clicks
                container.querySelectorAll('.option-button').forEach(b => b.disabled = true);
                const retreatEl = document.getElementById('retreat-btn') || container.querySelector('#retreat-btn');
                if (retreatEl) retreatEl.disabled = true;
                const clicked = e.currentTarget;
                this.handleCombatAnswer(i, clicked);
            });
            container.appendChild(btn);
        });

        // Retreat button (visible during quiz questions)
        const retreatBtn = document.createElement('button');
        retreatBtn.id = 'retreat-btn';
        retreatBtn.className = 'btn btn-secondary retreat-button';
        retreatBtn.textContent = 'Retreat';
        retreatBtn.addEventListener('click', (e) => {
            // disable options and self to avoid races
            container.querySelectorAll('.option-button').forEach(b => b.disabled = true);
            retreatBtn.disabled = true;
            this.playerRetreat();
        });
        container.appendChild(retreatBtn);
    }

    handleCombatAnswer(selectedIndex, clickedButton) {
        const qIndex = this.currentQuestionIndex || 0;
        const q = this.combatQuestions[qIndex];
        const correct = selectedIndex === q.correctIndex;

        const bossEl = document.getElementById('boss-sprite');
        const playerEl = document.getElementById('player-sprite');

        const container = document.getElementById('combat-question');
        const optionButtons = container ? Array.from(container.querySelectorAll('.option-button')) : [];

        // immediate visual feedback
        if (clickedButton) {
            if (correct) clickedButton.classList.add('correct');
            else clickedButton.classList.add('incorrect');
        }
        if (!correct && optionButtons[q.correctIndex]) {
            optionButtons[q.correctIndex].classList.add('correct');
        }

        // small delay to show feedback
        setTimeout(() => {
            // update SRS for flashcard if applicable
            try {
                if (q && q.id && !String(q.id).startsWith('gen-')) {
                    this.updateFlashcardSRS(q.id, correct);
                }
            } catch (e) {}

            if (correct) {
                // Damage to boss
                const baseDamage = this.data.playerStats.attack;
                const classBonus = (this.data.playerClass === 'warrior') ? 2 : 0;
                const variance = Math.floor(Math.random() * 4) - 1;
                let damage = Math.max(1, baseDamage + classBonus + variance - this.currentBoss.defense);
                // Berserk: support numeric multiplier (new) or legacy boolean flag
                let berserkMul = null;
                if (this.data.skillModifiers) {
                    if (typeof this.data.skillModifiers.berserkMultiplier === 'number') berserkMul = this.data.skillModifiers.berserkMultiplier;
                    else if (this.data.skillModifiers.berserk) berserkMul = 1.2;
                }
                if (berserkMul && this.data.playerStats.currentHealth <= (this.data.playerStats.maxHealth * 0.5)) {
                    damage = Math.max(1, Math.ceil(damage * berserkMul));
                }

                this.currentBoss.currentHP -= damage;
                this.addCombatLog(`Correct! You deal ${damage} damage.`, 'player');
                if (bossEl) { bossEl.classList.add('shake'); setTimeout(() => bossEl.classList.remove('shake'), 450); }
                this.playSound('xp');
            } else {
                // Damage to player
                const base = this.currentBoss.attack;
                const variance = Math.floor(Math.random() * 4) - 1;
                let dmg = Math.max(1, base + variance - this.data.playerStats.defense);
                // Tank class reduces incoming mistakes
                if (this.data.playerClass === 'tank') {
                    dmg = Math.max(1, Math.floor(dmg * 0.75));
                }
                this.data.playerStats.currentHealth -= dmg;
                this.addCombatLog(`Wrong! ${this.currentBoss.name} deals ${dmg} damage to you.`, 'boss');
                if (playerEl) { playerEl.classList.add('shake'); setTimeout(() => playerEl.classList.remove('shake'), 450); }
                this.playSound('complete');
            }

            this.updateCombatDisplay();

            if (this.currentBoss.currentHP <= 0) {
                this.endCombat(true);
                return;
            }

            if (this.data.playerStats.currentHealth <= 0) {
                this.endCombat(false);
                return;
            }

            // move to next question or let boss attack
            this.currentQuestionIndex = qIndex + 1;
            if (this.currentQuestionIndex < this.combatQuestions.length) {
                // small delay between questions
                setTimeout(() => this.showCombatQuestion(this.currentQuestionIndex), 600);
            } else {
                // No more questions: if boss still alive, auto-fail; otherwise let boss retaliate
                if (this.currentBoss && this.currentBoss.currentHP > 0) {
                    this.addCombatLog('No more questions — the boss overwhelms you!', 'boss');
                    setTimeout(() => this.endCombat(false), 800);
                } else {
                    setTimeout(() => this.bossAttack(), 800 + Math.random() * 600);
                }
            }
        }, 700);
    }

    // Start a practice quiz (no energy cost)
    startPractice(subject = 'Any', dueOnly = false) {
        this.combatQuestions = this.getQuestionsForSubject(subject, 10, dueOnly);
        this.currentQuestionIndex = 0;
        // create a trivial boss for practice
        this.currentBoss = { name: 'Practice Dummy', sprite: '🟦', maxHP: 40, currentHP: 40, attack: 5, defense: 1 };
        this.data.playerStats.currentHealth = this.data.playerStats.maxHealth;
        this.inCombat = true;
        this.showCombatModal();
        this.showCombatQuestion(0);
    }

    updateDashboard() {
        const nextLevelXP = this.xpThresholds[this.data.level] || 
                           this.xpThresholds[this.xpThresholds.length - 1] + (this.data.level - this.xpThresholds.length + 1) * 500;
        const progress = (this.data.currentLevelXP / nextLevelXP) * 100;

        document.getElementById('level-display').textContent = this.data.level;
        document.getElementById('xp-display').textContent = this.data.currentLevelXP;
        document.getElementById('next-level-xp').textContent = nextLevelXP;
        document.getElementById('level-progress').style.width = progress + '%';
        document.getElementById('streak-display').textContent = this.data.streak;
        document.getElementById('total-xp-display').textContent = this.data.totalXP;
        document.getElementById('tasks-completed-display').textContent = this.data.totalTasksCompleted;

        const streakEmoji = this.getStreakEmoji();
        document.getElementById('streak-emoji').textContent = streakEmoji;

        const quote = this.motivationalQuotes[Math.floor(Math.random() * this.motivationalQuotes.length)];
        document.getElementById('motivational-quote').textContent = quote;

        this.renderTodaysTasks();
    }

    renderTodaysTasks() {
        const today = new Date().toDateString();
        const todaysTasks = this.data.tasks.filter(t => t.createdDate === today);
        const tasksList = document.getElementById('tasks-list');

        if (todaysTasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <p>No tasks for today yet!</p>
                    <p>Add a task above to start your adventure.</p>
                </div>
            `;
            return;
        }

        tasksList.innerHTML = todaysTasks.map(task => this.createTaskHTML(task)).join('');
    }

    updateTasksList() {
        const statusFilter = document.getElementById('status-filter').value;
        const difficultyFilter = document.getElementById('difficulty-filter').value;

        let filtered = this.data.tasks;

        if (statusFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        } else if (statusFilter === 'pending') {
            filtered = filtered.filter(t => !t.completed);
        }

        if (difficultyFilter !== 'all') {
            filtered = filtered.filter(t => t.difficulty === difficultyFilter);
        }

        const allTasksList = document.getElementById('all-tasks-list');
        if (filtered.length === 0) {
            allTasksList.innerHTML = '<div class="empty-state"><p>No tasks found</p></div>';
        } else {
            allTasksList.innerHTML = filtered.map(task => this.createTaskHTML(task)).join('');
        }

        this.updateTaskStats();
    }

    updateTaskStats() {
        const completed = this.data.tasks.filter(t => t.completed).length;
        const pending = this.data.tasks.filter(t => !t.completed).length;
        const total = this.data.tasks.length;

        document.getElementById('total-tasks-count').textContent = total;
        document.getElementById('completed-tasks-count').textContent = completed;
        document.getElementById('pending-tasks-count').textContent = pending;
    }

    createTaskHTML(task) {
        const xp = this.getXPForDifficulty(task.difficulty);
        return `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
                       onchange="app.completeTask('${task.id}')">
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    <div class="task-meta">
                        <span class="task-badge ${task.difficulty}">${task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1)}</span>
                        <span class="task-xp">+${xp} XP</span>
                    </div>
                </div>
                <button class="task-delete" onclick="app.deleteTask('${task.id}')">Delete</button>
            </div>
        `;
    }

    /* ------------------ Study Sessions ------------------ */
    createSession(title, subject, duration = 25, difficulty = 'medium') {
        // Prevent near-duplicate creations (e.g., rapid double-clicks or duplicate listeners)
        try {
            const last = (this.data.sessions && this.data.sessions[0]) ? this.data.sessions[0] : null;
            if (last && last.title === title && last.subject === subject && Number(last.duration) === Number(duration) && last.difficulty === difficulty) {
                const lastTime = Number(last.id) || 0;
                if (Date.now() - lastTime < 1200) {
                    // Return existing session id instead of creating a duplicate
                    this.showToast('Session already created');
                    return last.id;
                }
            }
        } catch (e) {}

        const session = {
            id: Date.now().toString(),
            title,
            subject,
            duration: Number(duration), // minutes
            difficulty,
            createdDate: new Date().toDateString(),
            validated: false,
            xpEarned: 0,
            energyEarned: 0,
            completedDate: null,
            focusRatio: 0
        };

        // Attach a small claim quiz for the session (5 questions filtered by subject + difficulty)
        try {
            session.questions = this.getQuestionsForSubject(subject || 'Any', 5, false, difficulty);
        } catch (e) { session.questions = []; }
        this.data.sessions.unshift(session);
        this.saveData();
        this.updateActiveSessionsUI();
        this.showToast('Session created');
        this.updateAllUI();
        return session.id;
    }

    updateActiveSessionsUI() {
        const container = document.getElementById('active-sessions-list');
        if (!container) return;
        const active = this.data.sessions.filter(s => !s.validated);
        if (active.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No active sessions</p></div>';
            return;
        }
        container.innerHTML = active.map(s => `
            <div class="session-card quest-card" data-id="${s.id}">
                <div class="task-title">${s.title}</div>
                <div class="task-meta">
                    <span class="task-badge ${s.difficulty}">${s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1)}</span>
                    <span class="task-xp">+${this.computeSessionXP(s)} XP</span>
                    <span style="margin-left:auto;color:var(--text-secondary)">${s.duration} min • ${s.subject}</span>
                </div>
                <div style="margin-top:0.5rem;">
                    <button class="btn btn-secondary start-session" data-id="${s.id}">Start</button>
                </div>
            </div>
        `).join('');
    }

    startSession(sessionId) {
        const s = this.data.sessions.find(x => x.id === sessionId);
        if (!s) { this.showToast('Session not found'); return; }
        if (this.currentSessionId) { this.showToast('A session is already running'); return; }
        this.currentSessionId = sessionId;
        // persist active session so reloads can restore UI
        this.data.currentSessionId = sessionId;
        this.timerSeconds = s.duration * 60;
        this.data.timerSecondsSaved = this.timerSeconds;
        this.saveData();
        this.sessionFocusLostSeconds = 0;
        this.sessionLastHiddenTime = null;

        // bind handlers
        this._boundVisibilityHandler = () => {
            if (document.hidden) {
                this.sessionLastHiddenTime = Date.now();
            } else if (this.sessionLastHiddenTime) {
                this.sessionFocusLostSeconds += Math.floor((Date.now() - this.sessionLastHiddenTime) / 1000);
                this.sessionLastHiddenTime = null;
            }
        };
        this._boundBlurHandler = () => { this.sessionLastHiddenTime = Date.now(); };
        this._boundFocusHandler = () => {
            if (this.sessionLastHiddenTime) {
                this.sessionFocusLostSeconds += Math.floor((Date.now() - this.sessionLastHiddenTime) / 1000);
                this.sessionLastHiddenTime = null;
            }
        };

        document.addEventListener('visibilitychange', this._boundVisibilityHandler);
        window.addEventListener('blur', this._boundBlurHandler);
        window.addEventListener('focus', this._boundFocusHandler);

        this.updateAllUI();
        this.startTimer();
        this.showToast(`Started session: ${s.title}`);
    }

    computeSessionXP(session) {
        const base = 1; const mult = { easy: 0.8, medium: 1, hard: 1.5 }[session.difficulty] || 1;
        let xp = Math.floor(session.duration * base * mult);
        // small streak bonus
        xp = Math.floor(xp * (1 + Math.min(0.25, this.data.streak * 0.02)));
        return Math.max(1, xp);
    }

    finalizeSession() {
        const id = this.currentSessionId;
        if (!id) return;
        const s = this.data.sessions.find(x => x.id === id);
        if (!s) return;

        const totalSeconds = s.duration * 60;
        const focusRatio = Math.max(0, 1 - (this.sessionFocusLostSeconds / totalSeconds));
        s.focusRatio = focusRatio;
        s.completedDate = new Date().toISOString();

        // cleanup listeners that tracked focus
        try { document.removeEventListener('visibilitychange', this._boundVisibilityHandler); } catch (e) {}
        try { window.removeEventListener('blur', this._boundBlurHandler); } catch (e) {}
        try { window.removeEventListener('focus', this._boundFocusHandler); } catch (e) {}

        // pause the timer so it doesn't continue during the claim quiz
        try { this.pauseTimer(); } catch (e) {}
        this.sessionFocusLostSeconds = 0; this.sessionLastHiddenTime = null;

        // Too little focus -> no rewards; clear session immediately
        if (focusRatio < 0.5) {
            s.xpEarned = 0; s.validated = false;
            this.currentSessionId = null;
            this.data.currentSessionId = null;
            this.showToast('Session ended: not enough focus to earn rewards');
            this.saveData();
            this.updateAllUI();
            return;
        }

        // Prepare base rewards and defer awarding to a short claim-quiz
        const baseXP = this.computeSessionXP(s);
        const baseEnergy = Math.max(1, Math.floor(s.duration / 10));
        s._claim = { baseXP, baseEnergy };

        // Show a short 3-question claim quiz to earn full/partial rewards
        // Keep `currentSessionId` until the quiz is answered so the bar remains visible
        this.showSessionClaimModal(s, baseXP, baseEnergy);

        this.saveData();
        this.updateAllUI();
    }

    showToast(text) {
        if (window.__uiPolish && typeof window.__uiPolish.showToast === 'function') window.__uiPolish.showToast(text);
        else console.log(text);
    }

    // Toggle quiz-only combat mode (persisted)
    setQuizOnlyCombat(enabled) {
        this.data.quizOnlyCombat = !!enabled;
        this.saveData();
        this.updateAllUI();
        this.showToast(this.data.quizOnlyCombat ? 'Quiz-only combat enabled' : 'Quiz-only combat disabled');
    }

    // Profile modal helpers (avatar picker + image upload)
    showProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        const nameIn = document.getElementById('profile-name-input');
        const picker = document.getElementById('avatar-picker');
        const fileInput = document.getElementById('profile-avatar-file');
        const clearBtn = document.getElementById('profile-clear-image');
        const preview = document.getElementById('profile-avatar-preview');

        // temporary state for modal
        let selectedEmoji = this.data.avatarEmoji || null;
        let uploadedImage = this.data.avatarImage || null;

        if (nameIn) nameIn.value = this.data.avatarName || '';

        const renderPreview = () => {
            if (!preview) return;
            if (uploadedImage) {
                preview.innerHTML = `<img src="${uploadedImage}" alt="Avatar" class="avatar-upload-preview" />`;
            } else if (selectedEmoji) {
                preview.innerHTML = `<div class="avatar-emoji-text">${selectedEmoji}</div>`;
            } else {
                preview.innerHTML = `<svg width="72" height="72" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="#9CA3AF"><circle cx="40" cy="26" r="14" /><path d="M8 68c0-18 14-28 32-28s32 10 32 28" /></g></svg>`;
            }
        };

        // initialize picker selection UI
        if (picker) {
            const thumbs = Array.from(picker.querySelectorAll('.avatar-thumb'));
            thumbs.forEach(t => {
                t.classList.toggle('selected', t.dataset.emoji === selectedEmoji);
                t.onclick = () => {
                    selectedEmoji = t.dataset.emoji || null;
                    uploadedImage = null;
                    thumbs.forEach(x => x.classList.remove('selected'));
                    t.classList.add('selected');
                    renderPreview();
                };
            });
        }

        // file input/change -> read + resize -> dataURL
        if (fileInput) {
            fileInput.onchange = (e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = new Image();
                    img.onload = () => {
                        const max = 256;
                        let w = img.width, h = img.height;
                        if (w > max || h > max) {
                            if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; }
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        // use jpeg to control quality
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                        uploadedImage = dataUrl;
                        selectedEmoji = null;
                        if (picker) picker.querySelectorAll('.avatar-thumb').forEach(x => x.classList.remove('selected'));
                        renderPreview();
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(f);
                fileInput.value = '';
            };
        }

        if (clearBtn) {
            clearBtn.onclick = () => {
                uploadedImage = null;
                selectedEmoji = null;
                if (picker) picker.querySelectorAll('.avatar-thumb').forEach(x => x.classList.remove('selected'));
                renderPreview();
            };
        }

        renderPreview();
        modal.style.display = 'flex';

        // save / cancel
        const saveBtn = document.getElementById('profile-save');
        const cancelBtn = document.getElementById('profile-cancel');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const name = (document.getElementById('profile-name-input')?.value || '').trim();
                if (name) this.data.avatarName = name;
                if (uploadedImage) {
                    this.data.avatarImage = uploadedImage;
                    this.data.avatarEmoji = null;
                } else if (selectedEmoji) {
                    this.data.avatarEmoji = selectedEmoji;
                    this.data.avatarImage = null;
                } else {
                    this.data.avatarEmoji = null;
                    this.data.avatarImage = null;
                }
                this.saveData();
                this.updateAllUI();
                this.showToast('Profile saved');
                modal.style.display = 'none';
                // cleanup handlers
                if (fileInput) fileInput.onchange = null;
                if (picker) picker.querySelectorAll('.avatar-thumb').forEach(x => x.onclick = null);
                saveBtn.onclick = null;
                if (cancelBtn) cancelBtn.onclick = null;
            };
        }
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.style.display = 'none';
                if (fileInput) fileInput.onchange = null;
                if (picker) picker.querySelectorAll('.avatar-thumb').forEach(x => x.onclick = null);
                if (saveBtn) saveBtn.onclick = null;
                cancelBtn.onclick = null;
            };
        }
    }

    /* ---------------- Active Session bar & Claim Quiz ---------------- */
    formatTime(seconds) {
        const s = Number.isFinite(seconds) ? seconds : (this.timerSeconds || 0);
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
    }

    renderActiveSessionBar() {
        const bar = document.getElementById('active-session-bar');
        if (!bar) return;
        const showBtn = document.getElementById('session-show-btn');
        // No active session -> ensure bar and show button hidden
        if (!this.currentSessionId) {
            bar.style.display = 'none';
            if (showBtn) showBtn.style.display = 'none';
            return;
        }

        const s = this.data.sessions.find(x => x.id === this.currentSessionId);
        if (!s) { bar.style.display = 'none'; if (showBtn) showBtn.style.display = 'none'; return; }

        // If user collapsed the bar, hide the bar but show the small re-open button
        if (this._sessionBarCollapsed) {
            bar.style.display = 'none';
            if (showBtn) showBtn.style.display = 'block';
            return;
        }

        bar.style.display = 'flex';
        if (showBtn) showBtn.style.display = 'none';
        const titleEl = bar.querySelector('.session-title'); if (titleEl) titleEl.textContent = s.title || 'Session';
        const metaEl = bar.querySelector('.session-meta'); if (metaEl) metaEl.textContent = `${s.subject} • ${s.duration} min • ${s.difficulty}`;
        const remaining = (typeof this.timerSeconds === 'number') ? this.timerSeconds : (s.duration * 60);
        const timerEl = document.getElementById('active-timer'); if (timerEl) timerEl.textContent = this.formatTime(remaining);
        const pct = Math.max(0, Math.min(100, Math.round(((s.duration * 60 - remaining) / (s.duration * 60)) * 100)));
        const prog = document.getElementById('active-progress'); if (prog) prog.style.width = pct + '%';
        const xpEl = document.getElementById('sess-xp'); if (xpEl) xpEl.textContent = this.computeSessionXP(s);
        const enEl = document.getElementById('sess-energy'); if (enEl) enEl.textContent = Math.floor(s.duration / 10);
    }

    showSessionClaimModal(session, baseXP, baseEnergy) {
        const modal = document.getElementById('session-claim-modal');
        if (!modal) return;
        const questions = (session.questions && Array.isArray(session.questions) && session.questions.length > 0)
            ? session.questions.slice(0, 5)
            : this.getQuestionsForSubject(session.subject || 'Any', 5, true, session.difficulty);
        this._claimQuizState = { sessionId: session.id, questions, index: 0, correct: 0, baseXP, baseEnergy, selected: null, answers: [] };
        modal.style.display = 'flex';
        document.getElementById('claim-next').textContent = 'Next';
        document.getElementById('claim-next').disabled = true;
        document.getElementById('claim-cancel').disabled = false;
        document.getElementById('claim-progress').textContent = `Question 1 / ${questions.length}`;
        this._renderClaimQuestion();

        // wire buttons
        document.getElementById('claim-next').onclick = () => this._handleClaimNext();
        document.getElementById('claim-cancel').onclick = () => this._handleClaimCancel();
    }

    _renderClaimQuestion() {
        const state = this._claimQuizState;
        if (!state) return;
        const q = state.questions[state.index];
        const qText = document.getElementById('claim-question-text');
        const choices = document.getElementById('claim-choices');
        const prog = document.getElementById('claim-progress');
        if (!qText || !choices || !prog) return;
        qText.textContent = q.text;
        choices.innerHTML = '';
        state.selected = null;
        (q.choices || []).forEach((c, idx) => {
            const btn = document.createElement('button');
            btn.className = 'claim-choice';
            btn.type = 'button';
            btn.textContent = c;
            btn.dataset.index = idx;
            btn.onclick = () => {
                // select
                state.selected = idx;
                Array.from(choices.children).forEach(ch => ch.classList.remove('selected'));
                btn.classList.add('selected');
                document.getElementById('claim-next').disabled = false;
            };
            choices.appendChild(btn);
        });
        prog.textContent = `Question ${state.index + 1} / ${state.questions.length}`;
        // update next label if last
        document.getElementById('claim-next').textContent = (state.index === state.questions.length - 1) ? 'Submit' : 'Next';
        document.getElementById('claim-next').disabled = true;
    }

    _handleClaimNext() {
        const state = this._claimQuizState; if (!state) return;
        const q = state.questions[state.index];
        const sel = state.selected;
        // record answer (null if none)
        state.answers.push((typeof sel === 'number') ? sel : null);
        if (typeof sel === 'number' && sel === q.correctIndex) state.correct++;
        state.index++;
        state.selected = null;
        if (state.index >= state.questions.length) {
            this._finalizeClaim();
        } else {
            this._renderClaimQuestion();
        }
    }

    _handleClaimCancel() {
        // treat as failure but close modal and award a small consolation
        const state = this._claimQuizState; if (!state) return;
        // record current answer (if any) then cancel
        state.answers.push((typeof state.selected === 'number') ? state.selected : null);
        state.correct = 0;
        this._finalizeClaim(true);
    }

    _finalizeClaim(cancelled = false) {
        const state = this._claimQuizState; if (!state) return;
        const s = this.data.sessions.find(x => x.id === state.sessionId);
        if (!s) { this.closeSessionClaimModal(); return; }

        const total = state.questions.length;
        const passed = state.correct >= Math.ceil(total * 2 / 3) && !cancelled;

        let awardedXP, awardedEnergy;
        if (passed) {
            // reward scaled by focus
            if (s.focusRatio >= 0.8) awardedXP = state.baseXP;
            else awardedXP = Math.ceil(state.baseXP * 0.75);
            awardedEnergy = state.baseEnergy;
            s.validated = true;
            this.data.totalTasksCompleted = (this.data.totalTasksCompleted || 0) + 1;
        } else {
            awardedXP = Math.max(1, Math.floor(state.baseXP * 0.5));
            awardedEnergy = Math.max(1, Math.floor(state.baseEnergy * 0.5));
            s.validated = false;
        }

        // class / skill modifiers
        if (this.data.playerClass === 'scholar') {
            awardedXP = Math.ceil(awardedXP * 1.15);
            awardedEnergy = awardedEnergy + 0; // scholar bonus already applied earlier if needed
        }
        const insight = (this.data.skillModifiers && this.data.skillModifiers.insight) ? this.data.skillModifiers.insight : 0;
        if (insight) awardedXP = Math.ceil(awardedXP * (1 + insight));

        s.xpEarned = awardedXP; s.energyEarned = awardedEnergy;
        // Update SRS for any flashcards used in the quiz
        try {
            if (state.answers && state.answers.length) {
                state.questions.forEach((q, i) => {
                    const ans = state.answers[i];
                    const correctAnswer = (typeof ans === 'number' && ans === q.correctIndex);
                    try {
                        if (q && q.id && !String(q.id).startsWith('gen-')) {
                            this.updateFlashcardSRS(q.id, correctAnswer);
                        }
                    } catch (e) {}
                });
            }
        } catch (e) {}
        this.addXP(awardedXP);
        this.data.studyEnergy = (this.data.studyEnergy || 0) + awardedEnergy;
        this.data.lastSessionSubject = s.subject;

        // Close out the session now that the claim is resolved: hide the active session timer
        try { this.currentSessionId = null; this.data.currentSessionId = null; } catch (e) {}
        try { this.pauseTimer(); } catch (e) {}

        if (passed) {
            this.playSound('xp');
            this.showXPBurst(awardedXP);
            this.createConfetti();
            this.showToast(`Session claimed: +${awardedXP} XP • +${awardedEnergy} Energy`);
        } else {
            this.showToast(`Session claim: +${awardedXP} XP • +${awardedEnergy} Energy (quiz not passed)`);
        }

        delete s._claim;
        this.saveData();
        this.updateAllUI();
        this.closeSessionClaimModal();
    }

    closeSessionClaimModal() {
        const modal = document.getElementById('session-claim-modal');
        if (!modal) return;
        modal.style.display = 'none';
        // cleanup handlers
        const next = document.getElementById('claim-next'); if (next) next.onclick = null;
        const cancel = document.getElementById('claim-cancel'); if (cancel) cancel.onclick = null;
        this._claimQuizState = null;
    }


    updateStatsPage() {
        const completed = this.data.tasks.filter(t => t.completed).length;
        const total = this.data.tasks.length;
        const completionRate = total > 0 ? (completed / total) * 100 : 0;

        const nextLevelXP = this.xpThresholds[this.data.level] || 
                           this.xpThresholds[this.xpThresholds.length - 1] + (this.data.level - this.xpThresholds.length + 1) * 500;
        const levelProgress = (this.data.currentLevelXP / nextLevelXP) * 100;

        document.getElementById('stats-level').textContent = this.data.level;
        document.getElementById('stats-total-xp').textContent = this.data.totalXP;
        document.getElementById('stats-streak').textContent = this.data.streak;
        document.getElementById('stats-completed').textContent = this.data.totalTasksCompleted;

        document.getElementById('stats-level-progress').style.width = levelProgress + '%';
        document.getElementById('stats-xp-current').textContent = this.data.currentLevelXP;
        document.getElementById('stats-xp-needed').textContent = nextLevelXP;
        document.getElementById('next-level-number').textContent = this.data.level + 1;
        document.getElementById('xp-remaining').textContent = nextLevelXP - this.data.currentLevelXP;

        document.getElementById('completion-progress').style.width = completionRate + '%';
        document.getElementById('completed-tasks-stat').textContent = completed;
        document.getElementById('total-tasks-stat').textContent = total;
        document.getElementById('completion-rate').textContent = completionRate.toFixed(1);
        document.getElementById('remaining-tasks').textContent = total - completed;

        const easyTasks = this.data.tasks.filter(t => t.difficulty === 'easy');
        const mediumTasks = this.data.tasks.filter(t => t.difficulty === 'medium');
        const hardTasks = this.data.tasks.filter(t => t.difficulty === 'hard');

        const easyCompleted = easyTasks.filter(t => t.completed).length;
        const mediumCompleted = mediumTasks.filter(t => t.completed).length;
        const hardCompleted = hardTasks.filter(t => t.completed).length;

        document.getElementById('easy-count').textContent = `${easyCompleted} / ${easyTasks.length}`;
        document.getElementById('easy-progress').style.width = easyTasks.length > 0 ? (easyCompleted / easyTasks.length) * 100 + '%' : '0%';

        document.getElementById('medium-count').textContent = `${mediumCompleted} / ${mediumTasks.length}`;
        document.getElementById('medium-progress').style.width = mediumTasks.length > 0 ? (mediumCompleted / mediumTasks.length) * 100 + '%' : '0%';

        document.getElementById('hard-count').textContent = `${hardCompleted} / ${hardTasks.length}`;
        document.getElementById('hard-progress').style.width = hardTasks.length > 0 ? (hardCompleted / hardTasks.length) * 100 + '%' : '0%';

        // Subject analytics (last 7 days)
        try {
            const analyticsEl = document.getElementById('subject-analytics');
            if (analyticsEl) {
                const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
                const totals = {};
                (this.data.sessions || []).forEach(s => {
                    if (!s.completedDate) return;
                    const ts = Date.parse(s.completedDate);
                    if (isNaN(ts) || ts < cutoff) return;
                    if (!s.validated) return;
                    totals[s.subject] = (totals[s.subject] || 0) + (s.duration || 0);
                });

                if (Object.keys(totals).length === 0) {
                    analyticsEl.innerHTML = '<div class="empty-state"><p>No validated sessions in the last 7 days</p></div>';
                } else {
                    const max = Math.max(...Object.values(totals));
                    analyticsEl.innerHTML = Object.keys(totals).sort((a,b)=>totals[b]-totals[a]).map(sub => {
                        const mins = totals[sub];
                        const pct = Math.round((mins / max) * 100);
                        return `<div style="margin-bottom:0.6rem;"><div style="display:flex;justify-content:space-between;font-weight:700;"><span>${sub}</span><span style="font-weight:600">${mins}m</span></div><div style="background:rgba(255,255,255,0.06);height:10px;border-radius:6px;margin-top:6px;overflow:hidden;"><div style="width:${pct}%;background:linear-gradient(90deg,var(--secondary),#D4AF37);height:100%;"></div></div></div>`;
                    }).join('');
                }
            }
        } catch (e) {}

        this.updateAchievements();
        this.updateRaidHistory();
    }

    updateAchievements() {
        const achievements = [];

        if (this.data.level >= 1) {
            achievements.push({
                emoji: '⚔️',
                name: 'Novice',
                desc: 'Reached Level 1',
                locked: false,
                color: 'rgba(167, 139, 250, 0.2)'
            });
        }

        if (this.data.level >= 5) {
            achievements.push({
                emoji: '🛡️',
                name: 'Warrior',
                desc: 'Reached Level 5',
                locked: false,
                color: 'rgba(6, 182, 212, 0.2)'
            });
        }

        if (this.data.level >= 10) {
            achievements.push({
                emoji: '👑',
                name: 'Legend',
                desc: 'Reached Level 10',
                locked: false,
                color: 'rgba(212, 175, 55, 0.2)'
            });
        }

        if (this.data.raidWins >= 1) {
            achievements.push({
                emoji: '🏆',
                name: 'First Victory',
                desc: '1 Raid Won',
                locked: false,
                color: 'rgba(212, 175, 55, 0.2)'
            });
        }

        if (this.data.raidWins >= 5) {
            achievements.push({
                emoji: '⚡',
                name: 'Raid Master',
                desc: '5 Raids Won',
                locked: false,
                color: 'rgba(239, 68, 68, 0.2)'
            });
        }

        const container = document.getElementById('achievements-container');
        container.innerHTML = achievements.map(ach => `
            <div class="achievement ${ach.locked ? 'locked' : ''}" style="background-color: ${ach.color}; border-color: ${ach.color};">
                <div class="achievement-emoji">${ach.emoji}</div>
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
            </div>
        `).join('');
    }

    updateRaidHistory() {
        const container = document.getElementById('raid-history-container');
        
        if (this.data.raidHistory.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No raids yet. Start your first raid!</p></div>';
            return;
        }

        container.innerHTML = this.data.raidHistory.map(raid => `
            <div class="history-entry ${raid.victory ? 'victory' : 'defeat'}">
                <div class="history-header">
                    <span class="history-boss">${raid.victory ? '✓' : '✗'} ${raid.boss}</span>
                    <span class="history-result">${raid.victory ? 'Victory' : 'Defeat'}</span>
                </div>
                <div class="history-details">Level ${raid.level} • ${raid.date}</div>
            </div>
        `).join('');
    }

    updateSettings() {
        document.getElementById('sound-toggle').checked = this.data.soundEnabled;
        document.getElementById('account-level').textContent = `Level ${this.data.level}`;
        document.getElementById('account-xp').textContent = this.data.totalXP;
        document.getElementById('account-streak').textContent = this.data.streak;
        const se = document.getElementById('study-energy'); if (se) se.textContent = this.data.studyEnergy || 0;
        const campLevel = document.getElementById('camp-level'); if (campLevel) campLevel.textContent = this.data.level;
        const campWeapon = document.getElementById('camp-weapon'); if (campWeapon) campWeapon.textContent = this.data.equipment.weapon ? this.data.equipment.weapon.name : 'None';
        const campArmor = document.getElementById('camp-armor'); if (campArmor) campArmor.textContent = this.data.equipment.armor ? this.data.equipment.armor.name : 'None';
        const sp = document.getElementById('skill-points'); if (sp) sp.textContent = this.data.skillPoints || 0;
        const qtoggle = document.getElementById('quiz-only-toggle'); if (qtoggle) qtoggle.checked = !!this.data.quizOnlyCombat;
        const avatarNameEl = document.getElementById('avatar-name'); if (avatarNameEl) avatarNameEl.textContent = this.data.avatarName || 'Adventurer';
        const avatarImgEl = document.getElementById('avatar-img');
        if (avatarImgEl) {
            if (this.data.avatarImage) {
                avatarImgEl.innerHTML = `<img src="${this.data.avatarImage}" alt="${this.data.avatarName || 'Avatar'}" class="avatar-upload-preview" />`;
            } else if (this.data.avatarEmoji) {
                avatarImgEl.innerHTML = `<div class="avatar-emoji-text" aria-hidden="true">${this.data.avatarEmoji}</div>`;
            } else {
                avatarImgEl.innerHTML = `
                    <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <g fill="#9CA3AF">
                            <circle cx="40" cy="26" r="14" />
                            <path d="M8 68c0-18 14-28 32-28s32 10 32 28" />
                        </g>
                    </svg>
                `;
            }
        }
    }

    getStreakEmoji() {
        if (this.data.streak === 0) return '❄️';
        if (this.data.streak < 3) return '🔥';
        if (this.data.streak < 7) return '🔥🔥';
        if (this.data.streak < 14) return '🔥🔥🔥';
        return '🔥🔥🔥🔥';
    }
}

// Initialize app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StudyVerse();
});
