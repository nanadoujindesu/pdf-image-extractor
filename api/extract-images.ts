import * as pdfjsLib from 'pdfjs-dist'

const MAX_FILE_SIZE = 200 * 1024 * 1024
const MAX_PAGES = 500

interface DiagnosticAttempt {
  method: string
  success: boolean
  error?: string
  errorStack?: string
  imageCount?: number
  details?: any
  timestamp: number
  duration?: number
}

interface DiagnosticInfo {
  sessionId: string
  originalFilename: string
  fileSize: number
  fileMd5?: string
  pdfVersion?: string
  pdfHeader?: string
  pageCount: number
  extractedImageCount: number
  attempts: DiagnosticAttempt[]
  timestamp: number
  duration: number
  errorCode?: string
  errorMessage?: string
  stackTrace?: string
}

function extractPDFVersion(arrayBuffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(arrayBuffer.slice(0, 20))
    const header = String.fromCharCode(...bytes)
    const versionMatch = header.match(/%PDF-(\d+\.\d+)/)
    return versionMatch ? versionMatch[1] : 'unknown'
  } catch {
    return 'unknown'
  }
}

function validatePDFHeader(arrayBuffer: ArrayBuffer): { valid: boolean; header: string } {
  const bytes = new Uint8Array(arrayBuffer.slice(0, 5))
  const header = String.fromCharCode(...bytes)
  return {
    valid: header === '%PDF-',
    header: header
  }
}

async function calculateMD5(arrayBuffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function tryLoadPDFWithFallbacks(
  arrayBuffer: ArrayBuffer,
  diagnostic: DiagnosticInfo
): Promise<pdfjsLib.PDFDocumentProxy> {
  const attempts: { method: string; config: any }[] = [
    {
      method: 'server_standard_load',
      config: {
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
      }
    },
    {
      method: 'server_load_with_recovery',
      config: {
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true,
        stopAtErrors: false,
        disableFontFace: true,
      }
    },
    {
      method: 'server_load_minimal',
      config: {
        data: new Uint8Array(arrayBuffer),
        useWorkerFetch: false,
        isEvalSupported: false,
        disableFontFace: true,
        stopAtErrors: false,
        verbosity: 0,
      }
    }
  ]

  let lastError: any = null

  for (const attempt of attempts) {
    const attemptStart = Date.now()
    try {
      const pdf = await pdfjsLib.getDocument(attempt.config).promise
      
      diagnostic.attempts.push({
        method: attempt.method,
        success: true,
        details: { pages: pdf.numPages },
        timestamp: attemptStart,
        duration: Date.now() - attemptStart
      })
      
      return pdf
    } catch (error: any) {
      lastError = error
      diagnostic.attempts.push({
        method: attempt.method,
        success: false,
        error: error.message || String(error),
        errorStack: error.stack,
        timestamp: attemptStart,
        duration: Date.now() - attemptStart
      })
    }
  }

  throw lastError
}

async function extractImagesUsingPDFJS(
  pdf: pdfjsLib.PDFDocumentProxy
): Promise<{ data: string; format: string; width: number; height: number; pageNumber: number }[]> {
  const totalPages = Math.min(pdf.numPages, MAX_PAGES)
  const images: { data: string; format: string; width: number; height: number; pageNumber: number }[] = []

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum)
      
      const scale = 2
      const viewport = page.getViewport({ scale })
      
      const canvas = new OffscreenCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')

      if (!context) {
        throw new Error('Failed to get 2D context')
      }

      await page.render({
        canvasContext: context as any,
        viewport: viewport,
      }).promise

      const blob = await canvas.convertToBlob({ type: 'image/png' })
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const dataUrl = `data:image/png;base64,${base64}`
      
      images.push({
        data: dataUrl,
        format: 'png',
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        pageNumber: pageNum,
      })
    } catch (error) {
      console.error(`Server: Error processing page ${pageNum}:`, error)
    }
  }

  return images
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()
  let diagnostic: DiagnosticInfo | null = null

  try {
    const formData = await req.formData()
    const pdfFile = formData.get('pdf') as File
    const sessionId = (formData.get('sessionId') as string) || `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    if (!pdfFile) {
      return new Response(JSON.stringify({ error: 'No PDF file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    diagnostic = {
      sessionId,
      originalFilename: pdfFile.name,
      fileSize: pdfFile.size,
      pageCount: 0,
      extractedImageCount: 0,
      attempts: [],
      timestamp: startTime,
      duration: 0,
    }

    if (pdfFile.size > MAX_FILE_SIZE) {
      diagnostic.errorCode = 'FILE_TOO_LARGE'
      diagnostic.errorMessage = `File size ${(pdfFile.size / 1024 / 1024).toFixed(1)}MB exceeds limit`
      diagnostic.duration = Date.now() - startTime
      
      return new Response(JSON.stringify({
        success: false,
        error: `File terlalu besar (${(pdfFile.size / 1024 / 1024).toFixed(1)}MB). Maksimal ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        diagnostic
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const arrayBuffer = await pdfFile.arrayBuffer()
    
    diagnostic.fileMd5 = await calculateMD5(arrayBuffer)
    diagnostic.pdfVersion = extractPDFVersion(arrayBuffer)
    
    const headerValidation = validatePDFHeader(arrayBuffer)
    diagnostic.pdfHeader = headerValidation.header
    
    if (!headerValidation.valid) {
      diagnostic.errorCode = 'INVALID_PDF'
      diagnostic.errorMessage = `Invalid PDF header: "${headerValidation.header}"`
      diagnostic.duration = Date.now() - startTime
      
      return new Response(JSON.stringify({
        success: false,
        error: 'File bukan PDF yang valid.',
        diagnostic
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const pdf = await tryLoadPDFWithFallbacks(arrayBuffer, diagnostic)
    diagnostic.pageCount = pdf.numPages

    if (pdf.numPages > MAX_PAGES) {
      diagnostic.errorCode = 'TOO_MANY_PAGES'
      diagnostic.errorMessage = `PDF has ${pdf.numPages} pages, exceeds limit`
      diagnostic.duration = Date.now() - startTime
      await pdf.destroy()
      
      return new Response(JSON.stringify({
        success: false,
        error: `PDF terlalu banyak halaman (${pdf.numPages}). Maksimal ${MAX_PAGES} halaman.`,
        diagnostic
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const attemptStart = Date.now()
    const images = await extractImagesUsingPDFJS(pdf)
    
    diagnostic.attempts.push({
      method: 'server_pdfjs_extraction',
      success: true,
      imageCount: images.length,
      timestamp: attemptStart,
      duration: Date.now() - attemptStart
    })

    diagnostic.extractedImageCount = images.length
    diagnostic.duration = Date.now() - startTime
    await pdf.destroy()

    if (images.length === 0) {
      diagnostic.errorCode = 'NO_IMAGES'
      diagnostic.errorMessage = 'No images found in PDF'
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Tidak ada gambar yang dapat diekstrak dari PDF ini.',
        diagnostic
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      images,
      diagnostic
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Server extraction error:', error)
    
    if (diagnostic) {
      diagnostic.errorCode = 'SERVER_ERROR'
      diagnostic.errorMessage = error.message || 'Unknown server error'
      diagnostic.stackTrace = error.stack
      diagnostic.duration = Date.now() - startTime
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Internal server error',
      diagnostic
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
