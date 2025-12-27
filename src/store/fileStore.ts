import { create } from 'zustand';
import { FileType } from '@/types/project';
import { pdfjs } from 'react-pdf';

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ============================================================================
// TYPES
// ============================================================================

export interface UploadedFile {
  id: string;
  name: string;
  type: FileType;
  file: File;
  objectUrl: string;
  size: number;
  uploadedAt: string;
  thumbnailUrl?: string; // Data URL of first page thumbnail for PDFs
}

interface FileStore {
  // State
  files: Map<string, UploadedFile>;
  activeFileId: string | null;
  isLoading: boolean;

  // Actions
  addFile: (file: File, type: FileType) => Promise<UploadedFile>;
  removeFile: (fileId: string) => Promise<void>;
  setActiveFile: (fileId: string | null) => void;
  getFile: (fileId: string) => UploadedFile | undefined;
  getActiveFile: () => UploadedFile | undefined;
  clearFiles: () => void;
  loadFileFromStorage: (fileId: string) => Promise<UploadedFile | null>;
  initializeFromStorage: () => Promise<void>;
}

// ============================================================================
// INDEXEDDB HELPERS
// ============================================================================

const DB_NAME = 'note3-files';
const STORE_NAME = 'files';
const DB_VERSION = 1;

interface StoredFileData {
  id: string;
  name: string;
  type: FileType;
  data: ArrayBuffer;
  mimeType: string;
  size: number;
  uploadedAt: string;
  thumbnailUrl?: string; // Stored thumbnail data URL
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const saveFileToIndexedDB = async (file: File, id: string, type: FileType, thumbnailUrl?: string): Promise<void> => {
  const db = await openDB();
  const arrayBuffer = await file.arrayBuffer();

  const storedData: StoredFileData = {
    id,
    name: file.name,
    type,
    data: arrayBuffer,
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    thumbnailUrl,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(storedData);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const loadFileFromIndexedDB = async (id: string): Promise<StoredFileData | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
};

const deleteFileFromIndexedDB = async (id: string): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

const getAllFileIdsFromIndexedDB = async (): Promise<string[]> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as string[]);
  });
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = (): string => {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Generate a thumbnail from the first page of a PDF
 */
const generatePdfThumbnail = async (file: File, width = 340, height = 400): Promise<string | null> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // Calculate scale to fit thumbnail size while maintaining aspect ratio
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(width / viewport.width, height / viewport.height);
    const scaledViewport = page.getViewport({ scale });

    // Create canvas and render
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const context = canvas.getContext('2d');

    if (!context) return null;

    // White background
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      // @ts-ignore - canvas is optional but types require it
      canvas: canvas,
    }).promise;

    // Convert to data URL
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Failed to generate PDF thumbnail:', error);
    return null;
  }
};

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useFileStore = create<FileStore>((set, get) => ({
  // Initial State
  files: new Map(),
  activeFileId: null,
  isLoading: false,

  // Add a file (now persists to IndexedDB)
  addFile: async (file: File, type: FileType): Promise<UploadedFile> => {
    const id = generateId();
    const objectUrl = URL.createObjectURL(file);

    // Generate thumbnail for PDFs
    let thumbnailUrl: string | undefined;
    if (type === 'pdf') {
      thumbnailUrl = await generatePdfThumbnail(file) || undefined;
    }

    const uploadedFile: UploadedFile = {
      id,
      name: file.name,
      type,
      file,
      objectUrl,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      thumbnailUrl,
    };

    // Save to IndexedDB for persistence
    try {
      await saveFileToIndexedDB(file, id, type, thumbnailUrl);
      console.log(`📁 File saved to IndexedDB: ${file.name}`);
    } catch (error) {
      console.error('Failed to save file to IndexedDB:', error);
    }

    set((state) => {
      const newFiles = new Map(state.files);
      newFiles.set(id, uploadedFile);
      return { files: newFiles, activeFileId: id };
    });

    return uploadedFile;
  },

  // Remove a file
  removeFile: async (fileId: string): Promise<void> => {
    const file = get().files.get(fileId);
    if (file) {
      URL.revokeObjectURL(file.objectUrl);
    }

    // Remove from IndexedDB
    try {
      await deleteFileFromIndexedDB(fileId);
    } catch (error) {
      console.error('Failed to delete file from IndexedDB:', error);
    }

    set((state) => {
      const newFiles = new Map(state.files);
      newFiles.delete(fileId);
      return {
        files: newFiles,
        activeFileId: state.activeFileId === fileId ? null : state.activeFileId,
      };
    });
  },

  // Set active file - also loads from storage if not in memory
  setActiveFile: (fileId: string | null) => {
    if (fileId && !get().files.has(fileId)) {
      // File not in memory, try to load from IndexedDB
      get().loadFileFromStorage(fileId).then((file) => {
        if (file) {
          set({ activeFileId: fileId });
        }
      });
    } else {
      set({ activeFileId: fileId });
    }
  },

  // Get file by ID
  getFile: (fileId: string) => {
    return get().files.get(fileId);
  },

  // Get active file
  getActiveFile: () => {
    const { files, activeFileId } = get();
    return activeFileId ? files.get(activeFileId) : undefined;
  },

  // Clear all files
  clearFiles: () => {
    const { files } = get();
    files.forEach((file) => {
      URL.revokeObjectURL(file.objectUrl);
    });
    set({ files: new Map(), activeFileId: null });
  },

  // Load a single file from IndexedDB storage
  loadFileFromStorage: async (fileId: string): Promise<UploadedFile | null> => {
    try {
      const storedData = await loadFileFromIndexedDB(fileId);
      if (!storedData) return null;

      // Recreate File object from stored data
      const blob = new Blob([storedData.data], { type: storedData.mimeType });
      const file = new File([blob], storedData.name, { type: storedData.mimeType });
      const objectUrl = URL.createObjectURL(blob);

      const uploadedFile: UploadedFile = {
        id: storedData.id,
        name: storedData.name,
        type: storedData.type,
        file,
        objectUrl,
        size: storedData.size,
        uploadedAt: storedData.uploadedAt,
        thumbnailUrl: storedData.thumbnailUrl,
      };

      // Add to in-memory store
      set((state) => {
        const newFiles = new Map(state.files);
        newFiles.set(fileId, uploadedFile);
        return { files: newFiles };
      });

      console.log(`📁 File loaded from IndexedDB: ${storedData.name}`);
      return uploadedFile;
    } catch (error) {
      console.error('Failed to load file from IndexedDB:', error);
      return null;
    }
  },

  // Initialize store from IndexedDB (load all files)
  initializeFromStorage: async (): Promise<void> => {
    set({ isLoading: true });
    try {
      const fileIds = await getAllFileIdsFromIndexedDB();
      console.log(`📁 Found ${fileIds.length} files in IndexedDB`);

      for (const fileId of fileIds) {
        await get().loadFileFromStorage(fileId);
      }
    } catch (error) {
      console.error('Failed to initialize files from IndexedDB:', error);
    } finally {
      set({ isLoading: false });
    }
  },
}));
