export function createFileUploadDropZone(service, options = {}) {
    const root = options.root || document;
    const zone = root.createElement('section');
    zone.className = 'file-upload-drop-zone';
    zone.dataset.fileUploadDropZone = 'true';
    zone.dataset.dragOver = 'false';

    const title = root.createElement('h2');
    title.className = 'file-upload-drop-zone__title';
    title.textContent = options.title || 'Drop files here';

    const description = root.createElement('p');
    description.className = 'file-upload-drop-zone__description';
    description.textContent = options.description || 'Choose files or drag them onto this area.';

    const input = root.createElement('input');
    input.type = 'file';
    input.multiple = options.multiple !== false;
    if (options.accept) {
        input.accept = options.accept;
    }
    input.hidden = true;

    const button = root.createElement('button');
    button.className = 'file-upload-drop-zone__button';
    button.type = 'button';
    button.textContent = options.buttonLabel || 'Choose files';

    const handleFiles = async (files) => {
        if (!service?.uploadFiles && !service?.uploadFile) {
            return;
        }
        const list = Array.from(files || []);
        if (list.length === 0) {
            return;
        }
        if (list.length === 1 && service.uploadFile) {
            return service.uploadFile(list[0], options.uploadOptions || {});
        }
        if (service.uploadFiles) {
            return service.uploadFiles(list, options.uploadOptions || {});
        }
        return Promise.all(list.map((file) => service.uploadFile(file, options.uploadOptions || {})));
    };

    button.addEventListener('click', () => input.click());
    input.addEventListener('change', () => handleFiles(input.files));
    zone.addEventListener('dragenter', (event) => {
        event.preventDefault();
        zone.dataset.dragOver = 'true';
    });
    zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.dataset.dragOver = 'true';
    });
    zone.addEventListener('dragleave', (event) => {
        if (!zone.contains(event.relatedTarget)) {
            zone.dataset.dragOver = 'false';
        }
    });
    zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.dataset.dragOver = 'false';
        handleFiles(event.dataTransfer?.files);
    });

    zone.appendChild(title);
    zone.appendChild(description);
    zone.appendChild(button);
    zone.appendChild(input);

    return zone;
}
