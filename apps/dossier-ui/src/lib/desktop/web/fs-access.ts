/** File System Access API helpers for the web build's library storage.
 *
 * The web build (served as static files, no backend) keeps its encrypted
 * library in a folder the user picks. The directory handle is persisted in
 * IndexedDB so the choice survives reloads; the browser re-confirms
 * read/write permission on each session. Chromium-only — callers must check
 * `isFileSystemAccessSupported()` first and steer other browsers elsewhere. */

// Minimal structural types for the File System Access API so we don't depend
// on a specific TS lib.dom version. Only the members we use are declared.
type PermissionState = "granted" | "denied" | "prompt";
type FsPermissionDescriptor = { mode?: "read" | "readwrite" };

export interface FsFileHandle {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile: () => Promise<{ text: () => Promise<string> }>;
}

export interface FsDirectoryHandle {
  name: string;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FsFileHandle>;
  queryPermission?: (desc: FsPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (desc: FsPermissionDescriptor) => Promise<PermissionState>;
}

type DirectoryPicker = (opts?: { mode?: "read" | "readwrite" }) => Promise<FsDirectoryHandle>;

const IDB_NAME = "dossier-web";
const IDB_STORE = "handles";
const HANDLE_KEY = "libraryDir";

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Prompt the user to choose a library folder and remember the choice. */
export async function pickDirectory(): Promise<FsDirectoryHandle> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker;
  const handle = await picker({ mode: "readwrite" });
  await idbSet(HANDLE_KEY, handle);
  return handle;
}

/** The previously-chosen folder handle, or null if none is remembered. */
export function getSavedDirectory(): Promise<FsDirectoryHandle | null> {
  return idbGet<FsDirectoryHandle>(HANDLE_KEY);
}

/** Ensure read/write permission on a handle, re-prompting if needed. */
export async function ensurePermission(handle: FsDirectoryHandle): Promise<boolean> {
  const desc: FsPermissionDescriptor = { mode: "readwrite" };
  if ((await handle.queryPermission?.(desc)) === "granted") return true;
  return (await handle.requestPermission?.(desc)) === "granted";
}

/** Read a UTF-8 file from the folder, or null if it doesn't exist yet. */
export async function readFile(handle: FsDirectoryHandle, name: string): Promise<string | null> {
  try {
    const fileHandle = await handle.getFileHandle(name);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null; // not-found (or unreadable) → treat as absent
  }
}

/** Check whether a file exists in the folder. */
export async function fileExists(handle: FsDirectoryHandle, name: string): Promise<boolean> {
  try {
    await handle.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Write a UTF-8 file into the folder, creating it if necessary. */
export async function writeFile(
  handle: FsDirectoryHandle,
  name: string,
  content: string
): Promise<void> {
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
