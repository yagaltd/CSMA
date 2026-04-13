/**
 * AIProvider - Abstract base class for all AI providers
 * 
 * Adapted from voice-note-app AIProvider.js
 * See enhancement-plan.md section 6.8 for full architecture
 */

export class AIProvider {
  constructor() {
    this.name = this.constructor.name;
  }

  /**
   * Check if this provider is available for use
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error(`${this.name}.isAvailable() not implemented`);
  }

  /**
   * Get provider priority (higher = preferred)
   * Local providers should have priority 100
   * Cloud providers should have priority 50
   * @returns {number}
   */
  get priority() {
    return 50;
  }

  /**
   * Get capabilities supported by this provider
   * @returns {Object} { transcribe: boolean, ocr: boolean, classify: boolean, summarize: boolean, generateText: boolean }
   */
  getCapabilities() {
    throw new Error(`${this.name}.getCapabilities() not implemented`);
  }

  /**
   * Initialize the provider (load models, etc.)
   * Optional - only implement if needed
   */
  async init() {
    // Optional initialization
  }

  /**
   * Generate text (core method)
   * @param {Object} params - { system, prompt, maxTokens, temperature, stream }
   * @returns {Promise<Object>} { text, tokensUsed, provider }
   */
  async generateText(params) {
    throw new Error(`${this.name}.generateText() not implemented`);
  }
}
