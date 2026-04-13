export function extractBasicMetadata(file) {
    return {
        width: file?.width || null,
        height: file?.height || null,
        createdAt: Date.now()
    };
}
