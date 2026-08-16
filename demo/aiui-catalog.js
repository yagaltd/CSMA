/**
 * aiui-catalog.js — generation-loop demo script.
 *
 * Mounts every core-owned catalog component through AIUIComposerService to
 * prove the compose half of the workflow end-to-end. Module surfaces are
 * listed (they require their owning module's service + ServiceManager; the
 * slides demo exercises that path).
 */
import { EventBus } from '../src/runtime/EventBus.js';
import { AIUIComposerService } from '../src/modules/ai-ui/services/AIUIComposerService.js';
import { componentCatalog } from '../src/modules/ai-ui/catalog/componentCatalog.js';

// Plain EventBus without the contracts registry: the composer's own publishes
// in a demo context stay permissive. Production apps attach Contracts.
const composer = new AIUIComposerService(new EventBus(), null);

/** Per-prop sensible values; anything not listed falls back to the entry id. */
const PROP_VALUES = {
    label: 'Label',
    title: 'Title',
    text: 'Text',
    description: 'Description',
    value: '4',
    variant: 'primary',
    size: 'md',
    tone: 'neutral',
    min: '0',
    max: '12',
    step: '1',
    type: 'text',
    placeholder: 'Placeholder'
};

/** Derive a valid props object from the entry's own propsSchema — compose()
 *  rejects unknown props, so samples must match each component's schema. */
function sampleProps(entry) {
    const schema = entry.propsSchema || {};
    const props = {};
    for (const key of Object.keys(schema)) {
        props[key] = key === 'name' ? entry.id : (PROP_VALUES[key] ?? entry.id);
    }
    return props;
}

function cardFrame(entry) {
    const frame = document.createElement('article');
    frame.className = 'catalog-card';

    const head = document.createElement('h3');
    head.className = 'catalog-card__title';
    head.textContent = `${entry.aiUi?.title || entry.id} (${entry.type})`;

    const meta = document.createElement('p');
    meta.className = 'catalog-card__meta';
    meta.textContent = entry.aiUi?.category || entry.owner;

    const stage = document.createElement('div');
    stage.className = 'catalog-card__stage';

    frame.append(head, meta, stage);
    return { frame, stage };
}

function mountCoreComponents() {
    const gallery = document.getElementById('core-gallery');
    const entries = Object.values(componentCatalog).filter((e) => e.owner === 'core');

    for (const entry of entries) {
        const { frame, stage } = cardFrame(entry);
        try {
            const fragment = composer.compose({
                component: entry.id,
                props: sampleProps(entry)
            });
            stage.appendChild(fragment);
        } catch (err) {
            // Teaching surface: schema/SAFE_TAGS failures render visibly.
            // (toast, for example, is a live-region service component, not a
            // static composition node — the error says exactly that.)
            const errEl = document.createElement('p');
            errEl.className = 'catalog-card__error';
            errEl.textContent = `compose: ${err.message}`;
            stage.appendChild(errEl);
        }
        gallery.appendChild(frame);
    }
    return entries.length;
}

function listModuleSurfaces() {
    const list = document.getElementById('surface-list');
    const surfaces = Object.values(componentCatalog).filter((e) => e.owner !== 'core');
    for (const entry of surfaces) {
        const li = document.createElement('li');
        const code = document.createElement('code');
        code.textContent = entry.id;
        const note = document.createElement('span');
        note.textContent = `: ${entry.aiUi?.summary || 'module surface'} (owner: ${entry.owner})`;
        li.append(code, note);
        list.appendChild(li);
    }
    if (!surfaces.length) {
        const li = document.createElement('li');
        li.textContent = 'No module surfaces registered.';
        list.appendChild(li);
    }
}

const coreCount = mountCoreComponents();
listModuleSurfaces();
document.querySelector('.catalog-header p').append(
    ` ${coreCount} core components mounted from the generated catalog.`
);
