import JSZip from 'jszip'
import { ExtractedImage } from './pdf-extractor'
import { dataUrlToBlob } from './pdf-extractor'

export async function generateZipFromImages(
  images: ExtractedImage[],
  zipName: string = 'extracted-images.zip',
  onProgress?: (progress: number, current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip()
  
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    try {
      const blob = dataUrlToBlob(image.dataUrl)
      zip.file(image.filename, blob)
      
      if (onProgress) {
        const progress = ((i + 1) / images.length) * 50
        onProgress(progress, i + 1, images.length)
      }
      
      if (i % 50 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    } catch (error) {
      console.error(`Failed to add image ${image.filename} to ZIP:`, error)
    }
  }
  
  if (onProgress) {
    onProgress(50, images.length, images.length)
  }
  
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 6
    }
  }, (metadata) => {
    if (onProgress) {
      const progress = 50 + (metadata.percent * 0.5)
      onProgress(progress, images.length, images.length)
    }
  })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  
  if (onProgress) {
    onProgress(100, images.length, images.length)
  }
}

export function downloadSingleImage(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
