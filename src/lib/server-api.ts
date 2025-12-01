import { simulateServerExtraction } from './server-extraction-handler'

export interface ServerExtractionRequest {
  file: File
  sessionId: string
}

export interface ServerExtractionResult {
  success: boolean
  images?: {
    data: string
    format: string
    width: number
    height: number
    pageNumber: number
  }[]
  error?: string
  diagnostic?: {
    sessionId: string
    originalFilename: string
    fileSize: number
    pageCount: number
    extractedImageCount: number
    attempts: {
      method: string
      success: boolean
      error?: string
      timestamp: number
      duration?: number
    }[]
    timestamp: number
    duration: number
    errorCode?: string
    errorMessage?: string
  }
}

export async function uploadForServerExtraction(
  file: File,
  sessionId: string
): Promise<ServerExtractionResult> {
  try {
    const formData = new FormData()
    formData.append('pdf', file, file.name)
    formData.append('sessionId', sessionId)

    const response = await fetch('/api/extract-images', {
      method: 'POST',
      body: formData,
    })

    if (response.status === 404) {
      console.warn('Server endpoint not available, using client-side fallback extraction')
      const arrayBuffer = await file.arrayBuffer()
      return await simulateServerExtraction(arrayBuffer, file.name, sessionId)
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Server returned ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (fetchError: any) {
    if (fetchError.message?.includes('Failed to fetch') || 
        fetchError.message?.includes('NetworkError') ||
        fetchError.message?.includes('404')) {
      console.warn('Cannot reach server endpoint, using client-side fallback extraction')
      const arrayBuffer = await file.arrayBuffer()
      return await simulateServerExtraction(arrayBuffer, file.name, sessionId)
    }
    throw fetchError
  }
}
