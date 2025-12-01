# Testing Guide - PDF Image Extractor

## Quick Test Commands

### 1. Check Worker Asset (after deployment)

```bash
# Should return 200 OK
curl -I https://your-app-url/assets/pdf.worker.min-*.mjs
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: application/javascript
```

### 2. Test Server Endpoint with Valid PDF

```bash
curl -X POST https://your-app-url/api/extract-images \
  -F "pdf=@test-document.pdf" \
  -F "sessionId=test-session-123" \
  | jq
```

**Expected Response:**
```json
{
  "success": true,
  "images": [
    {
      "data": "data:image/png;base64,...",
      "format": "png",
      "width": 1224,
      "height": 1632,
      "pageNumber": 1
    }
  ],
  "diagnostic": {
    "sessionId": "test-session-123",
    "originalFilename": "test-document.pdf",
    "fileSize": 123456,
    "pageCount": 5,
    "extractedImageCount": 5,
    "attempts": [...]
  }
}
```

### 3. Test with Invalid File

```bash
curl -X POST https://your-app-url/api/extract-images \
  -F "pdf=@not-a-pdf.txt" \
  | jq
```

**Expected Response:**
```json
{
  "success": false,
  "error": "File bukan PDF yang valid.",
  "diagnostic": {
    "errorCode": "INVALID_PDF",
    "errorMessage": "Invalid PDF header: ...",
    ...
  }
}
```

### 4. Test File Size Limit (>200MB)

```bash
# Create a large dummy file for testing
dd if=/dev/zero of=large-file.pdf bs=1M count=250

curl -X POST https://your-app-url/api/extract-images \
  -F "pdf=@large-file.pdf" \
  | jq
```

**Expected Response:**
```json
{
  "success": false,
  "error": "File terlalu besar (250.0MB). Maksimal 200MB.",
  "diagnostic": {
    "errorCode": "FILE_TOO_LARGE",
    ...
  }
}
```

## Browser Testing Scenarios

### Scenario 1: Normal Upload (Happy Path)

1. Open the app
2. Click "Get Started" or navigate to upload page
3. Drag and drop a valid PDF or click to browse
4. Wait for processing
5. **Expected**: Images displayed in gallery with download options

**Success Indicators:**
- ✅ Progress bar shows smooth progression
- ✅ Status messages update: "Loading PDF..." → "Scanning pages..." → "Complete!"
- ✅ Gallery displays all extracted images
- ✅ Each image shows metadata (page number, dimensions)
- ✅ Download buttons work for individual images and ZIP

### Scenario 2: Worker Blocked (Fallback Test)

1. Open DevTools → Network tab
2. Add filter to block: `*pdf.worker*`
3. Upload a PDF
4. **Expected**: Automatically falls back to server extraction

**Success Indicators:**
- ✅ Console shows: "Client-side PDF worker failed, falling back to server"
- ✅ Status changes to "Client worker failed, switching to server extraction..."
- ✅ Extraction completes successfully via server
- ✅ Diagnostic shows server_extraction method was used

### Scenario 3: Corrupted/Invalid PDF

1. Create a text file and rename it to `.pdf`
2. Upload the fake PDF
3. **Expected**: Clear error message

**Success Indicators:**
- ✅ Error screen appears with icon
- ✅ Message in Indonesian: "File bukan PDF yang valid..."
- ✅ "Download Diagnostic" button available
- ✅ Recommendations shown (e.g., "Buka PDF di Adobe Reader...")

### Scenario 4: Encrypted PDF

1. Upload a password-protected PDF
2. **Expected**: Encryption detected and message shown

**Success Indicators:**
- ✅ Error code: `PDF_ENCRYPTED`
- ✅ Message: "PDF ini terenkripsi. Silakan buka file dengan sandi..."
- ✅ Recommendation to remove encryption or export without password

### Scenario 5: Large File

1. Upload a PDF larger than 200MB
2. **Expected**: Size check happens before processing

**Success Indicators:**
- ✅ Error appears quickly (before upload completes)
- ✅ Message shows exact file size and limit
- ✅ No server processing attempted

### Scenario 6: PDF Without Images

1. Upload a text-only PDF with no embedded images
2. **Expected**: Pages are rasterized

**Success Indicators:**
- ✅ Processing continues after "No embedded images found"
- ✅ Status: "Rasterizing pages..."
- ✅ Each page converted to a high-resolution image
- ✅ Gallery shows one image per page

## Diagnostic Verification

### Download and Inspect Diagnostic JSON

When an error occurs:

1. Click "Download Diagnostic" button
2. Open the downloaded JSON file
3. Verify it contains:

```json
{
  "sessionId": "pdf_...",
  "originalFilename": "your-file.pdf",
  "fileSize": 123456,
  "fileMd5": "a1b2c3d4...",
  "pdfVersion": "1.7",
  "pdfHeader": "%PDF-",
  "pageCount": 0,
  "extractedImageCount": 0,
  "attempts": [
    {
      "method": "header_validation",
      "success": true,
      "timestamp": 1234567890,
      "duration": 5
    },
    {
      "method": "standard_load",
      "success": false,
      "error": "Worker initialization failed",
      "errorStack": "Error: ...",
      "timestamp": 1234567895,
      "duration": 123
    }
  ],
  "timestamp": 1234567890,
  "duration": 456,
  "errorCode": "PDF_LOAD_FAILED",
  "errorMessage": "Gagal memuat PDF...",
  "recommendations": [
    "Buka PDF di Adobe Reader dan Save As dengan nama baru",
    "Gunakan 'Print to PDF' untuk membuat salinan bersih"
  ]
}
```

## Performance Tests

### Test with Various PDF Types

| PDF Type | Expected Time | Expected Result |
|----------|--------------|-----------------|
| Small (1-5 pages) | <2 seconds | ✅ Fast extraction |
| Medium (10-50 pages) | <10 seconds | ✅ Smooth progress |
| Large (100-500 pages) | <60 seconds | ✅ With progress updates |
| Scanned document | <15 seconds | ✅ Rasterized pages |
| Complex layout | <20 seconds | ✅ All elements extracted |

### Memory Usage

Monitor browser memory during extraction:

```javascript
// Run in console during extraction
console.log(performance.memory.usedJSHeapSize / 1024 / 1024 + ' MB')
```

**Expected:**
- Normal PDF: < 100 MB heap increase
- Large PDF: < 500 MB heap increase
- No memory leaks after extraction completes

## Edge Cases

### Test These Specific Cases

1. **PDF with special characters in filename** (e.g., `报告-2024.pdf`)
   - ✅ Should handle Unicode filenames correctly

2. **PDF with 0 pages** (corrupted)
   - ✅ Should show clear error before processing

3. **Upload same file twice**
   - ✅ Should process independently with different session IDs

4. **Cancel extraction mid-process** (close tab/refresh)
   - ✅ Should not leave hanging requests
   - ✅ Temp data should be cleaned up

5. **Offline mode**
   - ✅ Client-side extraction should still work
   - ✅ Server endpoint will fail but client fallback works

6. **Slow network**
   - ✅ Upload progress should be visible
   - ✅ Timeout handled gracefully

## Automated Test Script (for CI/CD)

```bash
#!/bin/bash

echo "Testing PDF Image Extractor endpoints..."

# 1. Test worker asset
echo "1. Checking worker asset..."
WORKER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-app.com/assets/pdf.worker.min-*.mjs)
if [ "$WORKER_STATUS" = "200" ]; then
  echo "✅ Worker asset accessible"
else
  echo "❌ Worker asset not found (HTTP $WORKER_STATUS)"
  exit 1
fi

# 2. Test server endpoint with valid PDF
echo "2. Testing server endpoint with valid PDF..."
RESPONSE=$(curl -s -X POST https://your-app.com/api/extract-images \
  -F "pdf=@test-fixtures/sample.pdf")
SUCCESS=$(echo $RESPONSE | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  echo "✅ Server extraction works"
else
  echo "❌ Server extraction failed"
  echo "$RESPONSE" | jq
  exit 1
fi

# 3. Test file size limit
echo "3. Testing file size limit..."
dd if=/dev/zero of=/tmp/large.pdf bs=1M count=250 2>/dev/null
RESPONSE=$(curl -s -X POST https://your-app.com/api/extract-images \
  -F "pdf=@/tmp/large.pdf")
ERROR_CODE=$(echo $RESPONSE | jq -r '.diagnostic.errorCode')
if [ "$ERROR_CODE" = "FILE_TOO_LARGE" ]; then
  echo "✅ File size limit enforced"
else
  echo "❌ File size limit not working"
  exit 1
fi
rm /tmp/large.pdf

# 4. Test invalid file
echo "4. Testing invalid file rejection..."
echo "not a pdf" > /tmp/fake.pdf
RESPONSE=$(curl -s -X POST https://your-app.com/api/extract-images \
  -F "pdf=@/tmp/fake.pdf")
ERROR_CODE=$(echo $RESPONSE | jq -r '.diagnostic.errorCode')
if [ "$ERROR_CODE" = "INVALID_PDF" ]; then
  echo "✅ Invalid file rejected"
else
  echo "❌ Invalid file not rejected properly"
  exit 1
fi
rm /tmp/fake.pdf

echo ""
echo "🎉 All tests passed!"
```

## Monitoring in Production

### Key Metrics to Track

1. **Extraction Success Rate**
   - Target: >95% for valid PDFs
   - Track error codes distribution

2. **Client vs Server Extraction**
   - Track how often server fallback is used
   - If >20%, investigate worker issues

3. **Average Processing Time**
   - Small PDFs: <5s
   - Medium PDFs: <15s
   - Large PDFs: <60s

4. **Error Distribution**
   - Most common: What types of PDFs fail?
   - Track diagnostic downloads

### Log Analysis

Search for these patterns in logs:

```bash
# Worker initialization failures
grep "Worker initialization failed" logs.txt

# Server fallback usage
grep "Client worker failed, switching to server" logs.txt

# Extraction errors
grep "PDF_LOAD_FAILED\|ALL_METHODS_FAILED" logs.txt

# File size rejections
grep "FILE_TOO_LARGE" logs.txt
```

## User Acceptance Testing Checklist

- [ ] Can upload PDF via drag-and-drop
- [ ] Can upload PDF via file picker
- [ ] Upload progress is visible and smooth
- [ ] Extraction progress shows meaningful status updates
- [ ] Success toast appears when complete
- [ ] Gallery displays all images correctly
- [ ] Image preview modal works (click image)
- [ ] Can download individual images
- [ ] Can download all images as ZIP
- [ ] ZIP contains all images with correct filenames
- [ ] Error messages are clear and in Indonesian
- [ ] Can download diagnostic JSON on errors
- [ ] "Start Over" button works
- [ ] Can return to homepage and back
- [ ] Mobile responsive (test on phone/tablet)
- [ ] Works offline (client-side extraction)
- [ ] Fast on modern browsers (Chrome, Firefox, Safari, Edge)
