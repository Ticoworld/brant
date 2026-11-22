# Brant brand identity

This is the canonical brand asset library for Brant.

## Approved design

- Bird-inspired mark: the selected two-piece silhouette and curved neck gap
- Wordmark: the selected custom **Brant** lettering with capital B
- Configurations: horizontal (primary), vertical (secondary), symbol-only, and wordmark-only
- Foreground: charcoal `#0B0E0E` or white `#FFFFFF` only
- Approved backgrounds: white, charcoal, or Brant mint `#6CDDB5`
- **No mint-colored logo foreground**
- Preferred masters: the editable `01-core/**/*.svg` paths
- Raster PNG exports are derived from those paths

The favicon, app icon and avatar files derive from the same bird mark. Original exports, background applications and guidelines are grouped by numbered folders. See `06-documentation/USAGE.md` and `06-documentation/ASSET-MANIFEST.json`.

## Application-ready subset

Selected runtime files are copied to `apps/trade-testnet/public/brand/`. A Next.js app can serve them from `/brand/...`. This assets-only commit **does not yet replace** existing site logos, metadata, favicons, or other UI code.

## Master quality boundary

The SVG bird paths were traced from the selected raster image. They are editable vectors, but final print-master approval still requires manual curve cleanup and small-size inspection. This is not evidence of trademark clearance.
