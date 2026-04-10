import { useState } from 'react'
import { useLanguageStore } from '@/store/languageStore'
import { getTemplatesByCategory, getTemplateCategories, fillTemplate, EducationTemplate } from '@/utils/educationTemplates'

interface EducationPanelProps {
  onInsertTemplate: (content: string) => void
  onClose: () => void
}

export default function EducationPanel({ onInsertTemplate, onClose }: EducationPanelProps) {
  const { language } = useLanguageStore()
  const [selectedCategory, setSelectedCategory] = useState<string>('lesson_plan')
  const [selectedTemplate, setSelectedTemplate] = useState<EducationTemplate | null>(null)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [previewContent, setPreviewContent] = useState<string>('')
  
  const categories = getTemplateCategories()
  const templates = getTemplatesByCategory(selectedCategory as EducationTemplate['category'])
  
  const handleTemplateSelect = (template: EducationTemplate) => {
    setSelectedTemplate(template)
    const initialValues: Record<string, string> = {}
    template.sections.forEach(section => {
      initialValues[section.id] = ''
    })
    setFormValues(initialValues)
    setPreviewContent(template.content)
  }
  
  const handleValueChange = (sectionId: string, value: string) => {
    const newValues = { ...formValues, [sectionId]: value }
    setFormValues(newValues)
    
    if (selectedTemplate) {
      setPreviewContent(fillTemplate(selectedTemplate, newValues))
    }
  }
  
  const handleInsert = () => {
    if (previewContent) {
    onInsertTemplate(previewContent)
    onClose()
    }
  }
  
  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent)
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {language === 'zh' ? '教育模板库' : 'Education Templates'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-gray-200 p-4 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-500 mb-3">
              {language === 'zh' ? '模板分类' : 'Categories'}
            </h3>
            <div className="space-y-1">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id)
                    setSelectedTemplate(null)
                  }}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    selectedCategory === category.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{category.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{category.description}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex-1 flex">
            <div className="w-64 border-r border-gray-200 p-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-gray-500 mb-3">
                {language === 'zh' ? '选择模板' : 'Select Template'}
              </h3>
              <div className="space-y-2">
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`w-full text-left p-3 rounded border ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-sm text-gray-800">{template.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            {selectedTemplate ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 flex overflow-hidden">
                  <div className="w-80 border-r border-gray-200 p-4 overflow-y-auto">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      {language === 'zh' ? '填写内容' : 'Fill Content'}
                    </h3>
                    <div className="space-y-4">
                      {selectedTemplate.sections
                        .sort((a, b) => a.order - b.order)
                        .map(section => (
                          <div key={section.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {section.title}
                              {section.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {section.placeholder.length > 50 ? (
                              <textarea
                                value={formValues[section.id] || ''}
                                onChange={(e) => handleValueChange(section.id, e.target.value)}
                                placeholder={section.placeholder}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none"
                                rows={4}
                              />
                            ) : (
                              <input
                                type="text"
                                value={formValues[section.id] || ''}
                                onChange={(e) => handleValueChange(section.id, e.target.value)}
                                placeholder={section.placeholder}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      {language === 'zh' ? '预览' : 'Preview'}
                    </h3>
                    <div className="bg-white border border-gray-200 rounded p-4 min-h-[300px] whitespace-pre-wrap text-sm font-mono">
                      {previewContent}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded border border-gray-300"
                  >
                    {language === 'zh' ? '复制内容' : 'Copy'}
                  </button>
                  <button
                    onClick={handleInsert}
                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
                  >
                    {language === 'zh' ? '插入文档' : 'Insert'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">
                    {language === 'zh' ? '请从左侧选择一个模板' : 'Select a template from the left'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
