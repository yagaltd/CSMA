/**
 * Checkpoint persistence adapter for FileUploadService.
 *
 * Extracted verbatim from FileUploadService.js (Phase 6.5). Owns every
 * backend I/O path for upload checkpoints: localStorage-style storage
 * (setItem/getItem/removeItem), IDB-style storage (init/update/add/get/
 * delete by store name), and the fileSystem staging store. Payload, key and
 * ref helpers are delegated back to the service, so behavior is unchanged.
 */
export class CheckpointPersistence {
    constructor(service) {
        this._service = service;
    }

    get storage() {
        return this._service.storage;
    }

    get fileSystem() {
        return this._service.fileSystem;
    }

    get options() {
        return this._service.options;
    }

    async init() {
        if (this._persistReady) {
            return this._persistReady;
        }

        this._persistReady = (async () => {
            if (this.storage?.init && !this.storage?.getItem) {
                try {
                    await this.storage.init({
                        [this.options.checkpointStore]: {
                            keyPath: 'fileId',
                            autoIncrement: false
                        }
                    });
                } catch {
                    // Best effort only.
                }
            }
        })();

        return this._persistReady;
    }

    async storeSource(session) {
        if (!this.fileSystem?.store || !session.file) {
            return null;
        }

        const sourceRef = this._service._sourceRef(session.fileId);
        try {
            const stored = await this.fileSystem.store(session.file, {
                id: sourceRef,
                title: session.fileName,
                category: 'file-upload',
                description: 'Upload source staging file',
                extra: {
                    fileId: session.fileId
                }
            });
            session.sourceRef = stored?.id || stored?.handle || sourceRef;
            return session.sourceRef;
        } catch {
            return null;
        }
    }

    async restoreSource(checkpoint) {
        if (checkpoint?.file) {
            return checkpoint.file;
        }

        const sourceRef = checkpoint?.sourceRef;
        if (!sourceRef || !this.fileSystem?.retrieve) {
            return null;
        }

        try {
            const result = await this.fileSystem.retrieve(sourceRef, { withMetadata: false });
            if (result?.file) {
                return result.file;
            }
            return result;
        } catch {
            return null;
        }
    }

    async persistCheckpoint(session) {
        const checkpoint = this._service._checkpointPayload(session);
        session.checkpoint = checkpoint;

        if (this.storage?.setItem) {
            try {
                this.storage.setItem(this._service._storageKey(session.fileId), JSON.stringify(checkpoint));
            } catch {
                // Best effort.
            }
        } else if (this.storage?.update || this.storage?.add) {
            try {
                if (this.storage.update) {
                    await this.storage.update(this.options.checkpointStore, checkpoint);
                } else {
                    await this.storage.add(this.options.checkpointStore, checkpoint);
                }
            } catch {
                // Best effort.
            }
        }

        if (this.fileSystem?.store) {
            try {
                const blob = new Blob([JSON.stringify(checkpoint)], { type: 'application/json' });
                await this.fileSystem.store(blob, {
                    id: this._service._checkpointRef(session.fileId),
                    title: `${session.fileName}.checkpoint.json`,
                    category: 'file-upload-checkpoint',
                    extra: {
                        fileId: session.fileId
                    }
                });
            } catch {
                // Best effort.
            }
        }
    }

    async readCheckpoint(fileId) {
        const inMemory = this._service._checkpointFromMemory(fileId);
        if (inMemory) {
            return inMemory;
        }

        if (this.storage?.getItem) {
            try {
                const raw = this.storage.getItem(this._service._storageKey(fileId));
                if (raw) {
                    return JSON.parse(raw);
                }
            } catch {
                // Best effort.
            }
        } else if (this.storage?.get) {
            try {
                const record = await this.storage.get(this.options.checkpointStore, fileId);
                if (record) {
                    return record;
                }
            } catch {
                // Best effort.
            }
        }

        if (this.fileSystem?.retrieve) {
            try {
                const result = await this.fileSystem.retrieve(this._service._checkpointRef(fileId), { withMetadata: false });
                if (!result) {
                    return null;
                }

                const text = await this._service._readText(result);
                return text ? JSON.parse(text) : null;
            } catch {
                return null;
            }
        }

        return null;
    }

    async clearCheckpoint(fileId) {
        const checkpoint = this._service._checkpointFromMemory(fileId);

        if (this.storage?.removeItem) {
            try {
                this.storage.removeItem(this._service._storageKey(fileId));
            } catch {
                // Best effort.
            }
        }

        if (this.storage?.delete) {
            try {
                await this.storage.delete(this.options.checkpointStore, fileId);
            } catch {
                // Best effort.
            }
        }

        if (this.fileSystem?.delete) {
            const refs = [this._service._checkpointRef(fileId), checkpoint?.sourceRef].filter(Boolean);
            for (const ref of refs) {
                try {
                    await this.fileSystem.delete(ref);
                } catch {
                    // Best effort.
                }
            }
        }
    }
}

