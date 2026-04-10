import { useState, useEffect } from 'react'

interface AIThinkingProcessProps {
  isVisible: boolean
  process: {
    step: string
    description: string
    result?: string
    duration?: number
  }[]
  onComplete?: () => void
}

export function AIThinkingProcess({ isVisible, process, onComplete }: AIThinkingProcessProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    if (isVisible && process.length > 0) {
      setCurrentStep(0)
      setIsPlaying(true)
    }
  }, [isVisible, process])

  useEffect(() => {
    if (!isPlaying || currentStep >= process.length) return

    const timeout = setTimeout(() => {
      if (currentStep === process.length - 1) {
        setIsPlaying(false)
        onComplete?.()
      } else {
        setCurrentStep(prev => prev + 1)
      }
    }, process[currentStep].duration || 1000)

    return () => clearTimeout(timeout)
  }, [currentStep, isPlaying, process, onComplete])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">AI 思考过程</h3>
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          {process.map((step, index) => (
            <div key={index} className="relative">
              <div className={`flex items-start gap-3 ${currentStep >= index ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === index ? 'bg-blue-500 text-white' : currentStep > index ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {currentStep > index ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium ${currentStep === index ? 'text-blue-600' : 'text-gray-700'}`}>
                    {step.step}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                  {step.result && (
                    <p className="text-sm text-gray-800 mt-1 font-medium">{step.result}</p>
                  )}
                </div>
              </div>
              {index < process.length - 1 && (
                <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200" style={{ height: 'calc(100% + 1rem)' }} />
              )}
            </div>
          ))}
        </div>

        {isPlaying && (
          <div className="mt-6">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 ease-in-out"
                style={{ 
                  width: `${((currentStep + 1) / process.length) * 100}%` 
                }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500 text-center">
              正在思考... {Math.round(((currentStep + 1) / process.length) * 100)}%
            </div>
          </div>
        )}

        {!isPlaying && currentStep === process.length && (
          <button
            onClick={onComplete}
            className="mt-6 w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            查看结果
          </button>
        )}
      </div>
    </div>
  )
}
