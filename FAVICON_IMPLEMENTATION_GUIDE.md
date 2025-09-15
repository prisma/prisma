# Favicon Implementation Guide for prisma.io

## Issue Context

This document addresses [GitHub Issue #28090](https://github.com/prisma/prisma/issues/28090) regarding the incorrect favicon display on https://prisma.io. Currently, the website shows the default Next.js favicon instead of the official Prisma logo.

## Problem Analysis

### Current Behavior
- Browser tabs display the default Next.js favicon (black "N" logo)
- Affects brand consistency and user experience
- Reported across multiple browsers (Chrome, Firefox, Safari)

### Expected Behavior
- Browser tabs should display the official Prisma logo
- Consistent branding across all Prisma web properties

## Technical Implementation

### 1. Favicon Assets Required

Create the following favicon files for optimal cross-platform support:

```
public/
├── favicon.ico                 # 32x32 ICO format (legacy browsers)
├── favicon.svg                 # Scalable SVG format (modern browsers)
├── favicon-light.ico           # Light theme variant
├── favicon-dark.ico            # Dark theme variant
├── icon-16x16.png             # 16x16 PNG format
├── icon-32x32.png             # 32x32 PNG format
├── icon-192x192.png           # 192x192 PNG format (Android)
├── icon-512x512.png           # 512x512 PNG format (Android)
├── apple-touch-icon.png       # 180x180 PNG format (iOS)
└── site.webmanifest           # Web app manifest
```

### 2. HTML Head Configuration

Add the following to the HTML `<head>` section (typically in `_document.tsx` for Next.js):

```html
<!-- Theme color -->
<meta name="theme-color" content="#2D3748">

<!-- SVG favicon for modern browsers -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg">

<!-- Standard favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">

<!-- Dark/Light mode support -->
<link rel="icon" href="/favicon-light.ico" media="(prefers-color-scheme: light)">
<link rel="icon" href="/favicon-dark.ico" media="(prefers-color-scheme: dark)">

<!-- PNG icons for modern browsers -->
<link rel="icon" type="image/png" sizes="16x16" href="/icon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/icon-32x32.png">

<!-- Apple Touch Icon -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<!-- Android Chrome icons -->
<link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png">

<!-- Windows tile support -->
<meta name="msapplication-TileImage" content="/icon-192x192.png">
<meta name="msapplication-TileColor" content="#2D3748">

<!-- Web App Manifest -->
<link rel="manifest" href="/site.webmanifest">
```

### 3. Next.js Implementation

For Next.js applications, implement in `pages/_document.tsx`:

```typescript
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Critical favicon preload for faster loading */}
        <link rel="preload" href="/favicon.ico" as="image" type="image/x-icon" />

        {/* Theme color with light/dark mode support */}
        <meta name="theme-color" content="#5A67D8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#2D3748" media="(prefers-color-scheme: dark)" />

        {/* SVG favicon for modern browsers */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

        {/* Standard favicon */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />

        {/* Dark/Light mode support */}
        <link rel="icon" href="/favicon-light.ico" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/favicon-dark.ico" media="(prefers-color-scheme: dark)" />

        {/* PNG icons for modern browsers */}
        <link rel="icon" type="image/png" sizes="16x16" href="/icon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32x32.png" />

        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Android Chrome icons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512x512.png" />

        {/* Windows tile support */}
        <meta name="msapplication-TileImage" content="/icon-192x192.png" />
        <meta name="msapplication-TileColor" content="#2D3748" />

        {/* Web App Manifest */}
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
```

### 4. Web App Manifest (site.webmanifest)

```json
{
  "name": "Prisma",
  "short_name": "Prisma",
  "description": "Next-generation Node.js and TypeScript ORM",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "theme_color": "#2D3748",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

## Testing & Validation

### 1. Pre-deployment Testing
1. **Clear browser cache completely**
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: History → Clear Recent History
   - Safari: Develop → Empty Caches
2. **Test in incognito/private browsing mode**
3. **Verify across browsers**: Chrome, Firefox, Safari, Edge
4. **Test on mobile devices**: iOS Safari, Android Chrome
5. **Validate PWA manifest** using Chrome DevTools → Application → Manifest

### 2. Cross-Platform Validation
Test favicon display across:
- **Desktop**: Chrome, Firefox, Safari, Edge (Windows, macOS, Linux)
- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Operating Systems**: Windows (check Windows tile), macOS, iOS, Android
- **Screen Densities**: Standard, Retina, high-DPI displays

### 3. Comprehensive Testing Steps
1. **Clear browser cache and hard refresh** (Ctrl+F5 / Cmd+Shift+R)
2. **Open https://prisma.io in new tab**
3. **Verify Prisma logo appears in browser tab**
4. **Test bookmarking** - check favicon in bookmarks bar
5. **Test "Add to Home Screen"** on mobile devices
6. **Validate in private/incognito mode**
7. **Check dark/light mode switching** (if implemented)

### 4. Network Verification
- **Check Network tab** in browser DevTools
- **Verify favicon requests return 200 status**
- **Confirm correct MIME types** are served
- **Test favicon loading speed** (should be < 100ms)
- **Validate with online favicon checkers**

### 5. Post-deployment Validation
1. **Check favicon display in browser tabs**
2. **Verify bookmarks show correct icon**
3. **Test "Add to Home Screen" functionality**
4. **Validate with favicon checkers** online
5. **Monitor for 404 errors** in favicon requests

## Implementation Checklist

- [ ] Create favicon assets in all required sizes
- [ ] Add favicon files to public directory
- [ ] Update HTML head configuration
- [ ] Create/update web app manifest
- [ ] Test across multiple browsers
- [ ] Validate on mobile devices
- [ ] Deploy to production
- [ ] Clear CDN cache if applicable

## Cache Management & Performance

### 1. Next.js Cache Configuration

Add to `next.config.js` for proper favicon caching:

```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/(favicon.*|icon-.*|apple-touch-icon.*|site.webmanifest)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};
```

### 2. Cache Busting Strategy

For version control, consider:
```html
<!-- Version-based cache busting -->
<link rel="icon" type="image/x-icon" href="/favicon.ico?v=1.0.0">

<!-- Build hash-based cache busting -->
<link rel="icon" type="image/x-icon" href="/favicon.[hash].ico">
```

### 3. Performance Optimization

1. **File Size Optimization**:
   - Compress PNG files using tools like TinyPNG
   - Optimize SVG files by removing unnecessary elements
   - Keep favicon.ico under 15KB for fast loading

2. **Loading Strategy**:
   - Place favicon links early in `<head>` section
   - Use preload for critical favicon files
   - Consider lazy loading for non-critical sizes

## Notes for Implementation

1. **Asset Creation**: Use the official Prisma logo from the brand guidelines
2. **File Optimization**: Optimize PNG files for web delivery (use TinyPNG, ImageOptim)
3. **SVG Optimization**: Remove unnecessary SVG elements and attributes
4. **Cache Busting**: Use version parameters or build-time hash generation
5. **CDN Configuration**: Ensure CDN serves favicon files with appropriate headers
6. **Monitoring**: Set up monitoring to detect favicon loading issues
7. **Performance**: Keep total favicon assets under 50KB combined
8. **Accessibility**: Ensure sufficient contrast for favicon visibility

## Repository Context

**Important**: This guide is created for the prisma.io website team. The favicon issue affects the main website (https://prisma.io), but the website code is maintained separately from this ORM repository. This documentation should be shared with the appropriate team responsible for the website infrastructure.

## Related Resources

- [Favicon Generator Tools](https://realfavicongenerator.net/)
- [Web App Manifest Documentation](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Next.js Custom Document](https://nextjs.org/docs/advanced-features/custom-document)
- [Prisma Brand Guidelines](https://github.com/prisma/presskit)