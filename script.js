/**
 * AuraZenith - Ambient Soundscape & Deep Focus Studio
 * Core JavaScript Engine
 */

'use strict';

/* ==========================================================================
   1. Live Clock & Greeting Module
   ========================================================================== */
const ClockModule = {
  clockEl: document.getElementById('liveClock'),
  dateEl: document.getElementById('liveDate'),
  greetingEl: document.getElementById('greetingTime'),

  init() {
    this.update();
    setInterval(() => this.update(), 1000);
  },

  update() {
    const now = new Date();
    
    // Live Clock
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    if (this.clockEl) {
      this.clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    // Live Date
    if (this.dateEl) {
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      this.dateEl.textContent = now.toLocaleDateString(undefined, options);
    }

    // Dynamic Greeting
    if (this.greetingEl) {
      const currentHour = now.getHours();
      let greeting = 'Focus Time';
      if (currentHour >= 5 && currentHour < 12) {
        greeting = 'Good Morning';
      } else if (currentHour >= 12 && currentHour < 17) {
        greeting = 'Good Afternoon';
      } else if (currentHour >= 17 && currentHour < 22) {
        greeting = 'Good Evening';
      } else {
        greeting = 'Night Sanctuary';
      }
      this.greetingEl.textContent = greeting;
    }
  }
};

/* ==========================================================================
   2. Procedural Web Audio Ambient Synthesizer (No external mp3s needed!)
   ========================================================================== */
const SoundEngine = {
  ctx: null,
  masterGain: null,
  isMuted: false,
  channels: {},

  init() {
    // Channel configs
    const channelNames = ['rain', 'ocean', 'fire', 'binaural', 'wind', 'noise'];
    channelNames.forEach(name => {
      this.channels[name] = {
        active: false,
        volume: 0.5,
        nodes: null,
        gainNode: null
      };
    });

    this.setupListeners();
  },

  ensureContext() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // Synthesize white noise buffer
  createNoiseBuffer(seconds = 3) {
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  },

  // Synthesize pink noise buffer (1/f)
  createPinkNoiseBuffer(seconds = 3) {
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  },

  startChannel(name) {
    this.ensureContext();
    const ch = this.channels[name];
    if (ch.active) return;

    ch.gainNode = this.ctx.createGain();
    const targetVol = ch.volume;
    ch.gainNode.gain.setValueAtTime(0.001, this.ctx.currentTime);
    ch.gainNode.gain.exponentialRampToValueAtTime(targetVol, this.ctx.currentTime + 0.3);
    ch.gainNode.connect(this.masterGain);

    if (name === 'rain') {
      // Rain: Pink noise through lowpass + periodic droplet clicks
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.createPinkNoiseBuffer(4);
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(ch.gainNode);
      noiseSource.start();

      ch.nodes = { noiseSource, filter };

    } else if (name === 'ocean') {
      // Ocean Waves: Lowpass pink noise modulated by slow LFO
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.createPinkNoiseBuffer(5);
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);

      // Swell gain
      const waveGain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8 sec swell cycle

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      waveGain.gain.setValueAtTime(0.45, this.ctx.currentTime);

      lfo.connect(waveGain.gain);
      noiseSource.connect(filter);
      filter.connect(waveGain);
      waveGain.connect(ch.gainNode);

      noiseSource.start();
      lfo.start();
      ch.nodes = { noiseSource, filter, lfo, waveGain };

    } else if (name === 'fire') {
      // Campfire: Low drone + sporadic pop/crackle bursts
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.createPinkNoiseBuffer(3);
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(ch.gainNode);
      noiseSource.start();

      // Periodic crackle interval
      const crackleInterval = setInterval(() => {
        if (!ch.active || !this.ctx) return;
        try {
          const osc = this.ctx.createOscillator();
          const popGain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150 + Math.random() * 800, this.ctx.currentTime);
          popGain.gain.setValueAtTime(ch.volume * (0.05 + Math.random() * 0.1), this.ctx.currentTime);
          popGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.04);
          osc.connect(popGain);
          popGain.connect(this.masterGain);
          osc.start();
          osc.stop(this.ctx.currentTime + 0.045);
        } catch (e) {}
      }, 180);

      ch.nodes = { noiseSource, filter, crackleInterval };

    } else if (name === 'binaural') {
      // Binaural Beats: 432Hz in Left Ear, 442Hz in Right Ear (10Hz Alpha pulse)
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      oscL.type = 'sine';
      oscR.type = 'sine';
      oscL.frequency.setValueAtTime(432, this.ctx.currentTime);
      oscR.frequency.setValueAtTime(442, this.ctx.currentTime);

      const merger = this.ctx.createChannelMerger(2);
      oscL.connect(merger, 0, 0); // Left channel
      oscR.connect(merger, 0, 1); // Right channel

      merger.connect(ch.gainNode);
      oscL.start();
      oscR.start();

      ch.nodes = { oscL, oscR, merger };

    } else if (name === 'wind') {
      // Forest Wind: Pink noise with dynamic sweeping bandpass filter
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.createPinkNoiseBuffer(4);
      noiseSource.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, this.ctx.currentTime); // slow wind gust

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(280, this.ctx.currentTime); // frequency variation
      lfo.connect(filter.frequency);

      noiseSource.connect(filter);
      filter.connect(ch.gainNode);

      noiseSource.start();
      lfo.start();
      ch.nodes = { noiseSource, filter, lfo };

    } else if (name === 'noise') {
      // Pure Pink Acoustic Masking
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.createPinkNoiseBuffer(4);
      noiseSource.loop = true;

      noiseSource.connect(ch.gainNode);
      noiseSource.start();
      ch.nodes = { noiseSource };
    }

    ch.active = true;
    this.updateCardUI(name);
  },

  stopChannel(name) {
    const ch = this.channels[name];
    if (!ch.active) return;

    if (ch.gainNode && this.ctx) {
      try {
        ch.gainNode.gain.setValueAtTime(ch.gainNode.gain.value, this.ctx.currentTime);
        ch.gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.2);
      } catch (e) {}
    }

    setTimeout(() => {
      if (ch.nodes) {
        if (ch.nodes.noiseSource) {
          try { ch.nodes.noiseSource.stop(); ch.nodes.noiseSource.disconnect(); } catch (e) {}
        }
        if (ch.nodes.oscL) {
          try { ch.nodes.oscL.stop(); ch.nodes.oscL.disconnect(); } catch (e) {}
        }
        if (ch.nodes.oscR) {
          try { ch.nodes.oscR.stop(); ch.nodes.oscR.disconnect(); } catch (e) {}
        }
        if (ch.nodes.lfo) {
          try { ch.nodes.lfo.stop(); ch.nodes.lfo.disconnect(); } catch (e) {}
        }
        if (ch.nodes.crackleInterval) {
          clearInterval(ch.nodes.crackleInterval);
        }
      }
      ch.active = false;
      this.updateCardUI(name);
    }, 220);
  },

  setVolume(name, val) {
    const ch = this.channels[name];
    ch.volume = Math.max(0.001, Math.min(1, val));
    if (ch.active && ch.gainNode && this.ctx) {
      ch.gainNode.gain.setValueAtTime(ch.gainNode.gain.value, this.ctx.currentTime);
      ch.gainNode.gain.linearRampToValueAtTime(ch.volume, this.ctx.currentTime + 0.05);
    }
  },

  toggleChannel(name) {
    if (this.channels[name].active) {
      this.stopChannel(name);
    } else {
      this.startChannel(name);
    }
  },

  // Harmonious Crystal Singing Bowl / Bell Chime via Web Audio API
  playBellChime() {
    this.ensureContext();
    const fundamental = 528; // 528Hz Solfeggio / Zen Tone
    const harmonics = [1, 2, 3.01, 4.2];
    const amplitudes = [0.45, 0.22, 0.12, 0.06];
    const decays = [4.2, 3.0, 2.2, 1.4];

    harmonics.forEach((harmonic, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * harmonic, this.ctx.currentTime);

      gain.gain.setValueAtTime(amplitudes[idx], this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + decays[idx]);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + decays[idx]);
    });
  },

  toggleMasterMute() {
    this.ensureContext();
    this.isMuted = !this.isMuted;
    const soundOn = document.getElementById('soundOnIcon');
    const soundOff = document.getElementById('soundOffIcon');

    if (this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
      if (soundOn) soundOn.classList.add('hidden');
      if (soundOff) soundOff.classList.remove('hidden');
    } else {
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.1);
      if (soundOn) soundOn.classList.remove('hidden');
      if (soundOff) soundOff.classList.add('hidden');
    }
  },

  updateCardUI(name) {
    const card = document.querySelector(`.sound-card[data-channel="${name}"]`);
    if (!card) return;
    if (this.channels[name].active) {
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  },

  setupListeners() {
    // Sliders & Toggles
    Object.keys(this.channels).forEach(name => {
      const toggleBtn = document.getElementById(`toggle-${name}`);
      const slider = document.getElementById(`volume-${name}`);
      const label = document.getElementById(`label-${name}`);

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          this.toggleChannel(name);
        });
      }

      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = Number(e.target.value) / 100;
          this.setVolume(name, val);
          if (label) label.textContent = `${e.target.value}%`;
          if (!this.channels[name].active && val > 0) {
            this.startChannel(name);
          }
        });
      }
    });

    // Master Mute
    const muteBtn = document.getElementById('masterMuteBtn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => this.toggleMasterMute());
    }

    // Bell Chime Test
    const chimeBtn = document.getElementById('chimeTestBtn');
    if (chimeBtn) {
      chimeBtn.addEventListener('click', () => this.playBellChime());
    }

    // Presets
    const presetPills = document.querySelectorAll('.preset-pill');
    presetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const preset = pill.dataset.preset;
        presetPills.forEach(p => p.classList.remove('active'));
        if (preset !== 'mute-all') pill.classList.add('active');
        this.applyPreset(preset);
      });
    });
  },

  applyPreset(preset) {
    // First stop all
    Object.keys(this.channels).forEach(name => this.stopChannel(name));

    setTimeout(() => {
      if (preset === 'rainy-night') {
        this.setSlider('rain', 60);
        this.setSlider('wind', 25);
        this.startChannel('rain');
        this.startChannel('wind');
      } else if (preset === 'deep-zen') {
        this.setSlider('binaural', 50);
        this.setSlider('noise', 25);
        this.startChannel('binaural');
        this.startChannel('noise');
      } else if (preset === 'ocean-mist') {
        this.setSlider('ocean', 55);
        this.setSlider('wind', 20);
        this.startChannel('ocean');
        this.startChannel('wind');
      } else if (preset === 'cozy-cabin') {
        this.setSlider('fire', 55);
        this.setSlider('rain', 35);
        this.startChannel('fire');
        this.startChannel('rain');
      }
    }, 240);
  },

  setSlider(name, val) {
    const slider = document.getElementById(`volume-${name}`);
    const label = document.getElementById(`label-${name}`);
    if (slider) slider.value = val;
    if (label) label.textContent = `${val}%`;
    this.setVolume(name, val / 100);
  }
};

/* ==========================================================================
   3. Focus & Pomodoro Timer Module
   ========================================================================== */
const TimerModule = {
  modes: {
    focus: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  },
  currentMode: 'focus',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  timerInterval: null,
  isRunning: false,
  completedSessions: 0,
  streakCount: 0,
  totalFocusedMinutes: 0,

  // SVG Ring
  ringCircumference: 2 * Math.PI * 120, // 753.98
  progressCircle: document.getElementById('timerProgressCircle'),
  displayDigits: document.getElementById('timerDisplay'),
  statusTag: document.getElementById('timerStatusTag'),
  toggleBtn: document.getElementById('timerToggleBtn'),
  btnText: document.getElementById('timerBtnText'),
  playIcon: document.getElementById('playIcon'),
  pauseIcon: document.getElementById('pauseIcon'),

  init() {
    this.loadState();
    this.updateDisplay();
    this.setupListeners();
  },

  loadState() {
    const savedSessions = localStorage.getItem('aurazenith_sessions');
    const savedStreak = localStorage.getItem('aurazenith_streak');
    const savedMinutes = localStorage.getItem('aurazenith_minutes');

    if (savedSessions) this.completedSessions = parseInt(savedSessions, 10) || 0;
    if (savedStreak) this.streakCount = parseInt(savedStreak, 10) || 0;
    if (savedMinutes) this.totalFocusedMinutes = parseInt(savedMinutes, 10) || 0;

    this.updateStatsUI();
  },

  saveState() {
    localStorage.setItem('aurazenith_sessions', this.completedSessions);
    localStorage.setItem('aurazenith_streak', this.streakCount);
    localStorage.setItem('aurazenith_minutes', this.totalFocusedMinutes);
  },

  updateStatsUI() {
    const sessionsEl = document.getElementById('completedSessions');
    const streakEl = document.getElementById('streakCount');
    const minutesEl = document.getElementById('focusedMinutes');

    if (sessionsEl) sessionsEl.textContent = this.completedSessions;
    if (streakEl) streakEl.textContent = this.streakCount;
    if (minutesEl) minutesEl.textContent = `${this.totalFocusedMinutes}m`;
  },

  setMode(mode) {
    if (this.isRunning) this.pause();
    this.currentMode = mode;
    this.totalSeconds = this.modes[mode];
    this.remainingSeconds = this.totalSeconds;

    // Update Mode Tabs
    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
      tab.setAttribute('aria-selected', tab.dataset.mode === mode);
    });

    if (this.statusTag) {
      if (mode === 'focus') this.statusTag.textContent = 'Focus Session';
      else if (mode === 'shortBreak') this.statusTag.textContent = 'Rest & Refresh';
      else this.statusTag.textContent = 'Deep Rejuvenation';
    }

    this.updateDisplay();
  },

  toggle() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
  },

  start() {
    if (this.isRunning) return;
    SoundEngine.ensureContext();
    this.isRunning = true;

    if (this.btnText) this.btnText.textContent = 'Pause';
    if (this.playIcon) this.playIcon.classList.add('hidden');
    if (this.pauseIcon) this.pauseIcon.classList.remove('hidden');

    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  },

  pause() {
    this.isRunning = false;
    clearInterval(this.timerInterval);

    if (this.btnText) this.btnText.textContent = 'Resume';
    if (this.playIcon) this.playIcon.classList.remove('hidden');
    if (this.pauseIcon) this.pauseIcon.classList.add('hidden');
  },

  reset() {
    this.pause();
    this.remainingSeconds = this.totalSeconds;
    if (this.btnText) this.btnText.textContent = this.currentMode === 'focus' ? 'Start Focus' : 'Start Break';
    this.updateDisplay();
  },

  skip() {
    this.pause();
    if (this.currentMode === 'focus') {
      this.setMode('shortBreak');
    } else {
      this.setMode('focus');
    }
  },

  tick() {
    if (this.remainingSeconds > 0) {
      this.remainingSeconds--;
      this.updateDisplay();
    } else {
      this.onComplete();
    }
  },

  onComplete() {
    this.pause();
    SoundEngine.playBellChime();
    ConfettiEngine.trigger();

    if (this.currentMode === 'focus') {
      this.completedSessions++;
      this.streakCount++;
      this.totalFocusedMinutes += Math.round(this.totalSeconds / 60);
      this.saveState();
      this.updateStatsUI();

      // Switch to break
      const nextMode = (this.completedSessions % 4 === 0) ? 'longBreak' : 'shortBreak';
      this.setMode(nextMode);
    } else {
      this.setMode('focus');
    }

    if (Notification.permission === 'granted') {
      new Notification('AuraZenith Flow Alert', {
        body: 'Session completed! Time for the next phase.',
        icon: 'images/logo.png'
      });
    }
  },

  updateDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.displayDigits) {
      this.displayDigits.textContent = formatted;
    }

    // Document Title
    const modeLabel = this.currentMode === 'focus' ? 'Focus' : 'Break';
    document.title = `(${formatted}) ${modeLabel} — AuraZenith`;

    // SVG Circular Progress
    if (this.progressCircle) {
      const progressFraction = this.remainingSeconds / this.totalSeconds;
      const offset = this.ringCircumference * (1 - progressFraction);
      this.progressCircle.style.strokeDashoffset = offset;
    }
  },

  setupListeners() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    const resetBtn = document.getElementById('timerResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.reset());
    }

    const skipBtn = document.getElementById('timerSkipBtn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => this.skip());
    }

    document.querySelectorAll('.mode-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setMode(tab.dataset.mode);
      });
    });

    // Request notification permission smoothly
    if ('Notification' in window && Notification.permission === 'default') {
      document.body.addEventListener('click', () => {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }, { once: true });
    }
  }
};

/* ==========================================================================
   4. Mindful Breathing Sanctuary Module
   ========================================================================== */
const BreathingModule = {
  techniques: {
    box: { name: 'Box (4-4-4-4)', inhale: 4, hold1: 4, exhale: 4, hold2: 4 },
    relax: { name: '4-7-8 Relax', inhale: 4, hold1: 7, exhale: 8, hold2: 0 },
    energy: { name: 'Awaken (4-2-4)', inhale: 4, hold1: 2, exhale: 4, hold2: 0 }
  },
  currentTech: 'box',
  isActive: false,
  timer: null,
  phase: 'inhale', // 'inhale', 'hold1', 'exhale', 'hold2'
  secondsLeft: 4,
  cyclesCompleted: 0,

  orb: document.getElementById('breathingOrb'),
  phaseText: document.getElementById('breathPhaseText'),
  counterText: document.getElementById('breathCounterText'),
  instruction: document.getElementById('breathInstruction'),
  toggleBtn: document.getElementById('breathToggleBtn'),
  btnLabel: document.getElementById('breathBtnLabel'),
  startIcon: document.getElementById('breathStartIcon'),
  stopIcon: document.getElementById('breathStopIcon'),
  cyclesBadge: document.getElementById('breathCycles'),

  init() {
    this.setupListeners();
  },

  start() {
    this.isActive = true;
    this.phase = 'inhale';
    this.secondsLeft = this.techniques[this.currentTech].inhale;
    
    if (this.btnLabel) this.btnLabel.textContent = 'End Breathing';
    if (this.startIcon) this.startIcon.classList.add('hidden');
    if (this.stopIcon) this.stopIcon.classList.remove('hidden');

    this.runPhase();
    this.timer = setInterval(() => this.tick(), 1000);
  },

  stop() {
    this.isActive = false;
    clearInterval(this.timer);
    
    if (this.btnLabel) this.btnLabel.textContent = 'Start Breathing';
    if (this.startIcon) this.startIcon.classList.remove('hidden');
    if (this.stopIcon) this.stopIcon.classList.add('hidden');

    if (this.orb) {
      this.orb.className = 'breathing-orb';
    }
    if (this.phaseText) this.phaseText.textContent = 'Ready';
    if (this.counterText) this.counterText.textContent = '4';
    if (this.instruction) {
      this.instruction.textContent = 'Session paused. Click below anytime to center your awareness.';
    }
  },

  toggle() {
    if (this.isActive) this.stop();
    else this.start();
  },

  runPhase() {
    if (!this.orb) return;
    const tech = this.techniques[this.currentTech];

    if (this.phase === 'inhale') {
      this.orb.className = 'breathing-orb inhale';
      if (this.phaseText) this.phaseText.textContent = 'Inhale';
      if (this.instruction) this.instruction.textContent = 'Expand your chest and fill your lungs gently...';
    } else if (this.phase === 'hold1' || this.phase === 'hold2') {
      this.orb.className = 'breathing-orb hold';
      if (this.phaseText) this.phaseText.textContent = 'Hold';
      if (this.instruction) this.instruction.textContent = 'Sustain stillness, relax your shoulders and jaw...';
    } else if (this.phase === 'exhale') {
      this.orb.className = 'breathing-orb exhale';
      if (this.phaseText) this.phaseText.textContent = 'Exhale';
      if (this.instruction) this.instruction.textContent = 'Slowly release all tension through your mouth...';
    }

    if (this.counterText) this.counterText.textContent = this.secondsLeft;
  },

  tick() {
    this.secondsLeft--;
    if (this.secondsLeft > 0) {
      if (this.counterText) this.counterText.textContent = this.secondsLeft;
    } else {
      // Transition to next phase
      const tech = this.techniques[this.currentTech];
      if (this.phase === 'inhale') {
        if (tech.hold1 > 0) {
          this.phase = 'hold1';
          this.secondsLeft = tech.hold1;
        } else {
          this.phase = 'exhale';
          this.secondsLeft = tech.exhale;
        }
      } else if (this.phase === 'hold1') {
        this.phase = 'exhale';
        this.secondsLeft = tech.exhale;
      } else if (this.phase === 'exhale') {
        if (tech.hold2 > 0) {
          this.phase = 'hold2';
          this.secondsLeft = tech.hold2;
        } else {
          this.completeCycle();
          this.phase = 'inhale';
          this.secondsLeft = tech.inhale;
        }
      } else if (this.phase === 'hold2') {
        this.completeCycle();
        this.phase = 'inhale';
        this.secondsLeft = tech.inhale;
      }
      this.runPhase();
    }
  },

  completeCycle() {
    this.cyclesCompleted++;
    if (this.cyclesBadge) {
      this.cyclesBadge.textContent = `${this.cyclesCompleted} Cycles`;
    }
  },

  setTechnique(techKey) {
    if (this.isActive) this.stop();
    this.currentTech = techKey;
    document.querySelectorAll('.technique-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.technique === techKey);
    });
  },

  setupListeners() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    document.querySelectorAll('.technique-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.setTechnique(tab.dataset.technique);
      });
    });
  }
};

/* ==========================================================================
   5. Daily Intentions & Task Board Module
   ========================================================================== */
const TaskModule = {
  tasks: [],
  currentFilter: 'all',
  listContainer: document.getElementById('taskListContainer'),
  form: document.getElementById('taskForm'),
  input: document.getElementById('taskInput'),

  init() {
    this.loadTasks();
    this.render();
    this.setupListeners();
  },

  loadTasks() {
    const saved = localStorage.getItem('aurazenith_tasks_data');
    if (saved) {
      try {
        this.tasks = JSON.parse(saved);
      } catch (e) {
        this.tasks = [];
      }
    } else {
      // Default inspiring tasks
      this.tasks = [
        { id: '1', text: 'Define key objective for today', tag: 'Deep Work', completed: false },
        { id: '2', text: '25-minute uninterrupted flow block', tag: 'Study', completed: false },
        { id: '3', text: 'Hydrate & 3-minute mindful breath', tag: 'Wellness', completed: true }
      ];
      this.saveTasks();
    }
  },

  saveTasks() {
    localStorage.setItem('aurazenith_tasks_data', JSON.stringify(this.tasks));
  },

  addTask(text, tag) {
    if (!text.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      text: text.trim(),
      tag: tag || 'Deep Work',
      completed: false
    };
    this.tasks.unshift(newTask);
    this.saveTasks();
    this.render();
  },

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      if (task.completed) {
        ConfettiEngine.trigger();
      }
      this.saveTasks();
      this.render();
    }
  },

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    this.render();
  },

  clearCompleted() {
    this.tasks = this.tasks.filter(t => !t.completed);
    this.saveTasks();
    this.render();
  },

  render() {
    if (!this.listContainer) return;

    // Filter
    let filtered = this.tasks;
    if (this.currentFilter === 'active') {
      filtered = this.tasks.filter(t => !t.completed);
    } else if (this.currentFilter === 'completed') {
      filtered = this.tasks.filter(t => t.completed);
    }

    // Counts
    const allCount = this.tasks.length;
    const activeCount = this.tasks.filter(t => !t.completed).length;
    const doneCount = this.tasks.filter(t => t.completed).length;

    const countAllEl = document.getElementById('countAll');
    const countActiveEl = document.getElementById('countActive');
    const countCompletedEl = document.getElementById('countCompleted');

    if (countAllEl) countAllEl.textContent = allCount;
    if (countActiveEl) countActiveEl.textContent = activeCount;
    if (countCompletedEl) countCompletedEl.textContent = doneCount;

    if (filtered.length === 0) {
      this.listContainer.innerHTML = `
        <div class="empty-task-placeholder">
          <p>No intentions here. Clear your mind or write your next priority.</p>
        </div>
      `;
      return;
    }

    this.listContainer.innerHTML = filtered.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="task-left">
          <input 
            type="checkbox" 
            class="task-checkbox" 
            ${task.completed ? 'checked' : ''} 
            aria-label="Mark task completed"
          >
          <span class="task-text">${this.escapeHTML(task.text)}</span>
        </div>
        <div class="task-right">
          <span class="task-tag-badge">#${task.tag}</span>
          <button class="task-delete-btn" aria-label="Delete task">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Attach row events
    this.listContainer.querySelectorAll('.task-item').forEach(item => {
      const id = item.dataset.id;
      const checkbox = item.querySelector('.task-checkbox');
      const deleteBtn = item.querySelector('.task-delete-btn');

      if (checkbox) {
        checkbox.addEventListener('change', () => this.toggleTask(id));
      }
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteTask(id);
        });
      }
    });
  },

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  },

  setupListeners() {
    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.input.value;
        const selectedRadio = document.querySelector('input[name="taskTag"]:checked');
        const tag = selectedRadio ? selectedRadio.value : 'Deep Work';
        if (text.trim()) {
          this.addTask(text, tag);
          this.input.value = '';
        }
      });
    }

    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentFilter = tab.dataset.filter;
        this.render();
      });
    });

    const clearBtn = document.getElementById('clearCompletedBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearCompleted());
    }
  }
};

/* ==========================================================================
   6. Mindful Wisdom Quotes & Auto-saving Scratchpad
   ========================================================================== */
const WisdomModule = {
  quotes: [
    { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" },
    { text: "Simplicity is about subtracting the obvious and adding the meaningful.", author: "John Maeda" },
    { text: "Deep work is the ability to focus without distraction on a cognitively demanding task.", author: "Cal Newport" },
    { text: "Silence is not the absence of sound, but the stillness of the mind.", author: "Zen Proverb" },
    { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", author: "Buddha" },
    { text: "Slow down, and everything you are chasing will come around and catch you.", author: "John De Paola" },
    { text: "Quiet minds cannot be perplexed or frightened, but go on in fortune or in misfortune.", author: "Robert Louis Stevenson" }
  ],
  quoteTextEl: document.getElementById('quoteText'),
  quoteAuthorEl: document.getElementById('quoteAuthor'),

  init() {
    this.showRandom();
    const refreshBtn = document.getElementById('refreshQuoteBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.showRandom());
    }
  },

  showRandom() {
    const quote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
    if (this.quoteTextEl) this.quoteTextEl.textContent = `"${quote.text}"`;
    if (this.quoteAuthorEl) this.quoteAuthorEl.textContent = `— ${quote.author}`;
  }
};

const ScratchpadModule = {
  textarea: document.getElementById('scratchpadInput'),
  savePill: document.getElementById('autoSavePill'),
  timeout: null,

  init() {
    if (!this.textarea) return;
    const saved = localStorage.getItem('aurazenith_scratchpad');
    if (saved) this.textarea.value = saved;

    this.textarea.addEventListener('input', () => {
      if (this.savePill) this.savePill.textContent = 'Saving...';
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => {
        localStorage.setItem('aurazenith_scratchpad', this.textarea.value);
        if (this.savePill) this.savePill.textContent = 'Synced';
      }, 500);
    });
  }
};

/* ==========================================================================
   7. Particle Canvas (Interactive Ambient Floating Stardust)
   ========================================================================== */
const AmbientCanvas = {
  canvas: document.getElementById('ambientCanvas'),
  ctx: null,
  particles: [],
  maxParticles: 45,
  mouse: { x: null, y: null },

  init() {
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createParticle());
    }

    this.animate();
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  createParticle() {
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      radius: Math.random() * 2.2 + 0.6,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35 - 0.15,
      alpha: Math.random() * 0.5 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.01
    };
  },

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha += Math.sin(Date.now() * 0.001 * p.pulseSpeed) * 0.005;

      // Wrap around bounds
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      // Slight reaction to mouse
      if (this.mouse.x !== null) {
        const dx = this.mouse.x - p.x;
        const dy = this.mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.x -= dx * 0.02;
          p.y -= dy * 0.02;
        }
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(147, 197, 253, ${Math.max(0.1, Math.min(0.8, p.alpha))})`;
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = 'rgba(94, 234, 212, 0.4)';
      this.ctx.fill();
    }

    requestAnimationFrame(() => this.animate());
  }
};

/* ==========================================================================
   8. Celebratory Confetti Particle System
   ========================================================================== */
const ConfettiEngine = {
  canvas: document.getElementById('confettiCanvas'),
  ctx: null,
  pieces: [],
  animating: false,

  init() {
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  trigger() {
    if (!this.canvas || !this.ctx) return;
    const colors = ['#2dd4bf', '#8b5cf6', '#fb923c', '#f43f5e', '#38bdf8', '#34d399'];
    this.pieces = [];

    for (let i = 0; i < 75; i++) {
      this.pieces.push({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        w: Math.random() * 8 + 4,
        h: Math.random() * 6 + 3,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.7) * 16,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    if (!this.animating) {
      this.animating = true;
      this.render();
    }
  },

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.012;

      if (p.opacity <= 0) {
        this.pieces.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      this.ctx.restore();
    }

    if (this.pieces.length > 0) {
      requestAnimationFrame(() => this.render());
    } else {
      this.animating = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
};

/* ==========================================================================
   9. Ambient Scene / Wallpaper Switcher
   ========================================================================== */
const SceneModule = {
  btn: document.getElementById('sceneBtn'),
  menu: document.getElementById('sceneMenu'),
  nameEl: document.getElementById('currentSceneName'),

  init() {
    const savedTheme = localStorage.getItem('aurazenith_theme');
    const initialTheme = savedTheme === 'theme-light' ? 'theme-ocean' : savedTheme || 'theme-ocean';
    this.applyTheme(initialTheme);

    if (this.btn && this.menu) {
      this.btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.menu.classList.toggle('open');
      });

      document.addEventListener('click', () => {
        this.menu.classList.remove('open');
      });

      this.menu.querySelectorAll('.scene-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const theme = opt.dataset.theme;
          this.applyTheme(theme);
          this.menu.classList.remove('open');
        });
      });
    }
  },

  applyTheme(themeClass) {
    document.body.className = themeClass;
    localStorage.setItem('aurazenith_theme', themeClass);

    let name = 'Aurora';
    if (themeClass === 'theme-ocean') name = 'Ocean Blue';
    else if (themeClass === 'theme-lofi') name = 'Lo-Fi';
    else if (themeClass === 'theme-zen') name = 'Midnight';
    else if (themeClass === 'theme-cyber') name = 'Cyber';

    if (this.nameEl) this.nameEl.textContent = name;

    if (this.menu) {
      this.menu.querySelectorAll('.scene-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === themeClass);
      });
    }
  }
};

/* ==========================================================================
   10. Keyboard Shortcuts & Modal Dialog
   ========================================================================== */
const ModalModule = {
  modal: document.getElementById('shortcutsModal'),
  openBtn: document.getElementById('shortcutsBtn'),
  closeBtn: document.getElementById('closeModalBtn'),
  dismissBtn: document.getElementById('modalDismissBtn'),

  init() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    if (this.dismissBtn) {
      this.dismissBtn.addEventListener('click', () => this.close());
    }
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    // Fullscreen toggle
    const fsBtn = document.getElementById('fullscreenBtn');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Global keyboard listener
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        TimerModule.toggle();
      } else if (e.key === 'r' || e.key === 'R') {
        TimerModule.reset();
      } else if (e.key === 's' || e.key === 'S') {
        TimerModule.skip();
      } else if (e.key === 'm' || e.key === 'M') {
        SoundEngine.toggleMasterMute();
      } else if (e.key === 'b' || e.key === 'B') {
        BreathingModule.toggle();
      } else if (e.key === '?') {
        this.toggle();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  },

  open() {
    if (this.modal) this.modal.classList.remove('hidden');
  },

  close() {
    if (this.modal) this.modal.classList.add('hidden');
  },

  toggle() {
    if (this.modal && this.modal.classList.contains('hidden')) {
      this.open();
    } else {
      this.close();
    }
  },

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
};

/* ==========================================================================
   Boot Application on DOM Ready
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  ClockModule.init();
  SoundEngine.init();
  TimerModule.init();
  BreathingModule.init();
  TaskModule.init();
  WisdomModule.init();
  ScratchpadModule.init();
  AmbientCanvas.init();
  ConfettiEngine.init();
  SceneModule.init();
  ModalModule.init();
});
