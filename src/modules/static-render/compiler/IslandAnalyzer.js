export class IslandAnalyzer {
  constructor(options = {}) {
    this.defaultTrigger = options.defaultTrigger || 'visible';
  }

  classify({ route, html }) {
    if (typeof html !== 'string') {
      throw new TypeError('[IslandAnalyzer] html must be a string');
    }

    const type = this.#detectType(html);
    const islands = type === 'island' ? this.#extractIslands(html) : [];

    return {
      route,
      generatedAt: Date.now(),
      type,
      islands,
      islandCount: islands.length
    };
  }

  #detectType(html) {
    if (html.includes('data-dynamic')) {
      return 'dynamic';
    }
    if (html.includes('data-island')) {
      return 'island';
    }
    return 'static';
  }

  #extractIslands(html) {
    const islands = [];
    const islandRegex = /<[^>]+data-island="([^"]+)"[^>]*>/gi;
    let match;

    while ((match = islandRegex.exec(html)) !== null) {
      const rawTag = match[0];
      const islandId = match[1];
      islands.push({
        id: islandId,
        contract: this.#getAttr(rawTag, 'data-contract') || null,
        trigger: this.#getAttr(rawTag, 'data-trigger') || this.defaultTrigger,
        parameters: this.#collectDataset(rawTag),
        marker: rawTag
      });
    }

    return islands;
  }

  #collectDataset(tag) {
    const dataset = {};
    const dataAttrRegex = /(data-[a-z0-9-]+)="([^"]*)"/gi;
    let match;

    while ((match = dataAttrRegex.exec(tag)) !== null) {
      const [name, value] = [match[1], match[2]];
      if (name === 'data-island' || name === 'data-contract' || name === 'data-trigger') {
        continue;
      }
      const normalized = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      dataset[normalized] = value;
    }

    return dataset;
  }

  #getAttr(tag, attr) {
    const regex = new RegExp(`${attr}="([^"]+)"`, 'i');
    const match = tag.match(regex);
    return match ? match[1] : null;
  }
}

export default IslandAnalyzer;
