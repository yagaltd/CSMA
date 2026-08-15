/**
 * Upload event payload and state-snapshot builders for FileUploadService.
 * Extracted verbatim from FileUploadService.js (Phase 6.5). Pure functions —
 * no service state — so payload shapes stay identical for every publisher.
 */
function clone(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
}

function toErrorMessage(error) {
    if (!error) return 'Unknown upload error';
    if (typeof error === 'string') return error;
    return error.message || String(error);
}

export function snapshot(session) {
    return {
        fileId: session.fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        fileType: session.fileType,
        status: session.status,
        attempts: session.attempts,
        loaded: session.loaded,
        total: session.total,
        progress: session.progress,
        chunkSize: session.chunkSize,
        resumable: session.resumable,
        uploadGrant: session.uploadGrant ? {
            grantId: session.uploadGrant.grantId,
            expiresAt: session.uploadGrant.expiresAt
        } : null,
        sourceRef: session.sourceRef,
        checkpoint: session.checkpoint ? clone(session.checkpoint) : null,
        error: session.error ? toErrorMessage(session.error) : null,
        reason: session.pauseReason || session.cancelReason || null,
        updatedAt: session.updatedAt,
        createdAt: session.createdAt
    };
}

export function snapshotFromCheckpoint(checkpoint) {
    return {
        fileId: checkpoint.fileId,
        fileName: checkpoint.fileName,
        fileSize: checkpoint.fileSize,
        fileType: checkpoint.fileType,
        status: checkpoint.status || 'paused',
        attempts: checkpoint.attempts || 0,
        loaded: checkpoint.loaded || 0,
        total: checkpoint.total || checkpoint.fileSize || 0,
        progress: checkpoint.progress || 0,
        chunkSize: checkpoint.chunkSize,
        resumable: true,
        sourceRef: checkpoint.sourceRef || null,
        checkpoint: clone(checkpoint),
        error: null,
        reason: null,
        updatedAt: checkpoint.updatedAt || Date.now(),
        createdAt: checkpoint.createdAt || checkpoint.updatedAt || Date.now()
    };
}

export function startedPayload(session) {
    return {
        fileId: session.fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        fileType: session.fileType,
        timestamp: Date.now()
    };
}

export function progressPayload(session) {
    return {
        fileId: session.fileId,
        progress: session.progress,
        loaded: session.loaded,
        total: session.total,
        timestamp: Date.now()
    };
}

export function completedPayload(session, result) {
    const payload = {
        fileId: session.fileId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        fileType: session.fileType,
        result: result || { uploaded: true },
        timestamp: Date.now()
    };

    if (session.previewUrl) {
        payload.previewUrl = session.previewUrl;
    }

    return payload;
}

export function failedPayload(session, error) {
    return {
        fileId: session.fileId,
        fileName: session.fileName,
        error: toErrorMessage(error),
        timestamp: Date.now()
    };
}

export function pausedPayload(session, reason) {
    return {
        fileId: session.fileId,
        progress: session.progress,
        loaded: session.loaded,
        total: session.total,
        timestamp: Date.now(),
        reason: reason || session.pauseReason || 'manual'
    };
}

export function resumedPayload(session, reason) {
    const payload = {
        fileId: session.fileId,
        progress: session.progress,
        loaded: session.loaded,
        total: session.total,
        timestamp: Date.now()
    };

    const value = reason || session.pauseReason;
    if (value) {
        payload.reason = value;
    }

    return payload;
}

export function cancelledPayload(session, reason) {
    return {
        fileId: session.fileId,
        timestamp: Date.now(),
        reason: reason || session.cancelReason || 'manual'
    };
}

