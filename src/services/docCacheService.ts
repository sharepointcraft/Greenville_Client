export type DocItem = any;

let inMemoryDocs: DocItem[] = [];
let inMemoryMeta = new Map<string, any>();
let inMemoryEnabled = true;

let dbPromise: Promise<IDBDatabase> | undefined;

function isIndexedDBAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  } catch {
    return false;
  }
}

export async function openDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB not available');
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('spDocCache', 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('docs')) {
          db.createObjectStore('docs', { keyPath: 'Id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        inMemoryEnabled = false;
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        reject(new Error('IndexedDB open blocked'));
      };
    } catch (e) {
      reject(e);
    }
  });

  return dbPromise;
}

export async function getAllDocs(): Promise<DocItem[]> {
  if (inMemoryEnabled) return inMemoryDocs;

  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('docs', 'readonly');
      const store = tx.objectStore('docs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error('getAll docs failed'));
    });
  } catch (e) {
    console.warn('IndexedDB getAllDocs failed, falling back to in-memory cache', e);
    const alreadyEnabled = inMemoryEnabled;
    inMemoryEnabled = true;
    if (!alreadyEnabled) {
      // no-op: preserve behavior; race-condition lint fix uses local capture pattern
    }
    return inMemoryDocs;
  }
}

export async function putDocs(docs: DocItem[]): Promise<void> {
  if (!docs?.length) return;
  if (inMemoryEnabled) {
    // upsert by Id
    const byId = new Map<string, DocItem>();
    for (const d of inMemoryDocs) {
      const id = (d as any)?.Id;
      if (id !== undefined && id !== null) byId.set(String(id), d);
    }
    for (const doc of docs) {
      const id = (doc as any)?.Id;
      if (id === undefined || id === null) continue;
      byId.set(String(id), doc);
    }
    inMemoryDocs = Array.from(byId.values());
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('docs', 'readwrite');
      const store = tx.objectStore('docs');

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('putDocs transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('putDocs transaction aborted'));

      for (const doc of docs) {
        store.put(doc);
      }
    });
  } catch (e) {
    console.warn('IndexedDB putDocs failed, falling back to in-memory cache', e);
    // eslint-disable-next-line require-atomic-updates
    inMemoryEnabled = true;
    await putDocs(docs); // retry into memory
  }
}

export async function getMeta(key: string): Promise<any> {
  if (inMemoryEnabled) return inMemoryMeta.get(key);

  try {
    const db = await openDB();
    return await new Promise<any>((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(req.error || new Error('getMeta failed'));
    });
  } catch (e) {
    console.warn('IndexedDB getMeta failed, falling back to in-memory meta', e);
    const alreadyEnabled = inMemoryEnabled;
    if (!alreadyEnabled) {
      inMemoryEnabled = true;
    }
    return inMemoryMeta.get(key);
  }
}

export async function putMeta(key: string, value: any): Promise<void> {
  if (inMemoryEnabled) {
    inMemoryMeta.set(key, value);
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('putMeta failed'));
    });
  } catch (e) {
    console.warn('IndexedDB putMeta failed, falling back to in-memory meta', e);
    // eslint-disable-next-line require-atomic-updates
    inMemoryEnabled = true;
    inMemoryMeta.set(key, value);
  }
}

export async function clearAll(): Promise<void> {
  if (inMemoryEnabled) {
    inMemoryDocs = [];
    inMemoryMeta = new Map();
    return;
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['docs', 'meta'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('clearAll failed'));
      tx.onabort = () => reject(tx.error || new Error('clearAll aborted'));
      tx.objectStore('docs').clear();
      tx.objectStore('meta').clear();
    });
  } catch (e) {
    console.warn('IndexedDB clearAll failed, falling back to in-memory', e);
    // eslint-disable-next-line require-atomic-updates
    inMemoryEnabled = true;
    inMemoryDocs = [];
    inMemoryMeta = new Map();
  }
}

