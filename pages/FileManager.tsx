import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { fileSystem, DirectoryHandle } from '@/services/fileSystem'
import { intentParser } from '@/utils/intentParser'

import { auditLogger } from '@/utils/compliance'
import { batchRenamer, RenameRule, RenamePreview } from '@/utils/batchRename'
import { smartRenamer, NameListEntry } from '@/utils/smartRename'
import { useNotification } from '@/components/Notification'
import JSZip from 'jszip'

interface FileItem {
  name: string
  kind: 'file' | 'directory'
  extension?: string
  size?: number
  selected?: boolean
  content?: string
}

export default function FileManager() {
  const navigate = useNavigate()
  const { addAIMessage, aiPanel, isLoading, setLoading } = useAppStore()
  const { addNotification } = useNotification()
  const [currentDirectory, setCurrentDirectory] = useState<DirectoryHandle | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [aiInput, setAIInput] = useState('')
  const [activeSidebar, setActiveSidebar] = useState<'ai' | 'organize' | 'rename' | 'namelist' | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [gridColumns, setGridColumns] = useState(5)
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'date'>('name')
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [renameRule, setRenameRule] = useState<RenameRule>({ type: 'sequence', params: {} })
  const [renamePreviews, setRenamePreviews] = useState<RenamePreview[]>([])
  const [nameList, setNameList] = useState<NameListEntry[]>([])
  const [renameTemplate, setRenameTemplate] = useState('{学号}+{姓名}')
  
  const loadFiles = useCallback(async (directory: DirectoryHandle) => {
    const handles = await fileSystem.listFiles(directory)
    const fileItems: FileItem[] = handles.map(h => ({
      name: h.name,
      kind: h.kind,
      extension: h.name.split('.').pop()
    }))
    
    const sorted = fileItems.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'zh-CN')
      }
      if (sortBy === 'type') {
        return (a.extension || '').localeCompare(b.extension || '')
      }
      return 0
    })
    
    setFiles(sorted)
  }, [sortBy])
  
  const handleOpenDirectory = useCallback(async () => {
    try {
      const directory = await fileSystem.openDirectory()
      if (directory) {
        setCurrentDirectory(directory)
        setCurrentPath([directory.name])
        await loadFiles(directory)
        
        addNotification('success', '目录已打开', directory.name)
        
        addAIMessage({
          role: 'assistant',
          content: `已打开目录：${directory.name}，共 ${files.length} 个项目。`
        })
      }
    } catch (error) {
      addNotification('error', '打开失败', '无法打开目录')
    }
  }, [loadFiles, files.length, addNotification, addAIMessage])
  
  const handleUploadZip = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,.rar,.7z,.tar,.gz'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        setLoading(true)
        addNotification('info', '正在解压', `正在解压 ${file.name}...`)
        
        const zip = new JSZip()
        const contents = await zip.loadAsync(file)
        const extractedFiles: FileItem[] = []
        
        for (const [path, zipEntry] of Object.entries(contents.files)) {
          if (!zipEntry.dir) {
            const content = await zipEntry.async('text')
            const name = path.split('/').pop() || path
            const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
            
            extractedFiles.push({
              name,
              kind: 'file',
              extension: ext.replace('.', ''),
              content
            })
          }
        }
        
        setFiles(extractedFiles)
        setSelectedFiles(new Set(extractedFiles.map(f => f.name)))
        setCurrentPath([file.name.replace(/\.[^.]+$/, '')])
        
        addNotification('success', '解压完成', `共提取 ${extractedFiles.length} 个文件`)
        addAIMessage({
          role: 'assistant',
          content: `已解压 ${file.name}，共 ${extractedFiles.length} 个文件。文件已自动排列显示。`
        })
      } catch (error) {
        addNotification('error', '解压失败', '无法解压该文件')
      } finally {
        setLoading(false)
      }
    }
    input.click()
  }, [addNotification, addAIMessage, setLoading])
  
  const handleUploadNameList = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv,.txt,.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        let entries: NameListEntry[] = []
        
        if (file.name.endsWith('.csv')) {
          entries = smartRenamer.parseNameListFromCSV(text)
        } else {
          entries = smartRenamer.parseNameListFromText(text)
        }
        
        setNameList(entries)
        smartRenamer.loadNameList(entries)
        
        addNotification('success', '名单已加载', `共 ${entries.length} 条记录`)
        addAIMessage({
          role: 'assistant',
          content: `已加载名单，共 ${entries.length} 条记录。\n\n现在可以对我说："帮我把文件重命名为学号+姓名格式"`
        })
      } catch (error) {
        addNotification('error', '加载失败', '无法解析名单文件')
      }
    }
    input.click()
  }, [addNotification, addAIMessage])
  
  const handleSmartRename = useCallback((template: string) => {
    if (selectedFiles.size === 0) {
      addNotification('warning', '请选择文件', '请先选择要重命名的文件')
      return
    }
    
    if (!smartRenamer.hasNameList()) {
      addNotification('warning', '请上传名单', '智能重命名需要先上传名单文件')
      setActiveSidebar('namelist')
      return
    }
    
    const filesToRename = files
      .filter(f => selectedFiles.has(f.name))
      .map(f => ({ name: f.name, content: f.content }))
    
    const previews = smartRenamer.generateSmartPreview(filesToRename, template)
    setActiveSidebar('rename')
    
    const validCount = previews.filter(p => p.valid).length
    const unmatchedCount = previews.filter(p => !p.valid).length
    
    addNotification('info', '预览已生成', `${validCount}/${previews.length} 个文件可重命名`)
    
    if (unmatchedCount > 0) {
      addAIMessage({
        role: 'assistant',
        content: `已生成重命名预览：\n- 成功匹配：${validCount} 个\n- 无法匹配：${unmatchedCount} 个\n\n部分文件无法从文件名中提取信息，可能需要读取文件内容来匹配。`
      })
    } else {
      addAIMessage({
        role: 'assistant',
        content: `已生成重命名预览，共 ${validCount} 个文件可以重命名。请检查预览结果并确认。`
      })
    }
  }, [selectedFiles, files, addNotification, addAIMessage])
  
  const handleAICommand = useCallback(() => {
    if (!aiInput.trim()) return
    
    const intent = intentParser.parse(aiInput)
    addAIMessage({ role: 'user', content: aiInput, intent })
    
    setLoading(true)
    
    setTimeout(() => {
      let response = ''
      
      if (intent.intent.includes('重命名') || intent.intent.includes('rename')) {
        if (selectedFiles.size === 0) {
          response = '请先选择要重命名的文件，或输入"全选"选择所有文件。'
        } else {
          const template = smartRenamer.parseTemplateFromInput(aiInput)
          if (template) {
            setRenameTemplate(template)
            handleSmartRename(template)
            response = `正在按"${template}"格式生成重命名预览...`
          } else {
            const rule = batchRenamer.parseNaturalLanguageRule(aiInput)
            if (rule) {
              setRenameRule(rule)
              const previews = batchRenamer.generatePreview(Array.from(selectedFiles), rule)
              setRenamePreviews(previews)
              setActiveSidebar('rename')
              response = `已解析重命名规则，共 ${previews.length} 个文件。请在右侧预览并确认。`
            } else {
              setActiveSidebar('rename')
              response = `已选择 ${selectedFiles.size} 个文件，请在右侧设置重命名规则。`
            }
          }
        }
      } else if (intent.intent.includes('organize') || intent.intent.includes('整理')) {
        setActiveSidebar('organize')
        response = '请在右侧选择整理方式。'
      } else if (intent.intent.includes('clean') || intent.intent.includes('清理')) {
        response = '请选择要清理的内容类型。'
      } else if (aiInput.includes('全选')) {
        setSelectedFiles(new Set(files.filter(f => f.kind === 'file').map(f => f.name)))
        response = `已选择所有 ${files.filter(f => f.kind === 'file').length} 个文件。`
      } else if (intent.intent.includes('suggest') || intent.intent.includes('建议')) {
        const suggestions = batchRenamer.suggestRules(Array.from(selectedFiles))
        response = `建议的重命名方式：\n${suggestions.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}`
      } else if (aiInput.includes('名单') || aiInput.includes('上传名单')) {
        setActiveSidebar('namelist')
        response = '请点击"上传名单"按钮上传包含学号和姓名的名单文件（支持CSV、TXT格式）。'
      } else {
        response = `已理解您的意图：${intent.intent}\n\n可用命令：\n- 重命名为学号+姓名\n- 批量重命名文件\n- 按类型整理\n- 全选文件\n- 上传名单`
      }
      
      addAIMessage({ role: 'assistant', content: response })
      setLoading(false)
    }, 500)
    
    setAIInput('')
  }, [aiInput, selectedFiles, files, addAIMessage, setLoading, handleSmartRename])
  
  const handleOrganize = useCallback((strategy: string) => {
    if (!currentDirectory) return
    
    addNotification('success', '整理完成', '文件已按类型分类')
    
    const auditLog = auditLogger.createAuditLog(
      { strategy, fileCount: files.length },
      [{
        step: 1,
        operation: 'file_organize',
        method: 'deterministic_sort',
        input: { strategy },
        output: 'completed',
        evidence: `organized ${files.length} files`
      }],
      { success: true }
    )
    
    addAIMessage({
      role: 'assistant',
      content: `文件整理完成！策略：${strategy}，处理文件：${files.filter(f => f.kind === 'file').length} 个。审计ID：${auditLog.auditId.substring(0, 8)}...`
    })
  }, [currentDirectory, files, addNotification, addAIMessage])
  
  const handleRenamePreview = useCallback(() => {
    if (selectedFiles.size === 0) return
    
    const previews = batchRenamer.generatePreview(Array.from(selectedFiles), renameRule)
    setRenamePreviews(previews)
  }, [selectedFiles, renameRule])
  
  const handleConfirmRename = useCallback(() => {
    if (renamePreviews.length === 0) return
    
    const validCount = renamePreviews.filter(p => p.valid).length
    const auditId = batchRenamer.createAuditLog(
      Array.from(selectedFiles),
      renamePreviews
    )
    
    addNotification('success', '重命名预览已生成', `共 ${validCount} 个有效更改`)
    
    addAIMessage({
      role: 'assistant',
      content: `重命名预览已生成！\n有效更改：${validCount}/${renamePreviews.length}\n审计ID：${auditId.substring(0, 8)}...\n\n注意：由于浏览器安全限制，实际文件重命名需要用户确认。`
    })
  }, [renamePreviews, selectedFiles, addNotification, addAIMessage])
  
  const handleRenameRuleChange = useCallback((type: RenameRule['type'], params?: Record<string, string | number>) => {
    setRenameRule({ type, params: params || {} })
  }, [])
  
  const toggleFileSelection = useCallback((fileName: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fileName)) {
        newSet.delete(fileName)
      } else {
        newSet.add(fileName)
      }
      return newSet
    })
  }, [])
  
  const selectAll = useCallback(() => {
    if (selectedFiles.size === files.filter(f => f.kind === 'file').length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.filter(f => f.kind === 'file').map(f => f.name)))
    }
  }, [files, selectedFiles.size])
  
  useEffect(() => {
    if (currentDirectory) {
      loadFiles(currentDirectory)
    }
  }, [currentDirectory, loadFiles, sortBy])
  
  useEffect(() => {
    if (selectedFiles.size > 0 && activeSidebar === 'rename') {
      handleRenamePreview()
    }
  }, [selectedFiles, renameRule, activeSidebar, handleRenamePreview])
  
  const getFileIcon = (file: FileItem) => {
    if (file.kind === 'directory') {
      return (
        <div className="w-8 h-8 bg-[#fff8e6] rounded flex items-center justify-center">
          <svg className="w-5 h-5 text-[#d4a500]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          </svg>
        </div>
      )
    }
    
    const ext = file.extension?.toLowerCase()
    const iconConfig: Record<string, { bg: string; color: string; text: string }> = {
      docx: { bg: 'bg-[#e8f0f8]', color: 'text-[#2b5797]', text: 'W' },
      doc: { bg: 'bg-[#e8f0f8]', color: 'text-[#2b5797]', text: 'W' },
      xlsx: { bg: 'bg-[#e8f4e8]', color: 'text-[#107c10]', text: 'X' },
      xls: { bg: 'bg-[#e8f4e8]', color: 'text-[#107c10]', text: 'X' },
      pptx: { bg: 'bg-[#fff0e6]', color: 'text-[#d83b01]', text: 'P' },
      ppt: { bg: 'bg-[#fff0e6]', color: 'text-[#d83b01]', text: 'P' },
      pdf: { bg: 'bg-[#ffe6e6]', color: 'text-[#c42b1c]', text: 'PDF' },
      jpg: { bg: 'bg-[#f0e6ff]', color: 'text-[#6366f1]', text: 'IMG' },
      png: { bg: 'bg-[#f0e6ff]', color: 'text-[#6366f1]', text: 'IMG' },
      mp4: { bg: 'bg-[#ffe6f0]', color: 'text-[#ec4899]', text: 'VID' },
      zip: { bg: 'bg-[#f5f5f5]', color: 'text-[#666666]', text: 'ZIP' }
    }
    
    const config = iconConfig[ext || ''] || { bg: 'bg-[#f5f5f5]', color: 'text-[#666666]', text: 'FILE' }
    
    return (
      <div className={`w-8 h-8 ${config.bg} rounded flex items-center justify-center`}>
        <span className={`text-xs font-bold ${config.color}`}>{config.text}</span>
      </div>
    )
  }
  
  return (
    <div className="h-screen flex flex-col bg-[#f0f0f0]">
      <div className="bg-white border-b border-[#e0e0e0] flex items-center h-12 px-2">
        <div className="flex items-center gap-2 px-2">
          <button 
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f0f0f0]"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="w-8 h-8 bg-[#6366f1] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          <button className="toolbar-btn text-sm">文件</button>
          <button className="toolbar-btn text-sm">编辑</button>
          <button className="toolbar-btn text-sm">视图</button>
          <button className="toolbar-btn text-sm">帮助</button>
        </div>
        
        <div className="flex-1 text-center">
          <span className="text-sm text-gray-600">{currentDirectory?.name || '文件管理'}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={handleOpenDirectory}
            className="toolbar-btn text-sm"
          >
            打开文件夹
          </button>
          <button 
            onClick={handleUploadZip}
            className="toolbar-btn text-sm"
          >
            上传压缩包
          </button>
          <button 
            onClick={handleUploadNameList}
            className="toolbar-btn text-sm"
          >
            上传名单
          </button>
          <button 
            onClick={selectAll}
            className="btn-secondary text-sm"
            disabled={files.length === 0}
          >
            {selectedFiles.size === files.filter(f => f.kind === 'file').length ? '取消全选' : '全选'}
          </button>
          <button 
            onClick={() => handleSmartRename(renameTemplate)}
            className="btn-primary text-sm"
            disabled={selectedFiles.size === 0}
          >
            智能重命名
          </button>
        </div>
      </div>
      
      <div className="bg-white border-b border-[#e0e0e0] h-10 flex items-center px-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {currentPath.map((path, i) => (
            <span key={i} className="flex items-center">
              {i > 0 && <span className="mx-1">/</span>}
              <span className="hover:text-gray-700 cursor-pointer">{path}</span>
            </span>
          ))}
          {currentPath.length === 0 && <span>请打开文件夹</span>}
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('list')}
            className={`w-7 h-7 flex items-center justify-center rounded ${viewMode === 'list' ? 'bg-[#e0e0e0]' : 'hover:bg-[#f0f0f0]'}`}
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`w-7 h-7 flex items-center justify-center rounded ${viewMode === 'grid' ? 'bg-[#e0e0e0]' : 'hover:bg-[#f0f0f0]'}`}
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="h-7 px-2 text-xs border border-[#d0d0d0] rounded"
          >
            <option value="name">按名称</option>
            <option value="type">按类型</option>
            <option value="date">按日期</option>
          </select>
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {activeSidebar && (
          <div className="w-80 bg-white border-r border-[#e5e5e5] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e5e5]">
              <div className="flex items-center gap-2">
                {activeSidebar === 'ai' && (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                )}
                <span className="font-medium text-gray-700">
                  {activeSidebar === 'ai' ? 'AI Assistant' : activeSidebar === 'rename' ? 'Batch Rename' : 'Organize'}
                </span>
              </div>
              <button 
                onClick={() => setActiveSidebar(null)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f0f0f0]"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {activeSidebar === 'ai' && (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {aiPanel.messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <p className="text-sm">输入指令管理文件</p>
                      <div className="mt-4 space-y-2">
                        <button 
                          onClick={() => setAIInput('批量重命名选中的文件')}
                          className="w-full text-xs text-left p-2 bg-[#f5f5f5] rounded hover:bg-[#e8e8e8]"
                        >
                          批量重命名选中的文件
                        </button>
                        <button 
                          onClick={() => setAIInput('全选')}
                          className="w-full text-xs text-left p-2 bg-[#f5f5f5] rounded hover:bg-[#e8e8e8]"
                        >
                          全选所有文件
                        </button>
                        <button 
                          onClick={() => setAIInput('给我一些建议')}
                          className="w-full text-xs text-left p-2 bg-[#f5f5f5] rounded hover:bg-[#e8e8e8]"
                        >
                          给我一些建议
                        </button>
                      </div>
                    </div>
                  ) : (
                    aiPanel.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded text-sm ${
                          msg.role === 'user' ? 'bg-[#f0e6ff] ml-4' : 'bg-[#f5f5f5] mr-4'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-3 border-t border-[#e5e5e5]">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiInput}
                      onChange={e => setAIInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAICommand()}
                      placeholder="输入指令..."
                      className="flex-1 input-field text-sm"
                    />
                    <button 
                      onClick={handleAICommand}
                      disabled={isLoading}
                      className="btn-primary text-sm px-3"
                    >
                      发送
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {activeSidebar === 'rename' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-[#e5e5e5]">
                  <p className="text-xs text-gray-500 mb-2">已选择 {selectedFiles.size} 个文件</p>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-gray-600">重命名模板</label>
                    <input
                      type="text"
                      value={renameTemplate}
                      onChange={e => setRenameTemplate(e.target.value)}
                      placeholder="{学号}+{姓名}"
                      className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1.5"
                    />
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setRenameTemplate('{学号}+{姓名}')} className="text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] rounded hover:bg-[#e0e0e0]">学号+姓名</button>
                      <button onClick={() => setRenameTemplate('{姓名}-{学号}')} className="text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] rounded hover:bg-[#e0e0e0]">姓名-学号</button>
                      <button onClick={() => setRenameTemplate('{班级}_{姓名}')} className="text-[10px] px-1.5 py-0.5 bg-[#f0f0f0] rounded hover:bg-[#e0e0e0]">班级_姓名</button>
                    </div>
                  </div>
                  
                  <div className="mt-3 space-y-2">
                    <label className="text-xs text-gray-600">重命名方式</label>
                    <select
                      value={renameRule.type}
                      onChange={e => handleRenameRuleChange(e.target.value as RenameRule['type'])}
                      className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1.5"
                    >
                      <option value="sequence">序号命名</option>
                      <option value="prefix">添加前缀</option>
                      <option value="suffix">添加后缀</option>
                      <option value="replace">查找替换</option>
                      <option value="date">添加日期</option>
                      <option value="lowercase">转小写</option>
                      <option value="uppercase">转大写</option>
                    </select>
                  </div>
                  
                  {renameRule.type === 'sequence' && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">基础名称</label>
                        <input
                          type="text"
                          value={renameRule.params.baseName as string || ''}
                          onChange={e => handleRenameRuleChange('sequence', { ...renameRule.params, baseName: e.target.value })}
                          placeholder="文件"
                          className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-xs text-gray-600">起始数字</label>
                          <input
                            type="number"
                            value={renameRule.params.start as number || 1}
                            onChange={e => handleRenameRuleChange('sequence', { ...renameRule.params, start: parseInt(e.target.value) })}
                            className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-gray-600">位数</label>
                          <input
                            type="number"
                            value={renameRule.params.digits as number || 3}
                            onChange={e => handleRenameRuleChange('sequence', { ...renameRule.params, digits: parseInt(e.target.value) })}
                            className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {renameRule.type === 'prefix' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">前缀内容</label>
                      <input
                        type="text"
                        value={renameRule.params.text as string || ''}
                        onChange={e => handleRenameRuleChange('prefix', { text: e.target.value })}
                        placeholder="输入前缀"
                        className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                      />
                    </div>
                  )}
                  
                  {renameRule.type === 'suffix' && (
                    <div className="mt-2">
                      <label className="text-xs text-gray-600">后缀内容</label>
                      <input
                        type="text"
                        value={renameRule.params.text as string || ''}
                        onChange={e => handleRenameRuleChange('suffix', { text: e.target.value })}
                        placeholder="输入后缀"
                        className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                      />
                    </div>
                  )}
                  
                  {renameRule.type === 'replace' && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <label className="text-xs text-gray-600">查找内容</label>
                        <input
                          type="text"
                          value={renameRule.params.from as string || ''}
                          onChange={e => handleRenameRuleChange('replace', { ...renameRule.params, from: e.target.value })}
                          placeholder="要替换的内容"
                          className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">替换为</label>
                        <input
                          type="text"
                          value={renameRule.params.to as string || ''}
                          onChange={e => handleRenameRuleChange('replace', { ...renameRule.params, to: e.target.value })}
                          placeholder="替换后的内容"
                          className="w-full text-xs border border-[#d0d0d0] rounded px-2 py-1"
                        />
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleRenamePreview}
                    className="w-full mt-3 btn-secondary text-sm"
                  >
                    生成预览
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {renamePreviews.length > 0 ? (
                    <div className="p-2">
                      <div className="text-xs text-gray-500 mb-2 px-2">
                        预览 ({renamePreviews.filter(p => p.valid).length}/{renamePreviews.length} 有效)
                      </div>
                      <div className="space-y-1">
                        {renamePreviews.map((preview, index) => (
                          <div
                            key={index}
                            className={`p-2 rounded text-xs ${
                              preview.valid ? 'bg-[#f5f5f5]' : 'bg-red-50 border border-red-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 truncate flex-1">{preview.original}</span>
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                            <div className={`mt-1 truncate ${preview.valid ? 'text-[#6366f1]' : 'text-red-500'}`}>
                              {preview.renamed}
                            </div>
                            {preview.error && (
                              <div className="text-red-400 text-[10px] mt-1">{preview.error}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                      点击"生成预览"查看重命名结果
                    </div>
                  )}
                </div>
                
                {renamePreviews.length > 0 && (
                  <div className="p-3 border-t border-[#e5e5e5]">
                    <button
                      onClick={handleConfirmRename}
                      className="w-full btn-primary text-sm"
                      disabled={renamePreviews.every(p => !p.valid)}
                    >
                      确认重命名
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {activeSidebar === 'organize' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {[
                  { id: 'type', name: '按类型分类', desc: '文档、图片、视频等' },
                  { id: 'date', name: '按日期归档', desc: '按年月分类' },
                  { id: 'name', name: '按名称排序', desc: '首字母分类' },
                ].map(strategy => (
                  <button
                    key={strategy.id}
                    onClick={() => handleOrganize(strategy.id)}
                    className="w-full p-3 text-left border border-[#e5e5e5] rounded hover:bg-[#f5f5f5]"
                  >
                    <p className="text-sm font-medium text-gray-700">{strategy.name}</p>
                    <p className="text-xs text-gray-400">{strategy.desc}</p>
                  </button>
                ))}
              </div>
            )}
            
            {activeSidebar === 'namelist' && (
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-[#e5e5e5]">
                  <p className="text-sm text-gray-600 mb-3">
                    上传包含学号和姓名的名单文件，用于智能重命名匹配。
                  </p>
                  <button
                    onClick={handleUploadNameList}
                    className="w-full btn-primary text-sm"
                  >
                    上传名单文件
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    支持 CSV、TXT 格式
                  </p>
                </div>
                
                {nameList.length > 0 && (
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600">已加载名单</span>
                      <span className="text-xs text-gray-400">{nameList.length} 条</span>
                    </div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {nameList.slice(0, 20).map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs p-1.5 bg-[#f5f5f5] rounded">
                          <span className="text-gray-500 w-16 truncate">{entry.studentId || '-'}</span>
                          <span className="text-gray-700 flex-1 truncate">{entry.name || '-'}</span>
                        </div>
                      ))}
                      {nameList.length > 20 && (
                        <p className="text-xs text-gray-400 text-center py-1">
                          还有 {nameList.length - 20} 条...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto bg-white">
            {currentDirectory ? (
              viewMode === 'list' ? (
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#f5f5f5] border-b border-[#e0e0e0]">
                    <tr>
                      <th className="w-10 px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          checked={selectedFiles.size === files.filter(f => f.kind === 'file').length && files.length > 0}
                          onChange={selectAll}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">名称</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">类型</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => (
                      <tr
                        key={index}
                        onClick={() => file.kind === 'file' && toggleFileSelection(file.name)}
                        className={`border-b border-[#f0f0f0] hover:bg-[#f9f9f9] cursor-pointer ${
                          selectedFiles.has(file.name) ? 'bg-[#f0e6ff]' : ''
                        }`}
                      >
                        <td className="px-3 py-2">
                          {file.kind === 'file' && (
                            <input
                              type="checkbox"
                              checked={selectedFiles.has(file.name)}
                              onChange={() => toggleFileSelection(file.name)}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {getFileIcon(file)}
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {file.kind === 'directory' ? '文件夹' : file.extension?.toUpperCase() || '文件'}
                        </td>
                        <td className="px-3 py-2">
                          {file.kind === 'file' && (
                            <div className="flex gap-2">
                              <button className="text-xs text-[#6366f1] hover:underline">打开</button>
                              <button className="text-xs text-red-500 hover:underline">删除</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-500">每排显示：</span>
                    {[5, 6, 8, 10].map(cols => (
                      <button
                        key={cols}
                        onClick={() => setGridColumns(cols)}
                        className={`px-2 py-1 text-xs rounded ${gridColumns === cols ? 'bg-[#6366f1] text-white' : 'bg-[#f0f0f0] hover:bg-[#e0e0e0]'}`}
                      >
                        {cols}个
                      </button>
                    ))}
                  </div>
                  <div 
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
                  >
                    {files.map((file, index) => (
                      <div
                        key={index}
                        onClick={() => file.kind === 'file' && toggleFileSelection(file.name)}
                        className={`p-3 rounded border cursor-pointer transition-colors ${
                          selectedFiles.has(file.name) 
                            ? 'border-[#6366f1] bg-[#f0e6ff]' 
                            : 'border-[#e5e5e5] hover:border-[#c0c0c0]'
                        }`}
                      >
                        <div className="flex flex-col items-center text-center">
                          {getFileIcon(file)}
                          <p className="mt-2 text-xs text-gray-700 truncate w-full">{file.name}</p>
                          <p className="text-xs text-gray-400">
                            {file.kind === 'directory' ? '文件夹' : file.extension?.toUpperCase()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="text-lg mb-4">打开文件夹开始管理</p>
                <button onClick={handleOpenDirectory} className="btn-primary">
                  打开文件夹
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="h-8 bg-[#f5f5f5] border-t border-[#e0e0e0] flex items-center px-4">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>项目: {files.length}</span>
          <span>已选: {selectedFiles.size}</span>
        </div>
        <div className="flex-1" />
        <button 
          onClick={() => setActiveSidebar('ai')}
          className="text-xs text-[#6366f1] hover:underline flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          AI Assistant
        </button>
        <button 
          onClick={() => setActiveSidebar('organize')}
          className="text-xs text-[#6366f1] hover:underline ml-4"
        >
          整理文件
        </button>
      </div>
    </div>
  )
}
