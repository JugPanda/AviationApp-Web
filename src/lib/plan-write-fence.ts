// A Web Lock does not make WebKit's per-process localStorage cache coherent.
// Keep a small transactional fingerprint fence in IndexedDB. Records themselves
// remain in the original localStorage key; no automatic migration or cloud sync.
const DATABASE = 'avweather-write-fences';
const STORE = 'fingerprints';

async function fingerprint(raw: string | null): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(raw)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface PlanFenceSnapshot {
  raw: string | null;
  fence: string | undefined;
}

function openFenceDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Local write coordination is unavailable.')); return; }
    const open = indexedDB.open(DATABASE, 1);
    let blocked = false;
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onblocked = () => {
      blocked = true;
      reject(new Error('Local write coordination is blocked. Close other app tabs and retry.'));
    };
    open.onsuccess = () => {
      const db = open.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

export async function readFence(key: string): Promise<string | undefined> {
  const db = await openFenceDatabase();
  try {
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const get = tx.objectStore(STORE).get(key);
      tx.oncomplete = () => {
        if (get.result !== undefined && typeof get.result !== 'string') {
          reject(new Error('Unsupported write fingerprint.'));
        } else resolve(get.result);
      };
      tx.onabort = () => reject(tx.error || new Error('Could not read write protection.'));
    });
  } finally { db.close(); }
}

export async function getExportState(key: string): Promise<{
  raw: string | null; verified: boolean; recovery: PlanFenceSnapshot | null;
}> {
  // Preserve the exact snapshot even if coordination is denied: recovery export
  // must remain possible, but must not masquerade as a complete backup.
  const raw = localStorage.getItem(key);
  try {
    const hash = await fingerprint(raw);
    const fence = await readFence(key);
    if (localStorage.getItem(key) !== raw) return { raw, verified: false, recovery: null };
    // No fence yet is the pre-release legacy store, not a known disagreement.
    return { raw, verified: fence === undefined || fence === hash, recovery: { raw, fence } };
  } catch {
    return { raw, verified: false, recovery: null };
  }
}

// Explicit, backup-first reconciliation only. It never writes/removes plan
// records. Both the exported fingerprint and raw snapshot must still match.
export async function reconcilePlanFence(key: string, exported: PlanFenceSnapshot): Promise<boolean> {
  const hash = await fingerprint(exported.raw);
  const db = await openFenceDatabase();
  try {
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      let reconciled = false;
      let failure: unknown;
      tx.oncomplete = () => resolve(reconciled);
      tx.onabort = () => reject(failure || tx.error || new Error('Write protection recovery failed.'));
      const get = store.get(key);
      get.onsuccess = () => {
        try {
          // No await here: check and put share the live IDB transaction, so a
          // cooperating newer writer cannot slip between fence comparison/put.
          if (get.result !== exported.fence || localStorage.getItem(key) !== exported.raw) return;
          store.put(hash, key);
          reconciled = true;
        } catch (error) { failure = error; tx.abort(); }
      };
    });
  } finally { db.close(); }
}

export async function fencedPlanWrite(
  key: string, expected: string | null, next: string, commit: () => boolean,
): Promise<boolean> {
  // Missing, denied or broken coordination must never bypass an existing fence.
  if (typeof indexedDB === 'undefined') throw new Error('Local write coordination is unavailable.');
  const [beforeHash, afterHash] = await Promise.all([fingerprint(expected), fingerprint(next)]);
  return new Promise<boolean>((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    let settled = false;
    const fail = (error: unknown) => { if (!settled) { settled = true; reject(error); } };
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => fail(open.error);
    open.onblocked = () => fail(new Error('Local write coordination is blocked. Close other app tabs and retry.'));
    open.onsuccess = () => {
      const db = open.result;
      if (settled) { db.close(); return; }
      db.onversionchange = () => db.close();
      let wrote = false;
      let conflict = false;
      let failure: unknown;
      let tx: IDBTransaction;
      try { tx = db.transaction(STORE, 'readwrite'); }
      catch (error) { db.close(); fail(error); return; }
      const store = tx.objectStore(STORE);
      tx.oncomplete = () => { db.close(); settled = true; resolve(wrote && !conflict); };
      tx.onabort = () => {
        db.close();
        // An unlikely commit failure after the synchronous localStorage write
        // must restore its exact predecessor, not leave a reported-failed save.
        if (wrote) {
          try {
            if (localStorage.getItem(key) !== next) throw new Error('Storage changed during interrupted save.');
            if (expected === null) localStorage.removeItem(key); else localStorage.setItem(key, expected);
          } catch {
            fail(new Error('Save was interrupted and recovery could not be confirmed. Export saved records before retrying.'));
            return;
          }
        }
        if (conflict) { settled = true; resolve(false); }
        else fail(failure || tx.error || new Error('Local write coordination failed.'));
      };
      const get = store.get(key);
      get.onsuccess = () => {
        // A fingerprint mismatch is a stale writer even when localStorage still
        // returns the old bytes. Never automatically rebaseline this fence.
        if (get.result !== undefined && get.result !== beforeHash) {
          conflict = true;
          return;
        }
        const put = store.put(afterHash, key);
        put.onsuccess = () => {
          try {
            if (!commit()) { conflict = true; tx.abort(); return; }
            wrote = true;
          } catch (error) { failure = error; tx.abort(); }
        };
      };
    };
  });
}
