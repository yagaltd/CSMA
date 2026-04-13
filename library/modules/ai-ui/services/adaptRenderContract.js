function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function adaptRenderContractToLegacyViewModel(contract) {
  if (!isObject(contract)) {
    throw new Error('Render contract must be an object.');
  }

  const targetNodes = contract.regions?.main || [];

  if (!Array.isArray(targetNodes) || targetNodes.length !== 1) {
    throw new Error(`Render contract page "${contract.page?.id || contract.id || 'unknown'}" must compile to a single root node in "main"`);
  }

  return {
    ok: true,
    layoutId: contract.layout.id,
    archetypeId: contract.page.contentArchetypeId,
    contentArchetypeId: contract.page.contentArchetypeId,
    viewId: contract.page.viewId,
    target: undefined,
    mode: 'replace',
    state: isObject(contract.activation?.initialState) ? { ...contract.activation.initialState } : {},
    layout: {
      id: contract.layout.id,
      regions: [...(contract.layout.regions || [])],
      rules: { ...(contract.layout.rules || {}) }
    },
    shell: {
      id: contract.layout.id,
      intro: {
        eyebrow: contract.layout.intro?.eyebrow || '',
        headline: contract.layout.intro?.headline || '',
        supportingText: contract.layout.intro?.supportingText || ''
      },
      regions: {
        hero: Array.isArray(contract.regions?.hero) ? contract.regions.hero : [],
        main: Array.isArray(contract.regions?.main) ? contract.regions.main : [],
        aside: Array.isArray(contract.regions?.aside) ? contract.regions.aside : []
      }
    },
    view: targetNodes[0],
    componentsUsed: [...(contract.componentsUsed || [])]
  };
}
