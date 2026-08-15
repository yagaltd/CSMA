/**
 * CSMA UI Initialization
 *
 * Initializes starter components with EventBus integration.
 *
 * Component Types:
 * - Type I (Pure CSS): No JavaScript (Badge)
 * - Type II (EventBus-driven): Component manages its own state via EventBus
 *   Exports: init[Component]System(eventBus) -> cleanupFunction
 *   Example: Toast
 *
 * To add a new component:
 * 1. Import its init function below
 * 2. Call it in initUI() and push the cleanup
 */

import { initToastSystem } from './components/toast/toast.js';
import { initCountUpSystem } from './components/count-up/count-up.js';

export function initUI(eventBus) {
  if (!eventBus) return () => {};

  const cleanups = [];

  // Type II: Toast — EventBus-driven notifications
  cleanups.push(initToastSystem(eventBus));

  // Type II: Count Up — viewport-triggered number animation
  cleanups.push(initCountUpSystem(eventBus));

  // Add your component init functions here:
  // cleanups.push(initYourComponent(eventBus));

  return () => cleanups.splice(0).reverse().forEach(fn => fn());
}
