/**
 * Laboratory Web Audio & AI Voice Assistant Composable
 * Provides clinical audio wedge scan beeps, success validation chimes,
 * and browser-native SpeechSynthesis for real-time laboratory briefings.
 */

export function useLabAudio() {
  const isVoiceEnabled = ref(false);
  const isSpeaking = ref(false);
  const speechRate = ref(1.05);

  let audioCtx: AudioContext | null = null;

  function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  /**
   * Laboratory 2D Barcode Wedge Scanner Sound
   * High-contrast double-beep (1400Hz -> 2100Hz) characteristic of Zebra/Honeywell scanners.
   */
  function playScanBeep() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(2100, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Audio playback silently handled if audio context not permitted
    }
  }

  /**
   * Final Sign-off / Quality Validation Triad Chime
   */
  function playSuccessChime() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + i * 0.07;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch {
      // Audio context error handler
    }
  }

  /**
   * Panic / Critical Alert Tone
   */
  function playAlertTone() {
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.1);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Audio context error handler
    }
  }

  /**
   * Speak clinical AI briefing using SpeechSynthesis
   */
  function speakBriefing(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Wake up AudioContext on user interaction
    getAudioContext();

    window.speechSynthesis.cancel();
    if (!isVoiceEnabled.value) return;

    const cleanText = text.replace(/[—·#*]/g, ' ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechRate.value;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Google') ||
            v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Karen') ||
            v.name.includes('Premium') ||
            v.name.includes('Enhanced')),
      ) || voices.find((v) => v.lang.startsWith('en'));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      isSpeaking.value = true;
    };
    utterance.onend = () => {
      isSpeaking.value = false;
    };
    utterance.onerror = () => {
      isSpeaking.value = false;
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      isSpeaking.value = false;
    }
  }

  function toggleVoice() {
    isVoiceEnabled.value = !isVoiceEnabled.value;
    if (!isVoiceEnabled.value) {
      stopSpeaking();
    } else {
      playScanBeep();
    }
  }

  return {
    isVoiceEnabled,
    isSpeaking,
    speechRate,
    playScanBeep,
    playSuccessChime,
    playAlertTone,
    speakBriefing,
    stopSpeaking,
    toggleVoice,
  };
}
