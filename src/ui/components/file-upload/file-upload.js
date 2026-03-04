/**
 * CSMA File Upload Component
 * Drag & drop with queue, progress, cancel/retry, previews
 * Security: no innerHTML for user data; allowlist + size gates
 */

const DEFAULTS = {
  accept: [
    'image/png', 'image/jpeg', 'image/webp',
    'application/pdf', 'text/plain', 'text/markdown',
    'audio/mpeg', 'audio/wav', 'video/mp4'
  ],
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 8,
  simulateUpload: true,
  simulateDuration: 2200
};

const iconMap = {
  image: new URL('../../icons/image.svg', import.meta.url).href,
  pdf: new URL('../../icons/file.svg', import.meta.url).href,
  text: new URL('../../icons/file.svg', import.meta.url).href,
  audio: new URL('../../icons/music.svg', import.meta.url).href,
  video: new URL('../../icons/video.svg', import.meta.url).href,
  other: new URL('../../icons/folder.svg', import.meta.url).href
};

function createThumbIcon(src, alt) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.className = 'file-item__thumb-icon';
  return img;
}

function sanitizeFileName(name) {
  const cleaned = name.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 120);
  return cleaned || 'file';
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = bytes === 0 ? 0 : Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function typeToKind(file) {
  const mime = file.type;
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('text/')) return 'text';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
}

function validateFile(file, settings) {
  const errors = [];
  if (file.size > settings.maxSize) {
    errors.push(`File too large (max ${formatBytes(settings.maxSize)})`);
  }
  const allowed = settings.accept.some(type => file.type === type);
  if (!allowed) {
    errors.push('File type not allowed');
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext.includes('<') || ext.includes('>')) {
    errors.push('Invalid filename');
  }
  return errors;
}

export function initFileUpload(root, opts = {}) {
  const settings = { ...DEFAULTS, ...opts };
  if (!root) return () => { };

  const input = root.querySelector('[data-fu-input]');
  const dropzone = root.querySelector('[data-fu-dropzone]');
  const queue = root.querySelector('[data-fu-queue]');
  const empty = root.querySelector('[data-fu-empty]');

  if (settings.accept?.length && input) {
    input.setAttribute('accept', settings.accept.join(','));
  }

  const items = new Map();
  const objectUrls = new Map();

  function updateEmptyState() {
    if (!empty || !queue) return;
    const hasItems = queue.children.length > 0;
    empty.hidden = hasItems;
  }

  function setDropzoneState(state) {
    if (!dropzone) return;
    dropzone.dataset.state = state || 'idle';
  }

  function addFiles(fileList) {
    const files = Array.from(fileList);
    const remaining = settings.maxFiles - items.size;
    const allowed = remaining > 0 ? files.slice(0, remaining) : [];
    const batch = [];

    allowed.forEach((file) => {
      const id = crypto.randomUUID();
      const errors = validateFile(file, settings);
      const safeName = sanitizeFileName(file.name);
      const kind = typeToKind(file);

      const ui = createItem({ id, file, name: safeName, kind, errors });
      queue?.appendChild(ui);
      items.set(id, { file, status: errors.length ? 'error' : 'queued', abort: null, el: ui });

      if (!errors.length) {
        batch.push({ id, file });
        // Still start individual simulation if enabled and strict batching not enforced
        if (settings.simulateUpload && !settings.eventBus) {
          startUpload(id);
        }
      }
    });

    if (batch.length > 0 && settings.eventBus) {
      settings.eventBus.publish('FILES_UPLOAD_BATCH_REQUESTED', {
        batchId: crypto.randomUUID(),
        files: batch.map(f => ({ id: f.id, name: f.file.name, size: f.file.size, type: f.file.type })),
        timestamp: Date.now()
      });

      // Mark as uploading in UI immediately? 
      // Or wait for event bus to acknowledge? 
      // For optimisitc UI, let's mark them.
      batch.forEach(({ id }) => setStatus(id, 'uploading', 'Queued for upload...', 0));
    }

    updateEmptyState();
  }

  function createItem({ id, file, name, kind, errors }) {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.status = errors.length ? 'error' : 'queued';
    item.dataset.fileId = id;

    const thumb = document.createElement('div');
    thumb.className = 'file-item__thumb';

    if (kind === 'image') {
      const url = URL.createObjectURL(file);
      objectUrls.set(id, url);
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      const iconSrc = iconMap[kind] || iconMap.other;
      const iconEl = createThumbIcon(iconSrc, `${kind} file icon`);
      thumb.appendChild(iconEl);
    }

    const meta = document.createElement('div');
    meta.className = 'file-item__meta';

    const nameEl = document.createElement('div');
    nameEl.className = 'file-item__name';
    nameEl.textContent = name;

    const details = document.createElement('div');
    details.className = 'file-item__details';
    const sizeEl = document.createElement('span');
    sizeEl.textContent = formatBytes(file.size);
    const typeEl = document.createElement('span');
    typeEl.textContent = file.type || 'unknown';
    details.append(sizeEl, typeEl);

    const status = document.createElement('div');
    status.className = 'file-item__status';
    status.textContent = errors.length ? 'Error' : 'Queued';

    const progress = document.createElement('div');
    progress.className = 'file-item__progress';

    const actions = document.createElement('div');
    actions.className = 'file-item__actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'file-item__button';
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';

    const retryBtn = document.createElement('button');
    retryBtn.className = 'file-item__button';
    retryBtn.type = 'button';
    retryBtn.textContent = 'Retry';
    retryBtn.hidden = true;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-item__button';
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';

    const errorText = document.createElement('div');
    errorText.className = 'file-item__error';
    errorText.hidden = !errors.length;
    errorText.textContent = errors.join('; ');

    actions.append(cancelBtn, retryBtn, removeBtn);
    meta.append(nameEl, details, status, progress, errorText);
    item.append(thumb, meta, actions);

    cancelBtn.addEventListener('click', () => cancelUpload(id));
    retryBtn.addEventListener('click', () => retryUpload(id));
    removeBtn.addEventListener('click', () => removeItem(id));

    return item;
  }

  function setStatus(id, state, message, progressValue) {
    const entry = items.get(id);
    if (!entry) return;
    entry.status = state;
    const { el } = entry;
    if (!el) return;
    el.dataset.status = state;

    const statusEl = el.querySelector('.file-item__status');
    if (statusEl) statusEl.textContent = message;

    const bar = el.querySelector('.file-item__progress');
    if (bar && typeof progressValue === 'number') {
      bar.style.setProperty('--progress', `${progressValue}%`);
    }

    const errorEl = el.querySelector('.file-item__error');
    if (errorEl) {
      errorEl.hidden = state !== 'error';
    }

    const retryBtn = el.querySelector('.file-item__button:nth-child(2)');
    const cancelBtn = el.querySelector('.file-item__button:nth-child(1)');
    if (retryBtn) retryBtn.hidden = state !== 'error';
    if (cancelBtn) cancelBtn.disabled = state !== 'uploading';
  }

  function startUpload(id) {
    const entry = items.get(id);
    if (!entry) return;

    const controller = new AbortController();
    entry.abort = controller;
    setStatus(id, 'uploading', 'Uploading…', 0);

    // If eventBus is present, we assume external handler drives progress/completion?
    // For now, if simulateUpload is active, we just run the animation locally.
    // Ideally, the external handler would send progress events back.
    if (!settings.simulateUpload) return;

    const start = performance.now();
    const duration = Math.max(800, settings.simulateDuration + Math.random() * 800);

    const tick = () => {
      if (controller.signal.aborted) return;
      const elapsed = performance.now() - start;
      const percent = Math.min(100, Math.round((elapsed / duration) * 100));
      setStatus(id, 'uploading', 'Uploading…', percent);
      if (percent >= 100) {
        setStatus(id, 'success', 'Completed', 100);
        entry.abort = null;
        return;
      }
      entry.raf = requestAnimationFrame(tick);
    };

    entry.raf = requestAnimationFrame(tick);
  }

  function cancelUpload(id) {
    const entry = items.get(id);
    if (!entry) return;
    if (entry.abort) {
      entry.abort.abort();
    }
    if (entry.raf) cancelAnimationFrame(entry.raf);
    setStatus(id, 'canceled', 'Canceled', 0);
  }

  function retryUpload(id) {
    const entry = items.get(id);
    if (!entry) return;
    if (entry.status === 'uploading') return;
    startUpload(id);
  }

  function removeItem(id) {
    const entry = items.get(id);
    if (!entry) return;
    if (entry.raf) cancelAnimationFrame(entry.raf);
    if (entry.abort) entry.abort.abort();
    const url = objectUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    entry.el?.remove();
    items.delete(id);
    objectUrls.delete(id);
    updateEmptyState();
  }

  function handleFiles(files) {
    if (!files?.length) return;
    addFiles(files);
  }

  dropzone?.addEventListener('click', () => input?.click());
  dropzone?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input?.click();
    }
  });

  input?.addEventListener('change', (e) => {
    const list = e.target.files;
    handleFiles(list);
    input.value = '';
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    setDropzoneState('dragging');
  });

  dropzone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    setDropzoneState('idle');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    setDropzoneState('idle');
    handleFiles(e.dataTransfer?.files);
  });

  // Prevent window-level navigation on drop of files
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) {
      e.preventDefault();
    }
  });

  updateEmptyState();

  return () => {
    items.forEach((entry, id) => {
      if (entry.raf) cancelAnimationFrame(entry.raf);
      if (entry.abort) entry.abort.abort();
      const url = objectUrls.get(id);
      if (url) URL.revokeObjectURL(url);
    });
    items.clear();
    objectUrls.clear();
    dropzone?.replaceWith(dropzone.cloneNode(true));
    input?.replaceWith(input.cloneNode(true));
  };
}

// Convenience for demos
export function initFileUploadDemo() {
  const root = document.querySelector('[data-component="file-upload"]');
  if (!root) return;
  initFileUpload(root, {
    maxSize: 12 * 1024 * 1024,
    maxFiles: 6,
    simulateUpload: true
  });
}
