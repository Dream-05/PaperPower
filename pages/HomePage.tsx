import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useLanguageStore } from '@/store/languageStore'
import { t } from '@/i18n'

import LanguageSwitcher from '@/components/LanguageSwitcher'

export default function HomePage() {
  const navigate = useNavigate()
  const { openAIPanel } = useAppStore()
  const { language } = useLanguageStore()
  const [searchValue, setSearchValue] = useState('')
  
  const appItems = [
    {
      id: 'word',
      name: t('apps.word', language),
      label: 'W',
      desc: t('apps.word.desc', language),
      color: '#2b5797',
      bgColor: '#e8f0f8',
      path: '/word',
    },
    {
      id: 'excel',
      name: t('apps.excel', language),
      label: 'X',
      desc: t('apps.excel.desc', language),
      color: '#107c10',
      bgColor: '#e8f4e8',
      path: '/excel',
    },
    {
      id: 'ppt',
      name: t('apps.ppt', language),
      label: 'P',
      desc: t('apps.ppt.desc', language),
      color: '#d83b01',
      bgColor: '#fff0e6',
      path: '/ppt',
    },
    {
      id: 'files',
      name: t('apps.files', language),
      label: 'F',
      desc: t('apps.files.desc', language),
      color: '#6366f1',
      bgColor: '#f0e6ff',
      path: '/files',
    }
  ]
  
  const recentDocuments = [
    { name: language === 'zh' ? '毕业论文最终版.docx' : 'Thesis_Final.docx', type: 'word', time: t('time.justNow', language), path: '/word' },
    { name: language === 'zh' ? '2024年度销售数据.xlsx' : 'Sales_Report_2024.xlsx', type: 'excel', time: `10 ${language === 'zh' ? '分钟前' : 'min ago'}`, path: '/excel' },
    { name: language === 'zh' ? '产品发布会演示.pptx' : 'Product_Launch.pptx', type: 'ppt', time: `1 ${language === 'zh' ? '小时前' : 'hour ago'}`, path: '/ppt' },
    { name: language === 'zh' ? '部门周报.docx' : 'Weekly_Report.docx', type: 'word', time: t('time.yesterday', language), path: '/word' },
    { name: language === 'zh' ? '客户名单.xlsx' : 'Client_List.xlsx', type: 'excel', time: t('time.yesterday', language), path: '/excel' },
  ]
  
  const templates = [
    { name: t('home.blankDoc', language), type: 'word', label: 'W' },
    { name: t('home.blankWorkbook', language), type: 'excel', label: 'X' },
    { name: t('home.blankPresentation', language), type: 'ppt', label: 'P' },
    { name: t('home.thesisTemplate', language), type: 'word', label: 'W' },
    { name: t('home.resumeTemplate', language), type: 'word', label: 'W' },
    { name: t('home.dataReport', language), type: 'excel', label: 'X' },
  ]
  
  const handleAppClick = (path: string) => {
    navigate(path)
  }
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      openAIPanel()
      if (searchValue.includes('word') || searchValue.includes('doc') || searchValue.includes('文档')) {
        navigate('/word')
      } else if (searchValue.includes('excel') || searchValue.includes('data') || searchValue.includes('数据')) {
        navigate('/excel')
      } else if (searchValue.includes('ppt') || searchValue.includes('slide') || searchValue.includes('演示')) {
        navigate('/ppt')
      } else if (searchValue.includes('file') || searchValue.includes('folder') || searchValue.includes('文件')) {
        navigate('/files')
      }
    }
  }
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'word': return '#2b5797'
      case 'excel': return '#107c10'
      case 'ppt': return '#d83b01'
      default: return '#6366f1'
    }
  }
  
  const getTypeBg = (type: string) => {
    switch (type) {
      case 'word': return '#e8f0f8'
      case 'excel': return '#e8f4e8'
      case 'ppt': return '#fff0e6'
      default: return '#f0e6ff'
    }
  }
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'word': return 'W'
      case 'excel': return 'X'
      case 'ppt': return 'P'
      default: return 'F'
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[placeholder]')?.focus()
      } else if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        openAIPanel()
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        const keyMap: Record<string, string> = { w: '/word', x: '/excel', p: '/ppt', f: '/files', i: '/image-fusion' }
        if (keyMap[e.key.toLowerCase()]) navigate(keyMap[e.key.toLowerCase()])
        else if (e.key === '?') openAIPanel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, openAIPanel])

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-white border-b border-[#e0e0e0]">
        <div className="max-w-5xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#2b5797] rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <span className="text-lg font-semibold text-gray-800">{t('app.name', language)}</span>
              <span className="text-xs text-gray-400 ml-2">{t('app.tagline', language)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 max-w-5xl mx-auto px-8 py-6 w-full">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {appItems.map(app => (
            <button
              key={app.id}
              onClick={() => handleAppClick(app.path)}
              className="bg-white border border-[#e5e5e5] rounded-lg p-5 text-left hover:border-[#c0c0c0] hover:shadow-sm transition-all group"
            >
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
                style={{ backgroundColor: app.bgColor }}
              >
                <span 
                  className="text-xl font-bold"
                  style={{ color: app.color }}
                >
                  {app.label}
                </span>
              </div>
              <h3 className="text-base font-medium text-gray-800 mb-1">{app.name}</h3>
              <p className="text-sm text-gray-500">{app.desc}</p>
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="bg-white border border-[#e5e5e5] rounded-lg">
              <div className="px-5 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
                <h2 className="font-medium text-gray-700">{t('home.recent', language)}</h2>
                <button className="text-sm text-[#2b5797] hover:underline">{t('home.viewAll', language)}</button>
              </div>
              <div className="divide-y divide-[#f0f0f0]">
                {recentDocuments.map((doc, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(doc.path)}
                    className="w-full px-5 py-3 flex items-center gap-3 hover:bg-[#f9f9f9] text-left"
                  >
                    <div 
                      className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: getTypeBg(doc.type) }}
                    >
                      <span 
                        className="text-sm font-bold"
                        style={{ color: getTypeColor(doc.type) }}
                      >
                        {getTypeLabel(doc.type)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.time}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-white border border-[#e5e5e5] rounded-lg mt-4">
              <div className="px-5 py-3 border-b border-[#e5e5e5]">
                <h2 className="font-medium text-gray-700">{t('home.createNew', language)}</h2>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {templates.map((template, i) => (
                  <button
                    key={i}
                    onClick={() => navigate(template.type === 'word' ? '/word' : template.type === 'excel' ? '/excel' : '/ppt')}
                    className="p-3 text-left rounded-lg hover:bg-[#f5f5f5] border border-transparent hover:border-[#e0e0e0] transition-colors"
                  >
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center mb-2"
                      style={{ backgroundColor: getTypeBg(template.type) }}
                    >
                      <span 
                        className="text-xs font-bold"
                        style={{ color: getTypeColor(template.type) }}
                      >
                        {template.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{template.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white border border-[#e5e5e5] rounded-lg p-4">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    placeholder={t('home.search', language)}
                    className="w-full h-10 pl-10 pr-4 text-sm bg-[#f5f5f5] border border-transparent rounded-lg
                      focus:bg-white focus:border-[#2b5797] focus:outline-none transition-colors"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>
            </div>
            
            <div className="bg-white border border-[#e5e5e5] rounded-lg">
              <div className="px-4 py-3 border-b border-[#e5e5e5]">
                <h2 className="font-medium text-gray-700">{t('home.quickActions', language)}</h2>
              </div>
              <div className="p-2">
                {[
                  { label: t('home.openLocal', language), action: () => navigate('/files') },
                  { label: t('home.formatDoc', language), action: () => navigate('/word') },
                  { label: t('home.dataAnalysis', language), action: () => navigate('/excel') },
                  { label: t('home.createPPT', language), action: () => navigate('/ppt') },
                ].map((action, i) => (
                  <button
                    key={i}
                    onClick={action.action}
                    className="w-full px-3 py-2.5 text-left text-sm text-gray-700 
                      hover:bg-[#f5f5f5] rounded-lg flex items-center gap-3 transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-[#2b5797] to-[#1e3a6e] rounded-lg p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span className="font-medium">{t('ai.title', language)}</span>
              </div>
              <p className="text-sm text-white/80 mb-3">
                {t('ai.desc', language)}
              </p>
              <button 
                onClick={() => openAIPanel()}
                className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded transition-colors"
              >
                {t('ai.getStarted', language)}
              </button>
            </div>
            
            <div className="bg-[#f8f9fc] border border-[#e5e5e5] rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {t('app.secure', language)}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white border-t border-[#e0e0e0] py-2 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs text-gray-400">
          <span>{t('app.name', language)} v1.0 - {t('app.footer', language)}</span>
          <span>{t('app.audit', language)}</span>
        </div>
      </div>
    </div>
  )
}
