import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, ArrowsOut, Package } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ExtractedImage } from '@/lib/pdf-extractor'
import { downloadSingleImage, generateZipFromImages } from '@/lib/zip-generator'
import { toast } from 'sonner'

interface ImageGalleryProps {
  images: ExtractedImage[]
  pdfName: string
  onStartOver: () => void
}

export function ImageGallery({ images, pdfName, onStartOver }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ExtractedImage | null>(null)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  const handleDownloadAll = async () => {
    try {
      setIsDownloadingZip(true)
      toast.info(`Generating ZIP with ${images.length} images...`)
      await generateZipFromImages(images, `${pdfName.replace('.pdf', '')}_images.zip`)
      toast.success('ZIP file downloaded successfully!')
    } catch (error) {
      console.error('ZIP generation error:', error)
      toast.error('Failed to generate ZIP file')
    } finally {
      setIsDownloadingZip(false)
    }
  }

  const handleDownloadSingle = (image: ExtractedImage) => {
    try {
      downloadSingleImage(image.dataUrl, image.filename)
      toast.success('Image downloaded!')
    } catch (error) {
      toast.error('Failed to download image')
    }
  }

  const shouldReduceAnimations = images.length > 100

  return (
    <div className="min-h-screen px-6 md:px-12 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-2">Extracted Images</h2>
            <p className="text-muted-foreground">
              {images.length} {images.length === 1 ? 'image' : 'images'} from{' '}
              <span className="text-foreground font-medium">{pdfName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleDownloadAll}
              size="lg"
              disabled={isDownloadingZip}
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-opacity"
            >
              <Package weight="bold" className="w-5 h-5 mr-2" />
              {isDownloadingZip ? 'Generating ZIP...' : 'Download All as ZIP'}
            </Button>
            <Button onClick={onStartOver} variant="outline" size="lg">
              Upload New PDF
            </Button>
          </div>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {images.map((image, index) => (
            <ImageCard
              key={image.id}
              image={image}
              index={index}
              onClick={() => setSelectedImage(image)}
              onDownload={() => handleDownloadSingle(image)}
              shouldAnimate={!shouldReduceAnimations}
            />
          ))}
        </div>
      </motion.div>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <AnimatePresence mode="wait">
            {selectedImage && (
              <motion.div
                key={selectedImage.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">{selectedImage.filename}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span>{selectedImage.width} × {selectedImage.height}px</span>
                      <span>•</span>
                      <span>Page {selectedImage.pageNumber}</span>
                      <span>•</span>
                      <span>{selectedImage.format}</span>
                    </div>
                  </div>
                  <Button onClick={() => handleDownloadSingle(selectedImage)}>
                    <Download weight="bold" className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>

                <div className="rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedImage.dataUrl}
                    alt={selectedImage.filename}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ImageCardProps {
  image: ExtractedImage
  index: number
  onClick: () => void
  onDownload: () => void
  shouldAnimate: boolean
}

function ImageCard({ image, index, onClick, onDownload, shouldAnimate }: ImageCardProps) {
  const Wrapper = shouldAnimate ? motion.div : 'div'
  const wrapperProps = shouldAnimate ? {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: Math.min(index * 0.02, 0.5) }
  } : {}

  return (
    <Wrapper
      {...wrapperProps}
      className="group glass-effect rounded-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300"
    >
      <div
        className="relative aspect-[3/4] bg-muted cursor-pointer"
        onClick={onClick}
      >
        <img
          src={image.dataUrl}
          alt={image.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <ArrowsOut weight="bold" className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{image.filename}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {image.width} × {image.height}px
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            Page {image.pageNumber}
          </Badge>
        </div>

        <Button
          onClick={(e) => {
            e.stopPropagation()
            onDownload()
          }}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Download weight="bold" className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    </Wrapper>
  )
}
