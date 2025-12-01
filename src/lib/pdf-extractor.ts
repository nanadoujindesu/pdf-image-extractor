import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export interface ExtractedImage {
  id: string
  dataUrl: string
  pageNumber: number
  width: number
  height: number
  format: string
  filename: string
}

export interface ExtractionResult {
  images: ExtractedImage[]
  totalPages: number
  pdfName: string
}

export async function extractImagesFromPDF(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<ExtractionResult> {
  try {
    onProgress?.(10, 'Loading PDF document...')
    
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    
    const totalPages = pdf.numPages
    const images: ExtractedImage[] = []
    
    onProgress?.(20, `Scanning ${totalPages} pages...`)

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
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
        const context = canvas.getContext('2d')!
        
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise
        
        const dataUrl = canvas.toDataURL('image/png')
        
        images.push({
          id: `${file.name}-page-${pageNum}-${Date.now()}`,
          dataUrl,
          pageNumber: pageNum,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          format: 'PNG',
          filename: `${file.name.replace('.pdf', '')}_page-${pageNum}.png`,
        })
      }
      
      const progress = 20 + ((pageNum / totalPages) * 60)
      onProgress?.(progress, `Processing page ${pageNum}/${totalPages}...`)
    }

    if (images.length === 0) {
      onProgress?.(80, 'No images found, rasterizing pages...')
      
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const scale = 3
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')!
        
        canvas.width = viewport.width
        canvas.height = viewport.height
        
        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise
        
        const dataUrl = canvas.toDataURL('image/png')
        
        images.push({
          id: `${file.name}-page-${pageNum}-${Date.now()}`,
          dataUrl,
          pageNumber: pageNum,
          width: Math.round(viewport.width),
          height: Math.round(viewport.height),
          format: 'PNG',
          filename: `${file.name.replace('.pdf', '')}_page-${pageNum}.png`,
        })
        
        const progress = 80 + ((pageNum / totalPages) * 15)
        onProgress?.(progress, `Rasterizing page ${pageNum}/${totalPages}...`)
      }
    }

    onProgress?.(100, 'Complete!')

    return {
      images,
      totalPages,
      pdfName: file.name,
    }
  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error('Failed to extract images from PDF. The file may be corrupted or invalid.')
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}
