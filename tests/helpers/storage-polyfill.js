const createStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
};

if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createStorage();
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorage();
}
