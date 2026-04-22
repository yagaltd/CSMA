function collectStructuredDataTypes(value, bucket) {
    if (Array.isArray(value)) {
        value.forEach((entry) => collectStructuredDataTypes(entry, bucket));
        return;
    }

    if (!value || typeof value !== 'object') {
        return;
    }

    if (typeof value['@type'] === 'string') {
        bucket.add(value['@type']);
    } else if (Array.isArray(value['@type'])) {
        value['@type'].filter((entry) => typeof entry === 'string').forEach((entry) => bucket.add(entry));
    }

    Object.values(value).forEach((entry) => collectStructuredDataTypes(entry, bucket));
}

export function auditPage() {
    const description = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || undefined;
    const structuredDataTypes = new Set();

    document.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
        try {
            collectStructuredDataTypes(JSON.parse(node.textContent || 'null'), structuredDataTypes);
        } catch {
            // Ignore invalid JSON-LD blocks.
        }
    });

    return {
        titleLength: document.title.length,
        hasDescription: Boolean(description),
        hasOgImage: Boolean(ogImage),
        ...(canonicalUrl ? { canonicalUrl } : {}),
        h1Count: document.querySelectorAll('h1').length,
        structuredDataTypes: Array.from(structuredDataTypes)
    };
}
