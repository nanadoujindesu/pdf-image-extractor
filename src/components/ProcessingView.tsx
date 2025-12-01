import { motion } from 'framer-motion'
import { CircleNotch } from '@phosphor-icons/react'
import { Progress } from '@/components/ui/progress'

interface ProcessingViewProps {
  progress: number
  status: string
}

export function ProcessingView({ progress, status }: ProcessingViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="min-h-[400px] flex items-center justify-center"
    >
      <div className="glass-effect p-12 rounded-2xl max-w-md w-full text-center space-y-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20"
        >
          <CircleNotch weight="bold" className="w-10 h-10 text-primary" />
        </motion.div>

        <div className="space-y-3">
          <h3 className="text-2xl font-semibold">Processing PDF</h3>
          <p className="text-muted-foreground">{status}</p>
        </div>

        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground font-medium">
            {Math.round(progress)}%
          </p>
        </div>
      </div>
    </motion.div>
  )
}
