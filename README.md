# PDF Image Extractor

A powerful, client-side PDF image extraction tool built with React, TypeScript, and PDF.js.

## ✨ Features

- 🖼️ **Extract embedded images** from PDF documents
- 📄 **Rasterize pages** to high-quality images when no embedded images exist
- 🔄 **Multiple fallback strategies** for maximum compatibility
- 📊 **Detailed diagnostics** for troubleshooting
- 🎨 **Beautiful UI** with smooth animations
- 💾 **Download images** individually or as a ZIP file
- 📱 **Responsive design** works on desktop and mobile
- 🚀 **100% client-side** - no server required, no data upload

## 🎯 Recent Fixes (Emergency Update)

### ✅ ALL_METHODS_FAILED Fixed

**Problems solved:**
- ❌ Worker file 404 errors
- ❌ Server endpoint 404 errors  
- ❌ CDN dependencies
- ❌ No fallback strategies

**Solutions implemented:**
- ✅ Worker bundled locally via Vite
- ✅ Automatic `disableWorker` fallback
- ✅ No server dependencies
- ✅ 6-step fallback chain
- ✅ Clear diagnostic information

See [EMERGENCY_FIX_COMPLETE.md](./EMERGENCY_FIX_COMPLETE.md) for details.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🧪 Testing After Deploy

See [POST_DEPLOY_TESTS.md](./POST_DEPLOY_TESTS.md) for comprehensive testing checklist.

**Quick verification:**
```bash
# Check worker file is accessible
curl -I https://YOUR_DOMAIN/assets/pdf.worker.min.mjs
# Expected: HTTP/2 200
```

## 📚 Documentation

- **[EMERGENCY_FIX_COMPLETE.md](./EMERGENCY_FIX_COMPLETE.md)** - Latest fix summary
- **[WORKER_BUNDLE_FIX.md](./WORKER_BUNDLE_FIX.md)** - Technical implementation details
- **[POST_DEPLOY_TESTS.md](./POST_DEPLOY_TESTS.md)** - Testing checklist
- **[PRD.md](./PRD.md)** - Product requirements document

## 🏗️ Architecture

### Client-Side Processing Only

All PDF processing happens in the browser:
- PDF.js with bundled Web Worker
- Automatic fallback to main thread if worker fails
- No data sent to servers
- Complete privacy

### Fallback Chain

1. Try with Web Worker (fastest)
2. Try with worker + error recovery
3. Try with worker + ignore errors
4. **Fallback to main thread** (disableWorker: true)
5. Main thread + error recovery
6. Main thread + minimal config

### Extraction Methods

1. **Embedded extraction** - Extract actual images from PDF
2. **Rasterization** - Render pages as images at high DPI

## 🎨 Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **PDF.js** - PDF parsing and rendering
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **shadcn/ui** - UI components
- **JSZip** - ZIP file generation

## 🛠️ Development

### Project Structure

```
src/
├── components/         # React components
│   ├── Hero.tsx       # Landing page
│   ├── UploadZone.tsx # File upload
│   ├── ProcessingView.tsx # Progress indicator
│   ├── ImageGallery.tsx   # Results display
│   └── ErrorView.tsx      # Error handling
├── lib/               # Core logic
│   ├── pdf-worker-setup.ts   # Worker bundling
│   ├── pdf-extractor.ts      # Main extraction logic
│   └── zip-generator.ts      # ZIP creation
└── index.css          # Theme and styles
```

### Key Files

- **`src/lib/pdf-worker-setup.ts`** - Bundles worker via Vite `?url` import
- **`src/lib/pdf-extractor.ts`** - Main extraction logic with fallbacks
- **`vite.config.ts`** - Worker bundling configuration

## 🐛 Troubleshooting

### Worker 404 Error

```bash
# Rebuild with clean cache
rm -rf dist node_modules/.vite
npm run build
```

### CSP Issues

Add to your hosting config:
```
Content-Security-Policy: 
  script-src 'self'; 
  worker-src 'self' blob:;
```

### Extraction Fails

1. Check browser console for errors
2. Download diagnostic JSON from error screen
3. Look for which methods were attempted
4. Try opening PDF in Adobe Reader and "Save As" to create clean copy

## 📝 License

The Spark Template files and resources from GitHub are licensed under the terms of the MIT license, Copyright GitHub, Inc.

## 🎉 Status

✅ **Ready for production**
- Worker bundling: ✅ Active
- DisableWorker fallback: ✅ Active  
- Server dependencies: ✅ Removed
- Error handling: ✅ Comprehensive
- Diagnostics: ✅ Detailed
