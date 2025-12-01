import JSZip from 'jszip'
import { ExtractedImage } from './pdf-extractor'
import { dataUrlToBlob } from './pdf-extractor'

export async function generateZipFromImages(
  images: ExtractedImage[],
  zipName: string = 'extracted-images.zip'
): Promise<void> {
  const zip = new JSZip()
  
  for (const image of images) {
    const blob = dataUrlToBlob(image.dataUrl)
    zip.file(image.filename, blob)
  }
  
  const blob = await zip.generateAsync({ type: 'blob' })
  
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadSingleImage(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
