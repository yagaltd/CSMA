import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { createRuntimeState, syncWindowRuntime } from '../src/runtime/bootstrap.js';
import { loadOptionalFeatures } from '../docs/legacy/features.js';
import { PermissionsUIService } from '../src/modules/permissions-ui/index.js';
import { ChartsService } from '../src/modules/charts/index.js';
import { AdminAuditLogService } from '../src/modules/admin-audit-log/index.js';
import { ImportExportService } from '../src/modules/import-export/index.js';
import { PermissionsUIContracts } from '../src/modules/permissions-ui/contracts/permissions-ui-contracts.js';
import { ChartsContracts } from '../src/modules/charts/contracts/charts-contracts.js';
import { AdminAuditLogContracts } from '../src/modules/admin-audit-log/contracts/admin-audit-log-contracts.js';
import { ImportExportContracts } from '../src/modules/import-export/contracts/import-export-contracts.js';

function bus(...moduleContracts) {
  const eventBus = new EventBus();
  eventBus.contracts = Object.assign({}, Contracts, ...moduleContracts);
  return eventBus;
}

describe('wave 3 frontend modules', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('permissions-ui tracks client capabilities without authorizing backend actions', async () => {
    const eventBus = bus(PermissionsUIContracts);
    const service = new PermissionsUIService(eventBus);
    service.init({ roles: ['admin'], capabilities: ['orders:view'], rules: [{ key: 'orders', roles: ['admin'], capabilities: ['orders:view'] }] });

    expect(service.check('orders')).toBe(true);
    service.applyState({ roles: ['viewer'], capabilities: [] });
    expect(service.check('orders')).toBe(false);
    const invalidResult = await eventBus.publish('INTENT_PERMISSIONS_UI_CHECK', { key: 'orders', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('charts registers adapters and stores chart datasets', async () => {
    const eventBus = bus(ChartsContracts);
    const service = new ChartsService(eventBus);
    service.init();
    service.registerAdapter({ id: 'svg', label: 'SVG' });
    service.setData('sales', { points: [{ x: 'Jan', y: 10 }] });

    expect(service.adapters.has('svg')).toBe(true);
    expect(service.getData('sales').points).toHaveLength(1);
    expect(service.formatNumber(1200)).toBe('1,200');
    const invalidResult = await eventBus.publish('INTENT_CHART_SET_DATA', { id: 'sales', extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('admin-audit-log filters and exports immutable audit display data', async () => {
    const eventBus = bus(AdminAuditLogContracts);
    const service = new AdminAuditLogService(eventBus);
    service.init({ entries: [
      { id: 'a1', actorId: 'u1', action: 'create', resource: 'order', severity: 'info' },
      { id: 'a2', actorId: 'u2', action: 'delete', resource: 'order', severity: 'warn' }
    ] });

    service.setFilters({ severity: 'warn' });
    const exported = service.export('csv');

    expect(service.getFilteredEntries()).toHaveLength(1);
    expect(exported.content).toContain('delete');
    const invalidResult = await eventBus.publish('INTENT_ADMIN_AUDIT_LOG_FILTER', { data: {}, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('import-export previews JSON/CSV client-side and prepares export payloads', async () => {
    const eventBus = bus(ImportExportContracts);
    const service = new ImportExportService(eventBus);
    service.init();

    const preview = service.previewImport({ type: 'json', content: '[{"id":"1"}]' });
    const exported = service.prepareExport([{ id: '1', name: 'Ada' }], 'csv');

    expect(preview.valid).toBe(true);
    expect(exported.content).toContain('Ada');
    const invalidResult = await eventBus.publish('INTENT_IMPORT_PREVIEW', { data: {}, extra: true, timestamp: Date.now() });
    expect(invalidResult).toEqual([]);
    service.destroy();
  });

  it('loads wave 3 modules only behind explicit feature flags', async () => {
    const state = createRuntimeState();
    syncWindowRuntime(state, { securityPolicy: { profile: 'development', globals: { exposeInternals: true } } });

    await loadOptionalFeatures(state, {
      FEATURES: { PERMISSIONS_UI: true, CHARTS_MODULE: true, ADMIN_AUDIT_LOG: true, IMPORT_EXPORT: true },
      runtimeConfig: {
        securityProfile: 'development',
        permissionsUi: { roles: ['admin'], capabilities: ['dashboard:view'] },
        charts: { datasets: [{ id: 'kpi', points: [{ x: 1, y: 2 }] }] },
        adminAuditLog: { entries: [{ id: 'audit-1', action: 'login' }] }
      }
    });

    expect(state.moduleManager.isModuleLoaded('permissions-ui')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('charts')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('admin-audit-log')).toBe(true);
    expect(state.moduleManager.isModuleLoaded('import-export')).toBe(true);
    expect(window.csma.charts.getData('kpi')).toBeTruthy();

    await state.moduleManager.destroy();
  });
});
