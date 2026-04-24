export function createFileUploadList(service, options = {}) {
    const root = options.root || document;
    const list = root.createElement('ul');
    list.className = 'file-upload-list';
    list.dataset.fileUploadList = 'true';

    const state = typeof service?.getState === 'function' ? service.getState() : { uploads: [] };
    const uploads = Array.isArray(state?.uploads) ? state.uploads : [];

    if (uploads.length === 0) {
        const empty = root.createElement('li');
        empty.className = 'file-upload-list__empty';
        empty.textContent = options.emptyLabel || 'No uploads yet';
        list.appendChild(empty);
        return list;
    }

    uploads.forEach((upload) => {
        const item = root.createElement('li');
        item.className = 'file-upload-list__item';
        item.dataset.fileId = upload.fileId;

        const name = root.createElement('span');
        name.className = 'file-upload-list__name';
        name.textContent = upload.fileName || upload.fileId;

        const status = root.createElement('span');
        status.className = 'file-upload-list__status';
        status.textContent = `${upload.status} ${upload.progress ?? 0}%`;

        item.appendChild(name);
        item.appendChild(status);
        list.appendChild(item);
    });

    return list;
}

