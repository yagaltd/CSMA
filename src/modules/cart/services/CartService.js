const STORAGE_KEY = 'csma.cart.v1';

export class CartService {
    constructor(eventBus) { this.eventBus = eventBus; this.items = new Map(); this.storage = null; this.validateEndpoint = null; this.fetcher = null; this.subscriptions = []; this.initialized = false; }
    init(options = {}) { if (this.initialized) return; this.initialized = true; this.storage = options.storage || globalThis.localStorage || null; this.validateEndpoint = options.validateEndpoint || options.endpoint || null; this.fetcher = options.fetcher || globalThis.fetch?.bind(globalThis); this.currency = options.currency || 'USD'; this.loadStored(); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_CART_ADD_ITEM', (p) => this.addItem(p.item || p.data))); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_CART_UPDATE_ITEM', (p) => this.updateItem(p.id, p.data || {}))); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_CART_CLEAR', () => this.clear())); this.publish(); }
    destroy() { this.initialized = false; this.subscriptions.splice(0).forEach((u) => u?.()); }
    addItem(item) { if (!item?.id) return false; const current = this.items.get(String(item.id)) || { ...item, quantity: 0 }; const quantity = Number(item.quantity || 1); this.items.set(String(item.id), { ...current, ...item, id: String(item.id), quantity: current.quantity + quantity }); this.persist(); this.publish(); return true; }
    updateItem(id, patch = {}) { if (!this.items.has(String(id))) return false; const next = { ...this.items.get(String(id)), ...patch, id: String(id) }; if (Number(next.quantity) <= 0) this.items.delete(String(id)); else this.items.set(String(id), next); this.persist(); this.publish(); return true; }
    removeItem(id) { const removed = this.items.delete(String(id)); if (removed) { this.persist(); this.eventBus?.publish?.('CART_ITEM_REMOVED', { id: String(id), timestamp: Date.now() }); this.publish(); } return removed; }
    clear() { this.items.clear(); this.persist(); this.publish(); }
    getItems() { return [...this.items.values()]; }
    async validate() { if (!this.validateEndpoint || !this.fetcher) return { ok: true, mode: 'local', summary: this.getSummary() }; const response = await this.fetcher(this.validateEndpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: this.getItems() }) }); if (!response.ok) throw new Error(`Cart validation failed with ${response.status}`); return response.json(); }
    getSummary() { const items = this.getItems(); return { count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), subtotal: items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0), currency: this.currency }; }
    persist() { try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.getItems())); } catch (error) { this.error(error); } }
    loadStored() { try { for (const item of JSON.parse(this.storage?.getItem(STORAGE_KEY) || '[]')) this.items.set(String(item.id), item); } catch { this.items.clear(); } }
    publish() { this.eventBus?.publish?.('CART_UPDATED', { items: this.getItems(), data: this.getSummary(), timestamp: Date.now() }); }
    error(error) { this.eventBus?.publish?.('CART_ERROR', { error: error?.message || String(error), timestamp: Date.now() }); }
}
