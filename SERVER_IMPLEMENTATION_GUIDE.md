# Server-Side PDF Extraction Implementation Guide

## Overview

This guide explains how to implement the `/api/extract-images` endpoint for server-side PDF image extraction. The client application will automatically fall back to server extraction when the browser PDF.js worker fails to load.

## Current Status

✅ **Client-side extraction**: Fully implemented with PDF.js
✅ **Automatic fallback**: Client detects worker failures and attempts server extraction
✅ **Graceful degradation**: Falls back to client-side "server simulation" if endpoint unavailable
⚠️ **Server endpoint**: Placeholder implementation - requires backend setup

## Architecture

```
┌─────────────┐
│   Browser   │
│  (PDF.js)   │
└──────┬──────┘
       │
       │ Worker fails?
       ▼
┌─────────────┐
│   POST to   │
│/api/extract │
└──────┬──────┘
       │
       ├─── 404/Network Error ──► Client-side fallback (simulated)
       │
       └─── 200 Success ──────► Return extracted images
```

## Implementation Options

### Option 1: Python Backend (Recommended)

**Best for**: High-quality extraction, complex PDFs, production use

#### Stack: Flask + PyMuPDF

```python
# api/extract_images.py
from flask import Flask, request, jsonify
import fitz  # PyMuPDF
import base64
from io import BytesIO
from PIL import Image
import time

app = Flask(__name__)

@app.route('/api/extract-images', methods=['POST'])
def extract_images():
    start_time = time.time()
    
    if 'pdf' not in request.files:
        return jsonify({'success': False, 'error': 'No PDF file provided'}), 400
    
    pdf_file = request.files['pdf']
    session_id = request.form.get('sessionId', 'unknown')
    
    diagnostic = {
        'sessionId': session_id,
        'originalFilename': pdf_file.filename,
        'fileSize': 0,
        'pageCount': 0,
        'extractedImageCount': 0,
        'attempts': [],
        'timestamp': int(time.time() * 1000)
    }
    
    try:
        # Read PDF
        pdf_bytes = pdf_file.read()
        diagnostic['fileSize'] = len(pdf_bytes)
        
        # Open with PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        diagnostic['pageCount'] = len(doc)
        
        images = []
        
        # Extract images from each page
        for page_num in range(len(doc)):
            page = doc[page_num]
            image_list = page.get_images(full=True)
            
            for img_index, img in enumerate(image_list):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                # Convert to base64
                image_data = base64.b64encode(image_bytes).decode('utf-8')
                
                # Get image dimensions
                pil_image = Image.open(BytesIO(image_bytes))
                width, height = pil_image.size
                
                images.append({
                    'data': f'data:image/{image_ext};base64,{image_data}',
                    'format': image_ext,
                    'width': width,
                    'height': height,
                    'pageNumber': page_num + 1
                })
        
        doc.close()
        
        diagnostic['extractedImageCount'] = len(images)
        diagnostic['duration'] = int((time.time() - start_time) * 1000)
        diagnostic['attempts'].append({
            'method': 'pymupdf_extraction',
            'success': True,
            'imageCount': len(images),
            'timestamp': int(time.time() * 1000)
        })
        
        return jsonify({
            'success': True,
            'images': images,
            'diagnostic': diagnostic
        })
        
    except Exception as e:
        diagnostic['duration'] = int((time.time() - start_time) * 1000)
        diagnostic['errorCode'] = 'SERVER_EXTRACTION_FAILED'
        diagnostic['errorMessage'] = str(e)
        diagnostic['attempts'].append({
            'method': 'pymupdf_extraction',
            'success': False,
            'error': str(e),
            'timestamp': int(time.time() * 1000)
        })
        
        return jsonify({
            'success': False,
            'error': str(e),
            'diagnostic': diagnostic
        }), 500

if __name__ == '__main__':
    app.run(port=3000)
```

#### Installation

```bash
pip install Flask PyMuPDF Pillow
python api/extract_images.py
```

### Option 2: Node.js Backend

**Best for**: Existing Node.js infrastructure, TypeScript environments

#### Stack: Express + pdf-lib or pdf-parse

```typescript
// api/extract-images.ts (Node.js/Express)
import express from 'express'
import multer from 'multer'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

const app = express()
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
})

app.post('/api/extract-images', upload.single('pdf'), async (req, res) => {
  const startTime = Date.now()
  
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No PDF file provided' })
  }
  
  const sessionId = req.body.sessionId || 'unknown'
  const diagnostic = {
    sessionId,
    originalFilename: req.file.originalname,
    fileSize: req.file.size,
    pageCount: 0,
    extractedImageCount: 0,
    attempts: [],
    timestamp: Date.now()
  }
  
  try {
    const pdfDoc = await PDFDocument.load(req.file.buffer)
    diagnostic.pageCount = pdfDoc.getPageCount()
    
    const images: any[] = []
    
    // Note: pdf-lib doesn't directly extract embedded images
    // You may need to use pdf.js in Node or other tools
    // This is a placeholder showing the structure
    
    diagnostic.extractedImageCount = images.length
    diagnostic.duration = Date.now() - startTime
    diagnostic.attempts.push({
      method: 'node_extraction',
      success: true,
      imageCount: images.length,
      timestamp: Date.now()
    })
    
    res.json({
      success: true,
      images,
      diagnostic
    })
  } catch (error: any) {
    diagnostic.duration = Date.now() - startTime
    diagnostic.errorCode = 'SERVER_EXTRACTION_FAILED'
    diagnostic.errorMessage = error.message
    diagnostic.attempts.push({
      method: 'node_extraction',
      success: false,
      error: error.message,
      timestamp: Date.now()
    })
    
    res.status(500).json({
      success: false,
      error: error.message,
      diagnostic
    })
  }
})

app.listen(3000, () => {
  console.log('Server listening on port 3000')
})
```

#### Installation

```bash
npm install express multer pdf-lib sharp
npm install -D @types/express @types/multer
```

### Option 3: Serverless Function (Vercel/Netlify)

#### Vercel Function

```typescript
// api/extract-images.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import formidable from 'formidable'
import { promises as fs } from 'fs'

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  // Parse multipart form data
  const form = formidable({ maxFileSize: 200 * 1024 * 1024 })
  
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message })
    }
    
    // Process PDF file
    // Implementation similar to Express version
    
    res.json({
      success: false,
      error: 'Not yet implemented'
    })
  })
}
```

## Deployment Checklist

### 1. Environment Setup

- [ ] Backend server/function deployed
- [ ] Endpoint accessible at `/api/extract-images`
- [ ] CORS headers configured (if separate domain)
- [ ] File size limits configured (recommend 200MB max)
- [ ] Timeout limits set appropriately (recommend 120s)

### 2. Testing

```bash
# Test endpoint with curl
curl -X POST http://localhost:3000/api/extract-images \
  -F "pdf=@test.pdf" \
  -F "sessionId=test-123"
```

Expected response:
```json
{
  "success": true,
  "images": [
    {
      "data": "data:image/png;base64,...",
      "format": "png",
      "width": 800,
      "height": 600,
      "pageNumber": 1
    }
  ],
  "diagnostic": {
    "sessionId": "test-123",
    "pageCount": 1,
    "extractedImageCount": 1,
    ...
  }
}
```

### 3. Integration

The client will automatically:
1. Try client-side extraction first
2. Fall back to `/api/extract-images` on worker failure
3. Fall back to client-side simulation if endpoint returns 404
4. Display appropriate error messages with diagnostic data

### 4. Monitoring

Add logging for:
- Request count and file sizes
- Extraction success/failure rates  
- Processing times
- Error types and frequencies

## Production Considerations

### Security

```python
# Validate file type
if not pdf_file.filename.endswith('.pdf'):
    return jsonify({'error': 'Only PDF files allowed'}), 400

# Check magic bytes
if pdf_bytes[:4] != b'%PDF':
    return jsonify({'error': 'Invalid PDF file'}), 400

# Scan for malicious content
# Use antivirus or sandboxing as needed
```

### Performance

- Set reasonable timeouts (60-120s)
- Limit concurrent requests
- Use worker queues for large files
- Cache results if appropriate
- Consider pagination for large result sets

### Cost Optimization

- Compress images before sending (JPEG for photos, PNG for graphics)
- Use streaming responses for large result sets
- Implement request throttling
- Monitor CPU/memory usage

## Current Fallback Behavior

When `/api/extract-images` is not available (404 or network error), the application:

1. Logs a warning to console
2. Falls back to `simulateServerExtraction()` 
3. Uses client-side PDF.js with different worker configuration
4. Provides same response format as server would

This ensures the app works even without a backend, but server extraction provides:
- Better handling of complex/corrupted PDFs
- Higher extraction quality
- Support for more PDF versions
- Better performance for large files

## Questions?

Check the diagnostic JSON for detailed extraction attempt information. The `attempts` array shows exactly which methods were tried and why they failed.
