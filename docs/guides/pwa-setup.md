# PWA Setup Guide

## Overview

The CSMA starter template includes PWA (Progressive Web App) support for offline functionality and installability. However, **PWA icons must be generated** before the app can be installed.

## Current Status

✅ **Implemented**:
- Service Worker (`public/sw.js`)
- Web App Manifest (`public/manifest.json`)
- Offline fallback page (`public/offline.html`)

❌ **Missing**:
- PWA icon files (referenced in manifest.json but not generated)

## Quick Setup

### Option 1: Generate Icons Automatically (Recommended)

Use `pwa-asset-generator` to create all required icon sizes from a single source image:

```bash
# Install the generator
npm install -g pwa-asset-generator

# Create a source logo (512x512 PNG recommended)
# Place it at: public/logo.svg or public/logo.png

# Generate all icons
npx pwa-asset-generator public/logo.png public/icons \
  --icon-only \
  --favicon \
  --type png \
  --padding "10%"

# This creates:
# - public/icons/icon-72x72.png
# - public/icons/icon-96x96.png
# - public/icons/icon-128x128.png
# - public/icons/icon-144x144.png
# - public/icons/icon-152x152.png
# - public/icons/icon-192x192.png
# - public/icons/icon-384x384.png
# - public/icons/icon-512x512.png
```

### Option 2: Manual Creation

Create icons manually using your design tool:

**Required Sizes**:
- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

**Specifications**:
- Format: PNG
- Background: Solid color (matches your app theme)
- Padding: 10% safe area around logo
- Purpose: `any maskable` (works on all platforms)

Save all icons to: `public/icons/icon-{size}.png`

### Option 3: Use Placeholder Icons

For development/testing, create simple placeholder icons:

```bash
# Create icons directory
mkdir -p public/icons

# Use ImageMagick to create placeholders
for size in 72 96 128 144 152 192 384 512; do
  convert -size ${size}x${size} \
    -background "#007acc" \
    -fill white \
    -gravity center \
    -pointsize $((size/4)) \
    label:"CSMA" \
    public/icons/icon-${size}x${size}.png
done
```

## Verification

After generating icons, verify PWA setup:

1. **Build the app**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Open Chrome DevTools**:
   - Go to Application tab
   - Check "Manifest" section
   - Verify all icons load correctly

3. **Test Installation**:
   - Chrome: Look for install icon in address bar
   - Mobile: "Add to Home Screen" option should appear

## Customization

### Update Manifest Colors

Edit `public/manifest.json`:

```json
{
  "theme_color": "#007acc",        // Browser UI color
  "background_color": "#ffffff"    // Splash screen background
}
```

### Update Service Worker Cache

Edit `public/sw.js`:

```javascript
const CACHE_NAME = 'csma-v1';  // Increment version to force update
```

## Troubleshooting

### Icons Not Loading

1. Check file paths match manifest.json
2. Verify icons directory exists: `public/icons/`
3. Clear browser cache and hard reload
4. Check browser console for 404 errors

### PWA Not Installable

**Requirements**:
- ✅ HTTPS (or localhost for development)
- ✅ Valid manifest.json
- ✅ Service worker registered
- ✅ At least 192x192 and 512x512 icons
- ✅ Valid start_url

**Check**:
```bash
# Lighthouse PWA audit
npx lighthouse http://localhost:4173 --view
```

### Service Worker Not Updating

Force update:

```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
location.reload();
```

## Production Deployment

### Vercel / Netlify

PWA works automatically. Just ensure:
1. Icons are committed to git
2. Build command includes icon generation (if using script)

### Custom Server

Add headers for service worker:

```nginx
# nginx
location /sw.js {
  add_header Cache-Control "no-cache";
  add_header Service-Worker-Allowed "/";
}
```

## Disabling PWA

If you don't need PWA features:

1. **Disable in config**:
   ```javascript
   // src/config.js
   export const FEATURES = {
     PWA: false,  // Disable PWA
     // ...
   };
   ```

2. **Remove files** (optional):
   - `public/sw.js`
   - `public/manifest.json`
   - `public/offline.html`

## Resources

- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)

## Next Steps

After setting up icons:

1. ✅ Generate PWA icons
2. ✅ Test installation on mobile device
3. ✅ Run Lighthouse PWA audit
4. ✅ Customize manifest colors/name
5. ✅ Test offline functionality
