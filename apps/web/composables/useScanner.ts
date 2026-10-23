import type { ScanResponse, Station } from '@lims/shared';
import { isNetworkError } from './useApi';

export interface ScanHistoryEntry {
  id: number;
  ok: boolean;
  barcode: string;
  message: string;
  label: string | null;
  accessionNumber: string | null;
  at: string;
  result: ScanResponse | null;
}

let nextHistoryId = 1;
let audioContext: AudioContext | null = null;

export function useScanner() {
  const api = useApi();
  const barcode = ref('');
  const busy = ref(false);
  const lastResult = ref<ScanResponse | null>(null);
  const lastError = ref<string | null>(null);
  const flash = ref<'success' | 'error' | 'queued' | null>(null);
  const offlineNotice = ref<string | null>(null);
  const queue = useOfflineQueue();
  const history = ref<ScanHistoryEntry[]>([]);
  const muted = ref(false);

  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let lastBarcode = '';
  let lastScanAt = 0;

  onMounted(() => {
    try {
      muted.value = localStorage.getItem('lims-scan-muted') === 'true';
    } catch {
      muted.value = false;
    }
  });

  function tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    delay = 0,
    volume = 0.16,
  ): void {
    if (!import.meta.client || muted.value) return;
    try {
      audioContext ??= new AudioContext();
      if (audioContext.state === 'suspended') void audioContext.resume();
      const start = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Audio is a progressive enhancement; visual feedback still applies.
    }
  }

  function successSound(): void {
    tone(720, 0.08, 'sine', 0);
    tone(1_060, 0.11, 'sine', 0.09);
  }

  function errorSound(): void {
    tone(180, 0.18, 'square', 0, 0.11);
    tone(130, 0.25, 'square', 0.17, 0.11);
  }

  function setFlash(kind: 'success' | 'error' | 'queued'): void {
    flash.value = kind;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flash.value = null;
    }, 1_100);
  }

  function toggleMuted(): void {
    muted.value = !muted.value;
    try {
      localStorage.setItem('lims-scan-muted', String(muted.value));
    } catch {
      // Ignore storage failures.
    }
    if (!muted.value) successSound();
  }

  function pushHistory(entry: Omit<ScanHistoryEntry, 'id'>): void {
    history.value = [{ ...entry, id: nextHistoryId++ }, ...history.value].slice(0, 20);
  }

  async function scan(station: Station): Promise<ScanResponse | null> {
    const value = barcode.value.trim().toUpperCase();
    if (!value || busy.value) return null;
    const now = Date.now();
    if (value === lastBarcode && now - lastScanAt < 900) return null;
    lastBarcode = value;
    lastScanAt = now;
    busy.value = true;
    lastError.value = null;
    offlineNotice.value = null;
    try {
      const result = await api.post<ScanResponse>('/custody/scan', {
        barcode: value,
        station,
      });
      lastResult.value = result;
      lastError.value = null;
      offlineNotice.value = null;
      barcode.value = '';
      successSound();
      setFlash('success');
      pushHistory({
        ok: true,
        barcode: value,
        message: result.message,
        label: result.entity.label,
        accessionNumber: result.entity.accessionNumber,
        at: result.timestamp,
        result,
      });
      return result;
    } catch (error) {
      if (isNetworkError(error)) {
        const queued = await queue.enqueue('SCAN', { barcode: value, station });
        if (queued) {
          lastError.value = null;
          lastResult.value = null;
          offlineNotice.value = `${value} saved offline. It will sync automatically when the connection returns.`;
          barcode.value = '';
          setFlash('queued');
          pushHistory({
            ok: true,
            barcode: value,
            message: 'Saved offline — waiting to sync',
            label: null,
            accessionNumber: null,
            at: queued.createdAt,
            result: null,
          });
          return null;
        }
      }
      const message = apiErrorMessage(error);
      lastError.value = message;
      lastResult.value = null;
      offlineNotice.value = null;
      errorSound();
      setFlash('error');
      pushHistory({
        ok: false,
        barcode: value,
        message,
        label: null,
        accessionNumber: null,
        at: new Date().toISOString(),
        result: null,
      });
      return null;
    } finally {
      busy.value = false;
    }
  }

  function reset(): void {
    barcode.value = '';
    lastError.value = null;
    lastResult.value = null;
    flash.value = null;
    offlineNotice.value = null;
  }

  return {
    barcode,
    busy,
    lastResult,
    lastError,
    flash,
    offlineNotice,
    queue,
    history,
    muted,
    scan,
    reset,
    toggleMuted,
  };
}
