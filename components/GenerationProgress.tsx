import { useEffect, useState } from 'react'

interface GenerationProgressProps {
  isVisible: boolean
  currentStep: number
  totalSteps: number
  currentAction: string
  onComplete?: () => void
}

export function GenerationProgress({
  isVisible,
  currentStep,
  totalSteps,
  currentAction,
  onComplete
}: GenerationProgressProps) {
  const [showCheckmark, setShowCheckmark] = useState(false)
  
  useEffect(() => {
    if (currentStep >= totalSteps && totalSteps > 0) {
      setTimeout(() => {
        setShowCheckmark(true)
        setTimeout(() => {
          onComplete?.()
        }, 1000)
      }, 500)
    } else {
      setShowCheckmark(false)
    }
  }, [currentStep, totalSteps, onComplete])
  
  if (!isVisible) return null
  
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center">
          <div className="mb-6">
            {showCheckmark ? (
              <div className="w-20 h-20 mx-auto rounded-full bg-green-500 flex items-center justify-center animate-bounce">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="relative w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-blue-500 transition-all duration-500"
                    strokeDasharray={`${progress * 2.26} 226`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-700">{Math.round(progress)}%</span>
                </div>
              </div>
            )}
          </div>
          
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {showCheckmark ? '生成完成！' : '正在生成PPT...'}
          </h3>
          
          <p className="text-gray-600 mb-4">{currentAction}</p>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-500">
            {currentStep} / {totalSteps} 页
          </p>
        </div>
      </div>
    </div>
  )
}
