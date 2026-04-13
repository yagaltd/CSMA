export class FallbackStorage {
    constructor(metadataStore) {
        this.metadataStore = metadataStore;
        this.type = 'indexeddb';
    }

    async init() {
        if (typeof this.metadataStore.enableBlobStore === 'function') {
            await this.metadataStore.enableBlobStore();
        }
    }

    async write(id, blob) {
        await this.metadataStore.saveBlob(id, blob);
        return { path: `indexeddb://${id}` };
    }

    async read(id) {
        const blob = await this.metadataStore.getBlob(id);
        if (!blob) {
            throw new Error('File blob not found');
        }
        return blob;
    }

    async delete(id) {
        await this.metadataStore.deleteBlob(id);
    }

    async createReadStream(id) {
        const blob = await this.read(id);
        return blob.stream ? blob.stream() : this._toReadable(blob);
    }

    reference(id) {
        return `indexeddb://${id}`;
    }

    _toReadable(blob) {
        if (typeof ReadableStream !== 'undefined') {
            return new ReadableStream({
                start(controller) {
                    controller.enqueue(blob);
                    controller.close();
                }
            });
        }
        return null;
    }
}
