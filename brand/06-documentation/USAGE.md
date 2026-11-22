# Brant brand assets | v1.0

## Approved brand components

- **Bird symbol:** exact path geometry retained from the previously selected symbol trace.
- **Brant wordmark:** capital **B**, custom lowercase **rant**. Five separate vector letter paths, all reused unchanged.
- **Primary lockup:** bird to the left of Brant.
- **Secondary lockup:** bird centered above Brant.
- **Symbol-only and wordmark-only** versions are provided independently.

## Color rules

| Role | Color |
|---|---|
| Brand black / near-black | `#0B0E0E` |
| White | `#FFFFFF` |
| Green background only | `#6CDDB5` |

Approved treatments: black logo on white, white logo on dark charcoal, black logo on mint green. **No green logo artwork** is included. Never recolor the head, body, neck gap, or a subset of the letters. The white gap is negative space, not a third color.

## Recommended placement

- Website header: `01-core/horizontal/brant-horizontal-black.svg` on light themes, corresponding white version on dark themes.
- Marketing layout where the composition is vertical: `01-core/vertical/...`.
- Social avatar / mobile app: square background icon under `04-app-icons` or `05-social`.
- Browser tab: `03-favicon/favicon.ico` plus the SVG favicon.
- Wordmark alone: `01-core/wordmark/`.
- Bird alone: `01-core/symbol/`.

The transparent SVGs are the most flexible master exports. All logo lettering is outlined. No runtime fonts and no raster images are embedded.

## Restrictions and status

- The original source was a raster-rendered image. The approved bird outline was traced in an earlier round; this package reuses the *same traced paths* precisely. It does not claim to recover an unknown original authoring file. At very large print sizes, inspect the tracing quality.
- The custom wordmark is reused verbatim from the chosen capital-B variant, not a typed font.
- The vertical arrangement is new **positioning** of the same original shapes; approve the proportions before institutional use.
- The brand has not been legally cleared by a trademark/similarity search.
- ICO, PNG, SVG and PWA assets were programmatically exported without generative image models.
- Future edits should be made to a single controlled master, not independently to exported files.
