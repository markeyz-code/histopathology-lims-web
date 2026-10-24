import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SyncBatchResult, SyncMutationType } from '@lims/shared';

interface OfflineMutation {
  id: string;
  type: SyncMutationType;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

interface OfflineDatabase extends DBSchema {
  mutations: {
    key: string;
    value: OfflineMutation;
    indexes: { 'by-created': string };
  };
}

let database: Promise<IDBPDatabase<OfflineDatabase>> | null = null;

function openDatabase(): Promise<IDBPDatabase<OfflineDatabase>> {
  database ??= openDB<OfflineDatabase>('histopathology-lims-offline', 1, {
    upgrade(db) {
      const store = db.createObjectStore('mutations', { keyPath: 'id' });
      store.createIndex('by-created', 'createdAt');
    },
  });
  return database;
}

export function useOfflineQueue() {
  const api = useApi();
  const pendingCount = useState('offline-pending-count', () => 0);
  const syncing = useState('offline-syncing', () => false);
  const lastError = useState<string | null>('offline-sync-error', () => null);
  const lastSyncedAt = useState<string | null>('offline-last-synced', () => null);
  const online = useState('offline-online', () => true);

  async function refresh(): Promise<void> {
    if (!import.meta.client) return;
    online.value = navigator.onLine;
    try {
      const db = await openDatabase();
      pendingCount.value = await db.count('mutations');
    } catch {
      pendingCount.value = 0;
    }
  }

  async function enqueue(
    type: SyncMutationType,
    payload: Record<string, unknown>,
  ): Promise<OfflineMutation | null> {
    if (!import.meta.client) return null;
    try {
      const db = await openDatabase();
      const mutation: OfflineMutation = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
      };
      await db.add('mutations', mutation);
      await refresh();
      return mutation;
    } catch {
      return null;
    }
  }

  async function flush(): Promise<void> {
    if (!import.meta.client || syncing.value) return;
    online.value = navigator.onLine;
    if (!online.value) {
      lastError.value = 'No connection yet. The queue is safe on this device.';
      return;
    }
    const db = await openDatabase();
    const all = await db.getAllFromIndex('mutations', 'by-created');
    if (all.length === 0) {
      pendingCount.value = 0;
      lastError.value = null;
      return;
    }
    syncing.value = true;
    lastError.value = null;
    try {
      for (let index = 0; index < all.length; index += 50) {
        const batch = all.slice(index, index + 50);
        const result = await api.post<SyncBatchResult>('/sync/batch', {
          mutations: batch.map((item) => ({
            id: item.id,
            type: item.type,
            payload: item.payload,
            createdAt: item.createdAt,
          })),
        });
        for (const outcome of result.results) {
          const item = batch.find((candidate) => candidate.id === outcome.id);
          if (!item) continue;
          if (outcome.ok) {
            await db.delete('mutations', item.id);
          } else {
            await db.put('mutations', {
              ...item,
              attempts: item.attempts + 1,
              lastError: outcome.error,
            });
          }
        }
      }
      lastSyncedAt.value = new Date().toISOString();
    } catch (error) {
      lastError.value = apiErrorMessage(error);
    } finally {
      syncing.value = false;
      await refresh();
    }
  }

  async function clear(): Promise<void> {
    if (!import.meta.client) return;
    const db = await openDatabase();
    await db.clear('mutations');
    pendingCount.value = 0;
    lastError.value = null;
  }

  return {
    pendingCount,
    syncing,
    lastError,
    lastSyncedAt,
    online,
    refresh,
    enqueue,
    flush,
    clear,
  };
}
