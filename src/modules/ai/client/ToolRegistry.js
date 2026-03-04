export class ToolRegistry {
    constructor(initialTools = []) {
        this.tools = new Map();
        initialTools.forEach((tool) => this.addTool(tool));
    }

    addTool(tool) {
        if (!tool || typeof tool.name !== 'string' || typeof tool.execute !== 'function') {
            throw new Error('Invalid tool definition. Expected { name, execute }');
        }
        this.tools.set(tool.name, tool);
        return tool.name;
    }

    removeTool(name) {
        this.tools.delete(name);
    }

    getTool(name) {
        return this.tools.get(name);
    }

    listTools() {
        return Array.from(this.tools.keys());
    }

    async execute(name, params = {}) {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool "${name}" is not registered`);
        }
        const result = await tool.execute(params);
        return result;
    }
}
