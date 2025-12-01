# 🧪 Post-Deploy Test Checklist

Run these tests after deploying to verify the fix works.

## 1. Worker Asset Test ⚡

**Check worker file is accessible:**

```bash
# Replace YOUR_DOMAIN with your actual domain
curl -I https://YOUR_DOMAIN/assets/pdf.worker.min.mjs

# OR if hashed filename:
# First, view page source and find the actual worker filename
# Then:
curl -I https://YOUR_DOMAIN/assets/pdf.worker.min-[HASH].mjs
```

**Expected Output:**
```
HTTP/2 200 
content-type: application/javascript
```

**❌ If you get 404:**
- Worker bundling failed
- Check vite build output
- Verify `?url` import in pdf-worker-setup.ts

## 2. No Server Endpoint Calls 🚫

**Verify no POST to /api/extract-images:**

```bash
# This should NOT be called anymore
# If you see this in Network tab, something is wrong
curl -v -F "pdf=@test.pdf" https://YOUR_DOMAIN/api/extract-images

# Expected: 404 (and app should NOT call this)
```

**✅ Correct behavior:**
- App does NOT make this request
- All extraction happens client-side
- No 404 errors in console

## 3. Browser Console Test 🖥️

**Open browser DevTools console and upload a PDF:**

**Expected logs:**
```javascript
✓ PDF.js worker URL set to: /assets/pdf.worker.min-[hash].mjs
✓ Worker mode: attempting with bundled worker
✓ PDF.js worker initialized successfully

// OR if worker fails but disableWorker succeeds:
⚠️ Worker mode failed: [error]
✓ PDF.js initialized successfully WITHOUT Web Worker (main thread mode)
```

## 4. Network Tab Test 🌐

**DevTools → Network tab while uploading PDF:**

**Should see:**
- ✅ `pdf.worker.min-[hash].mjs` → **200 OK** (or no request if disableWorker used)
- ✅ No requests to `/api/extract-images`
- ✅ No 404 errors
- ✅ No CDN requests

**Should NOT see:**
- ❌ 404 errors on worker file
- ❌ POST to `/api/extract-images`
- ❌ Requests to unpkg.com, cdnjs, jsdelivr, etc.

## 5. Problem PDF Test 📄

**Upload the PDF that previously caused "ALL_METHODS_FAILED":**

**Expected behavior:**
1. Shows upload zone
2. Shows processing view
3. Either:
   - ✅ **Success:** Shows image gallery
   - ✅ **Clear error:** Shows specific error with recommendations

**Download diagnostic and check:**
```json
{
  "attempts": [
    {"method": "worker_initialization", "success": true},
    {"method": "standard_load_with_worker", "success": true/false},
    // If worker failed:
    {"method": "standard_load_no_worker", "success": true, "disableWorker": true},
    {"method": "embedded_extraction", "success": true, "imageCount": N}
  ]
}
```

## 6. Quick Validation Script

**Run this in browser console after page loads:**

```javascript
// Check if worker URL is set
console.log('Worker URL:', pdfjsLib?.GlobalWorkerOptions?.workerSrc || 'NOT SET');

// Should output something like:
// Worker URL: /assets/pdf.worker.min-ABC123.mjs

// Check if worker file is accessible
fetch(pdfjsLib.GlobalWorkerOptions.workerSrc)
  .then(r => console.log('Worker status:', r.status, r.ok ? '✅' : '❌'))
  .catch(e => console.log('Worker error:', e));

// Should output:
// Worker status: 200 ✅
```

## ✅ Success Criteria

All of these should be true:

- [ ] Worker asset returns 200 (or disableWorker used successfully)
- [ ] No requests to `/api/extract-images`
- [ ] No 404 errors in console
- [ ] No CDN requests (unpkg, cdnjs, etc.)
- [ ] PDFs extract successfully or show clear error
- [ ] Diagnostic shows which method succeeded
- [ ] Console shows worker initialization message

## 🚨 If Tests Fail

### Worker 404
```bash
# Rebuild with clean cache
rm -rf dist node_modules/.vite
npm run build
npm run preview

# Check dist folder
ls -la dist/assets/pdf.worker*
```

### Worker loads but extraction fails
- Check console error messages
- Download diagnostic JSON
- Look for `disableWorker: true` in successful attempt
- If all methods fail, PDF may be corrupt

### Server endpoint called (should NOT happen)
- Check if old code is cached
- Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
- Clear browser cache
- Verify deployed version has latest code

## 📋 Quick Summary

```bash
# 1. Check worker
curl -I https://YOUR_DOMAIN/assets/pdf.worker.min.mjs
# → 200 ✅

# 2. Check no server calls in Network tab
# → No POST to /api/extract-images ✅

# 3. Upload PDF
# → Extracts successfully or shows clear error ✅

# 4. Check console
# → Worker initialized OR disableWorker succeeded ✅
```

---

**All tests passing = Fix is working! 🎉**
