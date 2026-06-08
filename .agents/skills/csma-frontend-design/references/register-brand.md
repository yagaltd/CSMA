# Brand register

Design IS the product: brand sites, landing pages, marketing surfaces, campaign
pages, portfolios, long-form content, about pages. The deliverable is the
design itself; a visitor's impression is the thing being made.

Loaded when `DESIGN.md` front matter has `register: brand`.

---

## Stance

Brand surfaces communicate first, transact second. A visitor's emotional
response is the metric. Restraint without intent now reads as mediocre, not
refined. Brand surfaces need a POV, a specific audience, a willingness to risk
strangeness.

## Font selection procedure

Every project. Never skip.

1. **Write three concrete brand-voice words.** Not "modern" or "elegant" — but
   "warm and mechanical and opinionated" or "calm and clinical and careful."
   Physical-object words.
2. **List the three fonts you'd reach for by reflex.** If any appear in the
   reflex-reject list below, reject them — they are training-data defaults
   that create monoculture.
3. **Browse a real catalog.** Google Fonts, Pangram Pangram, Future Fonts,
   Adobe Fonts, ABC Dinamo, Klim, Velvetyne. Find the font for the brand as
   a *physical object*: a museum caption, a 1970s terminal manual, a fabric
   label, a concert poster. Reject the first thing that "looks designy."
4. **Cross-check.** "Elegant" is not necessarily serif. "Technical" is not
   necessarily sans. If the final pick lines up with the original reflex,
   start over.

### Reflex-reject font list

Training-data defaults. Do not reach for these by default unless the brand
already uses them:

Fraunces · Newsreader · Lora · Crimson Pro · Crimson Text · Playfair Display ·
Cormorant Garamond · Syne · IBM Plex Sans · IBM Plex Serif · IBM Plex Mono ·
Space Mono · Space Grotesk · Inter · DM Sans · DM Serif Display ·
DM Serif Text · Outfit · Plus Jakarta Sans · Instrument Sans · Instrument Serif

### Pairing and voice

Distinctive + refined is the goal. The specific shape depends on the brand,
not on the brand's category. A category ("restaurant", "dev tool", "magazine")
is not a recipe.

Two families minimum is the rule *only* when the voice needs it. A single
well-chosen family with committed weight/size contrast is stronger than a
timid display+body pair.

### Scale

Modular scale, fluid `clamp()` for headings, ≥1.25 ratio between steps.

---

## Color

Brand surfaces have permission for Committed, Full palette, and Drenched
strategies. Use them. A single saturated color spread across a hero is not
excess — it's voice. A beige-and-muted-slate landing page ignores the register.

- Name a real reference before picking a strategy. "Klim orange drench",
  "Stripe purple-on-white restraint", "Liquid Death acid-green full palette".
  Unnamed ambition becomes beige.
- When the strategy is Committed or Drenched, color carries the brand. Don't
  hedge with neutrals around the edges.
- Don't converge across projects. If the last brand surface was restrained
  on cream, this one is not.

---

## Imagery

Brand surfaces lean on imagery. A restaurant, hotel, magazine, or product
landing page without any imagery reads as incomplete, not as restrained.

**When the brief implies imagery (restaurants, hotels, food, travel, fashion,
product, photography), you must ship imagery.** Zero images is a bug, not a
design choice. "Restraint" is not an excuse.

For greenfield work without local assets, use stock photography via Unsplash
(`https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1600&q=80`).
**Verify the URLs resolve before referencing them.**

One decisive photo beats five mediocre ones. Alt text is part of the voice.

---

## Brand-specific bans

| Anti-pattern | Why |
|-------------|-----|
| Monospace as lazy "technical" shorthand | If the brand isn't technical, mono reads as costume |
| Large rounded-corner icons above every heading | Screams template |
| Single-family pages picked by reflex, not voice | A single family chosen deliberately is fine; a reflex pick is not |
| Zero imagery on brief that implies imagery | Colored blocks where a hero photo belongs = incomplete |
| Defaulting to editorial-magazine aesthetics | Display serif + italic + drop caps + broadsheet grid on non-editorial briefs |
| Timid palettes and average layouts | Safe = invisible on brand surfaces |
| Repeated tiny uppercase tracked labels above every section | A single strong kicker can be voice; repeating it as section grammar is AI scaffolding |
