# Browser and PWA usage

Copy the favicon and app assets to `/brand/` on your deployed site, then adjust paths as needed.

```html
<link rel="icon" type="image/svg+xml" href="/brand/favicon.svg">
<link rel="icon" type="image/x-icon" href="/brand/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/brand/apple-touch-icon.png">
<link rel="manifest" href="/brand/site.webmanifest">
```

Use the manifest below, placing `icon-192.png`, `icon-512.png` and `icon-maskable-512.png` beside it. Do not replace an existing app manifest blindly, merge the icons into your existing manifest.

`purpose: maskable` icons deliberately use a smaller bird so that phone launchers can crop them safely.
