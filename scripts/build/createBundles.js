import fs from 'node:fs';
import path from 'node:path';

const BUNDLE_DIR = '_bundles';
const TRIGGERS = ['load', 'visible', 'idle'];

export function createTriggerBundles({ distRoot, manifest }) {
    const bundlesDir = path.join(distRoot, '_islands', BUNDLE_DIR);
    fs.rmSync(bundlesDir, { recursive: true, force: true });
    fs.mkdirSync(bundlesDir, { recursive: true });
    const bundles = TRIGGERS.reduce((acc, trigger) => {
        acc[trigger] = [];
        return acc;
    }, {});
    Object.values(manifest.routes || {}).forEach((route) => {
        (route.islands || []).forEach((island) => {
            const trigger = island.trigger || 'visible';
            if (bundles[trigger]) {
                bundles[trigger].push(island.id);
            }
        });
    });
    Object.entries(bundles).forEach(([trigger, ids]) => {
        const body = `export const islands = ${JSON.stringify(ids)};`;
        fs.writeFileSync(path.join(bundlesDir, `${trigger}.js`), body);
    });
    return bundles;
}
