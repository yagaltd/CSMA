// demo/slides-config.js — classic script externalized from demo/slides.html
// so the page can ship a strict CSP (script-src 'self'). Content moved verbatim.
// Classic script keeps its synchronous, in-place execution so __DECK_CONFIG__
// is set before the module bootstrap runs.

window.__DECK_CONFIG__ = {
  title: 'CSMA Slides - Demo',
  theme: { mode: 'dark' },
  slides: [
    { type: 'cover', kicker: 'Demo Deck', title: 'CSMA Slides',
      subtitle: 'A headless presentation engine for CSMA apps.',
      foot: 'Wave 2-E' },
    { type: 'big-number', kicker: 'One headline',
      value: { number: 24, suffix: '' },
      caption: 'layout factories ship in v1.',
      foot: 'See SKILL.md §3 for the selection rules.' },
    { type: 'stat-grid', kicker: 'Traction', title: 'By the numbers.',
      stats: [
        { value: { number: 842, suffix: '' }, label: 'Tests passing', caption: 'baseline + slides' },
        { value: { number: 0, suffix: '' }, label: 'New npm deps', caption: 'pure vanilla JS' },
        { value: { number: 100, suffix: '%' }, label: 'Token-driven CSS', caption: 'no raw values' }
      ] },
    { type: 'steps', kicker: 'How it works', title: 'Three steps to a deck.',
      items: [
        { title: 'Author', body: 'Write a single deck.json with one slide object per slide.' },
        { title: 'Theme', body: 'Patch tokens via token-overrides.json. The slides module reads them.' },
        { title: 'Present', body: 'Set window.__DECK_CONFIG__ and call mountDeck.' }
      ] },
    { type: 'quote', text: 'Reactive UI without a framework, a security boundary without a backend.',
      name: 'CSMA manifesto', role: 'architecture skill' },
    { type: 'comparison', kicker: 'Why this exists', title: 'Slides vs. bolt-slides.',
      cols: ['', 'CSMA Slides', 'bolt-slides'],
      highlight: 1,
      rows: [
        { label: 'Framework', values: ['Vanilla JS', 'React'] },
        { label: 'Animation', values: ['CSS + data-*', 'framer-motion'] },
        { label: 'Sync', values: ['CrossTabLeader', 'custom BroadcastChannel'] },
        { label: 'Security', values: [true, false] }
      ] },
    { type: 'cta', title: 'Ship a deck.', subtitle: 'Read SKILL.md → write deck.json → mountDeck' },
    { type: 'split',
      kicker: 'Phase 4',
      title: 'Comments on every slide',
      body: 'Click the 💬 button in the dock to open the comments drawer for the current slide. The badge shows the open-count. Add a comment, resolve it, or reply. Anchored elements get a pin marker — click a pin to focus + open a popup.'
      /* drawer + badge + markers wired in the bootstrap below */ }
  ]
};
