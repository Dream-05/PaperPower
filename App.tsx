import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NotificationProvider } from '@/components/Notification'
import ErrorBoundary from '@/components/ErrorBoundary'
import MiniAI from '@/components/MiniAI'
import { initializeSystem } from '@/utils/systemInitializer'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/contexts/ToastContext'

const HomePage = lazy(() => import('./pages/HomePage'))
const WordEditor = lazy(() => import('./pages/WordEditor'))
const ExcelEditor = lazy(() => import('./pages/ExcelEditor'))
const PPTGenerator = lazy(() => import('./pages/PPTGenerator'))
const FileManager = lazy(() => import('./pages/FileManager'))
const ImageFusion = lazy(() => import('./pages/ImageFusion'))

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-gray-600 text-sm">系统初始化中...</p>
      </div>
    </div>
  )
}

function App() {
  const [initialized, setInitialized] = useState(false)
  
  useEffect(() => {
    // 初始化系统
    const initSystem = async () => {
      await initializeSystem()
      setInitialized(true)
    }
    
    initSystem()
  }, [])
  
  if (!initialized) {
    return <LoadingSpinner />
  }
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/word" element={<WordEditor />} />
                  <Route path="/excel" element={<ExcelEditor />} />
                  <Route path="/ppt" element={<PPTGenerator />} />
                  <Route path="/files" element={<FileManager />} />
                  <Route path="/image-fusion" element={<ImageFusion />} />
                </Routes>
              </Suspense>
              <MiniAI />
            </BrowserRouter>
          </NotificationProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
