import { uid } from '../../../utils/id.js';

export function createRequestId(prefix = 'ai') {
    return uid(prefix);
}
