/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const playBeep = (freq = 440, type: OscillatorType = 'sine', duration = 0.08) => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Smooth volume fade
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Fail silently or log safely inside browser sandboxes
    console.debug('Audio playback blocked or omitted', e);
  }
};

export const playModeSwitchSound = (enabled: boolean) => {
  if (!enabled) return;
  playBeep(523.25, 'sine', 0.12); // C5
  setTimeout(() => {
    playBeep(659.25, 'sine', 0.08); // E5
  }, 100);
};

export const playResetSound = (enabled: boolean) => {
  if (!enabled) return;
  playBeep(392.00, 'triangle', 0.15); // G4
  setTimeout(() => {
    playBeep(329.63, 'triangle', 0.15); // E4
    setTimeout(() => {
      playBeep(261.63, 'triangle', 0.25); // C4
    }, 120);
  }, 120);
};

export const playAddSound = (enabled: boolean) => {
  if (!enabled) return;
  playBeep(587.33, 'sine', 0.08); // D5
  setTimeout(() => {
    playBeep(783.99, 'sine', 0.15); // G5
  }, 80);
};

export const playDeleteSound = (enabled: boolean) => {
  if (!enabled) return;
  playBeep(220.00, 'sawtooth', 0.15); // A3
};
