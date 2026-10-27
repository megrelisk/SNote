import type {
  CollectionMap,
  CollectionName,
  DocStore,
  Filter,
  SnapshotMeta,
  SyncStatus,
  Unsubscribe,
  WriteOp,
} from './store';
import { stripUndefined } from './store';

/**
 * The subset of the Firestore modular API that SNote uses. Both the Firebase
 * JS SDK (`firebase/firestore`, web) and React Native Firebase
 * (`@react-native-firebase/firestore`, mobile) expose these functions with the
 * same signatures, so one adapter serves both platforms. The app passes the
 * imported module in, keeping `@snote/core` free of SDK dependencies.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface FirestoreModularApi {
  collection(db: any, path: string): any;
  doc(db: any, path: string): any;
  query(ref: any, ...constraints: any[]): any;
  where(field: string, op: any, value: unknown): any;
  onSnapshot(
    ref: any,
    options: { includeMetadataChanges: boolean },
    onNext: (snapshot: any) => void,
    onError?: (error: any) => void,
  ): () => void;
  getDoc(ref: any): Promise<any>;
  writeBatch(db: any): {
    set(ref: any, data: any, options?: { merge?: boolean }): unknown;
    delete(ref: any): unknown;
    commit(): Promise<void>;
  };
}

/** Firestore layout: every user's data lives under `users/{uid}`. */
export function userCollectionPath(uid: string, collection: CollectionName): string {
  return `users/${uid}/${collection}`;
}

export class FirestoreDocStore implements DocStore {
  readonly kind = 'firestore' as const;
  private pendingByWatch = new Map<number, boolean>();
  private fromCacheByWatch = new Map<number, boolean>();
  private inflightWrites = 0;
  private lastError: string | null = null;
  private statusListeners = new Set<(s: SyncStatus) => void>();
  private nextWatchId = 1;
  private browserOnline = true;

  constructor(
    private readonly api: FirestoreModularApi,
    private readonly db: unknown,
    private readonly uid: string,
    /** Optional connectivity signal (navigator.onLine / NetInfo). */
    connectivity?: (onChange: (online: boolean) => void) => Unsubscribe,
  ) {
    connectivity?.((online) => {
      this.browserOnline = online;
      this.emitStatus();
    });
  }

  private ref(collection: CollectionName, id?: string) {
    const path = userCollectionPath(this.uid, collection);
    return id ? this.api.doc(this.db, `${path}/${id}`) : this.api.collection(this.db, path);
  }

  watch<C extends CollectionName>(
    collection: C,
    filters: readonly Filter[],
    onData: (items: CollectionMap[C][], meta: SnapshotMeta) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    const watchId = this.nextWatchId++;
    const q = this.api.query(
      this.ref(collection),
      ...filters.map((f) => this.api.where(f.field, f.op, f.value)),
    );
    const unsubscribe = this.api.onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot: any) => {
        const items = snapshot.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        const meta: SnapshotMeta = {
          fromCache: !!snapshot.metadata?.fromCache,
          hasPendingWrites: !!snapshot.metadata?.hasPendingWrites,
        };
        this.pendingByWatch.set(watchId, meta.hasPendingWrites);
        this.fromCacheByWatch.set(watchId, meta.fromCache);
        this.emitStatus();
        onData(items, meta);
      },
      (error: any) => {
        this.lastError = String(error?.message ?? error);
        this.emitStatus();
        onError?.(error instanceof Error ? error : new Error(this.lastError));
      },
    );
    return () => {
      unsubscribe();
      this.pendingByWatch.delete(watchId);
      this.fromCacheByWatch.delete(watchId);
      this.emitStatus();
    };
  }

  async get<C extends CollectionName>(collection: C, id: string): Promise<CollectionMap[C] | null> {
    const snap = await this.api.getDoc(this.ref(collection, id));
    const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
    return exists ? ({ ...snap.data(), id } as CollectionMap[C]) : null;
  }

  async write(ops: readonly WriteOp[]): Promise<void> {
    // Firestore batches are limited to 500 operations.
    const chunks: WriteOp[][] = [];
    for (let i = 0; i < ops.length; i += 450) chunks.push(ops.slice(i, i + 450));
    this.inflightWrites += 1;
    this.emitStatus();
    try {
      await Promise.all(
        chunks.map((chunk) => {
          const batch = this.api.writeBatch(this.db);
          for (const op of chunk) {
            const ref = this.ref(op.collection, op.id);
            if (op.kind === 'delete') batch.delete(ref);
            else batch.set(ref, stripUndefined(op.data), { merge: !!op.merge });
          }
          return batch.commit();
        }),
      );
      this.lastError = null;
    } catch (error: any) {
      this.lastError = String(error?.message ?? error);
      throw error;
    } finally {
      this.inflightWrites -= 1;
      this.emitStatus();
    }
  }

  watchStatus(onStatus: (status: SyncStatus) => void): Unsubscribe {
    this.statusListeners.add(onStatus);
    onStatus(this.status());
    return () => {
      this.statusListeners.delete(onStatus);
    };
  }

  private status(): SyncStatus {
    const pending =
      this.inflightWrites > 0 || [...this.pendingByWatch.values()].some(Boolean);
    const allFromCache =
      this.fromCacheByWatch.size > 0 && [...this.fromCacheByWatch.values()].every(Boolean);
    return {
      online: this.browserOnline && !allFromCache,
      pendingWrites: pending,
      error: this.lastError,
    };
  }

  private emitStatus() {
    const status = this.status();
    for (const l of this.statusListeners) l(status);
  }
}
