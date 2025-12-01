import * as pdfjsLib from 'pdfjs-dist'
import type { DiagnosticInfo, ServerExtractionResponse } from './pdf-extractor'

export async function simulateServerExtraction(
  arrayBuffer: ArrayBuffer,
  filename: string,
  sessionId: string
): Promise<ServerExtractionResponse> {
  const startTime = Date.now()
  const diagnostic: Partial<DiagnosticInfo> = {
    sessionId,
    originalFilename: filename,
    fileSize: arrayBuffer.byteLength,
    attempts: [],
    timestamp: startTime,
    pageCount: 0,
    extractedImageCount: 0,
  }

  try {
    const workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
    
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      stopAtErrors: false,
      disableFontFace: true,
      verbosity: 0,
    })

    const pdf = await loadingTask.promise
    diagnostic.pageCount = pdf.numPages

    const attemptStart = Date.now()
    diagnostic.attempts?.push({
      method: 'server_pdf_load',
      success: true,
      timestamp: attemptStart,
      duration: Date.now() - attemptStart,
    })

    const images: ServerExtractionResponse['images'] = []
    const totalPages = Math.min(pdf.numPages, 500)

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const operatorList = await page.getOperatorList()

        let hasImages = false
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i]
          if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
            hasImages = true
            break
          }
        }

        if (hasImages) {
          const scale = 2
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d', { willReadFrequently: false })!

          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvasContext: context,
            viewport: viewport,
          } as any).promise

          const dataUrl = canvas.toDataURL('image/png')

          images.push({
            data: dataUrl,
            format: 'png',
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
            pageNumber: pageNum,
          })
        }
      } catch (pageError) {
        console.error(`Server: Error processing page ${pageNum}:`, pageError)
      }
    }

    await pdf.destroy()

    diagnostic.extractedImageCount = images.length
    diagnostic.duration = Date.now() - startTime

    diagnostic.attempts?.push({
      method: 'server_extraction_complete',
      success: true,
      imageCount: images.length,
      timestamp: Date.now(),
      duration: Date.now() - attemptStart,
    })

    return {
      success: true,
      images,
      diagnostic: diagnostic as DiagnosticInfo,
    }
  } catch (error: any) {
    diagnostic.attempts?.push({
      method: 'server_extraction',
      success: false,
      error: error.message,
      errorStack: error.stack,
      timestamp: Date.now(),
    })

    diagnostic.duration = Date.now() - startTime
    diagnostic.errorCode = 'SERVER_EXTRACTION_FAILED'
    diagnostic.errorMessage = error.message

    return {
      success: false,
      error: error.message,
      diagnostic: diagnostic as DiagnosticInfo,
    }
  }
}
