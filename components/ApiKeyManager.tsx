import { useState } from 'react'
import { modelService, GenerateOptions } from '@/utils/localAI/ModelService'
import { useLanguageStore } from '@/store/languageStore'

interface ApiKeyManagerProps {
  onClose?: () => void
}

export default function ApiKeyManager({ onClose }: ApiKeyManagerProps) {
  const { language } = useLanguageStore()
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('add')
  const [newKey, setNewKey] = useState<string>('')
  const [newEndpoint, setNewEndpoint] = useState<string>('')
  const [newProviderName, setNewProviderName] = useState<string>('')
  const [selectedPreset, setSelectedPreset] = useState<typeof API_PRESETS[0] | null>(null)
  const [testResult, setTestResult] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)

  const customProviders = modelService.getProviders().filter(p => p.type === 'custom')
  const apiKeys = modelService.getApiKeys()
  const usageStats = modelService.getUsageStats()

  const handleAddKey = () => {
    const isLocalProvider = selectedPreset?.local
    
    if (!newProviderName.trim()) return
    if (!isLocalProvider && !newKey.trim()) return

    const providerId = selectedPreset?.id || newProviderName.toLowerCase().replace(/\s+/g, '-')
    
    // 设置当前provider和model
    modelService.setCurrentProvider(providerId)
    if (selectedPreset?.model) {
      modelService.setCurrentModel(selectedPreset.model)
    }
    
    modelService.addCustomProvider({
      id: providerId,
      name: newProviderName.trim(),
      type: isLocalProvider ? (selectedPreset?.id === 'ollama' ? 'ollama' : 'localai') : 'custom',
      enabled: true,
      requiresApiKey: !isLocalProvider,
      endpoint: newEndpoint.trim() || selectedPreset?.endpoint || undefined,
      models: [{
        id: selectedPreset?.model || 'default',
        name: selectedPreset?.model || 'Default Model',
      }],
    })

    if (!isLocalProvider) {
      modelService.addApiKey({
        provider: providerId,
        key: newKey.trim(),
        endpoint: newEndpoint.trim() || undefined,
        isActive: true
      })
    }

    setNewKey('')
    setNewEndpoint('')
    setNewProviderName('')
    setSelectedPreset(null)
    setTestResult('')
    setActiveTab('manage')
  }

  const handleRemoveKey = (provider: string) => {
    modelService.removeApiKey(provider)
    modelService.removeCustomProvider(provider)
  }

  const handleTestKey = async (provider: string) => {
    setIsTesting(true)
    setTestResult('')

    // 临时切换到测试的provider
    const originalProvider = modelService.getCurrentProvider()
    modelService.setCurrentProvider(provider)

    const options: GenerateOptions = {
      maxTokens: 50,
      temperature: 0.7
    }

    const result = await modelService.generate('你好，请回复"测试成功"', options)

    // 恢复原来的provider
    modelService.setCurrentProvider(originalProvider)

    if (result.success) {
      setTestResult(`✅ ${language === 'zh' ? '测试成功' : 'Test successful'}: ${result.data}`)
    } else {
      setTestResult(`❌ ${language === 'zh' ? '测试失败' : 'Test failed'}: ${result.error || 'Unknown error'}`)
    }

    setIsTesting(false)
  }

  const texts = {
    zh: {
      title: 'API管理',
      add: '添加API',
      manage: '管理API',
      providerName: 'API名称',
      apiKey: 'API密钥',
      endpoint: 'API地址',
      endpointPlaceholder: '例如: https://api.example.com/v1/chat/completions',
      save: '保存',
      cancel: '取消',
      test: '测试',
      delete: '删除',
      active: '已激活',
      noApis: '暂无API，请添加您的API',
      usage: '使用统计',
      totalRequests: '总请求数',
      totalTokens: '总Token数',
      errors: '错误记录',
      description: '添加您自己的API密钥，支持OpenAI、Claude、DeepSeek等第三方API',
      tips: '提示：请确保您的API地址和密钥正确，测试通过后即可使用',
      freeModel: '本地模型',
      freeModelDesc: '完全免费，无需API密钥',
      free: '免费',
      presets: '常用API预设',
      presetDeepSeek: 'DeepSeek（免费额度）',
      presetMoonshot: 'Moonshot（免费额度）',
      presetZhipu: '智谱AI（免费额度）',
      presetQwen: '通义千问（免费额度）',
      presetOpenAI: 'OpenAI（需付费）',
      presetClaude: 'Claude（需付费）',
      presetCustom: '自定义API'
    },
    en: {
      title: 'API Management',
      add: 'Add API',
      manage: 'Manage APIs',
      providerName: 'API Name',
      apiKey: 'API Key',
      endpoint: 'API Endpoint',
      endpointPlaceholder: 'e.g., https://api.example.com/v1/chat/completions',
      save: 'Save',
      cancel: 'Cancel',
      test: 'Test',
      delete: 'Delete',
      active: 'Active',
      noApis: 'No APIs, please add your API',
      usage: 'Usage Statistics',
      totalRequests: 'Total Requests',
      totalTokens: 'Total Tokens',
      errors: 'Errors',
      description: 'Add your own API key, supports OpenAI, Claude, DeepSeek and other third-party APIs',
      tips: 'Tip: Make sure your API address and key are correct, test before use',
      freeModel: 'Local Model',
      freeModelDesc: 'Free, no API key required',
      free: 'Free',
      presets: 'Common API Presets',
      presetDeepSeek: 'DeepSeek (Free Tier)',
      presetMoonshot: 'Moonshot (Free Tier)',
      presetZhipu: 'Zhipu AI (Free Tier)',
      presetQwen: 'Qwen (Free Tier)',
      presetOpenAI: 'OpenAI (Paid)',
      presetClaude: 'Claude (Paid)',
      presetCustom: 'Custom API'
    }
  }

  const API_PRESETS = [
    {
      id: 'ollama',
      name: 'Ollama',
      endpoint: 'http://localhost:11434/api/chat',
      model: 'qwen2.5:7b',
      free: true,
      local: true,
      description: language === 'zh' ? '本地运行，安装简单，推荐首选' : 'Run locally, easy install, recommended',
      apiKeyUrl: '',
      apiKeyNote: language === 'zh' ? '无需API密钥，需要先安装Ollama' : 'No API key required, install Ollama first',
      setupScript: 'scripts/ollama/start-ollama.ps1'
    },
    {
      id: 'localai',
      name: 'LocalAI',
      endpoint: 'http://localhost:8080/v1/chat/completions',
      model: 'qwen2.5-7b-instruct',
      free: true,
      local: true,
      description: language === 'zh' ? '本地运行，功能全面，需Docker' : 'Run locally, full features, needs Docker',
      apiKeyUrl: '',
      apiKeyNote: language === 'zh' ? '无需API密钥，需要先启动LocalAI服务' : 'No API key required, start LocalAI service first',
      setupScript: 'scripts/localai/start-localai.ps1'
    },
    {
      id: 'glm47',
      name: 'GLM-4.7',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4.7-flash',
      free: true,
      description: language === 'zh' ? '免费开源，轻量化混合专家模型' : 'Free open source, lightweight mixture-of-experts model',
      apiKeyUrl: 'https://open.bigmodel.cn/',
      apiKeyNote: language === 'zh' ? '注册智谱AI账号后，在控制台获取API密钥' : 'Register at Zhipu AI and get API key from console'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat',
      free: true,
      description: language === 'zh' ? '免费额度，支持长文本' : 'Free tier, supports long context',
      apiKeyUrl: 'https://platform.deepseek.com/',
      apiKeyNote: language === 'zh' ? '注册DeepSeek账号后，在API设置中获取密钥' : 'Register at DeepSeek and get API key from API settings'
    },
    {
      id: 'moonshot',
      name: 'Moonshot',
      endpoint: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'moonshot-v1-8k',
      free: true,
      description: language === 'zh' ? '免费额度，支持长文本' : 'Free tier, supports long context',
      apiKeyUrl: 'https://platform.moonshot.cn/',
      apiKeyNote: language === 'zh' ? '注册Moonshot账号后，在API密钥页面获取' : 'Register at Moonshot and get API key from API key page'
    },
    {
      id: 'zhipu',
      name: '智谱AI',
      endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      model: 'glm-4-flash',
      free: true,
      description: language === 'zh' ? '免费额度，国产大模型' : 'Free tier, Chinese AI model',
      apiKeyUrl: 'https://open.bigmodel.cn/',
      apiKeyNote: language === 'zh' ? '注册智谱AI账号后，在控制台获取API密钥' : 'Register at Zhipu AI and get API key from console'
    },
    {
      id: 'qwen',
      name: '通义千问',
      endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      model: 'qwen-turbo',
      free: true,
      description: language === 'zh' ? '免费额度，阿里云大模型' : 'Free tier, Alibaba AI model',
      apiKeyUrl: 'https://dashscope.aliyun.com/',
      apiKeyNote: language === 'zh' ? '注册阿里云账号后，在DashScope控制台获取API密钥' : 'Register at Alibaba Cloud and get API key from DashScope console'
    },
    {
      id: 'kimi',
      name: 'Kimi K2.5',
      endpoint: 'https://api.moonshot.cn/v1/chat/completions',
      model: 'kimi-k2.5',
      free: true,
      description: language === 'zh' ? '免费开源，万亿参数大模型' : 'Free open source, trillion-parameter model',
      apiKeyUrl: 'https://platform.moonshot.cn/',
      apiKeyNote: language === 'zh' ? '注册Moonshot账号后，在API密钥页面获取' : 'Register at Moonshot and get API key from API key page'
    }
  ]

  const handlePresetSelect = (preset: typeof API_PRESETS[0]) => {
    setNewProviderName(preset.name)
    setNewEndpoint(preset.endpoint)
    setSelectedPreset(preset)
  }

  const t = texts[language === 'zh' ? 'zh' : 'en']

  return (
    <div className="bg-white rounded-lg shadow-lg w-[480px] max-h-[600px] overflow-hidden border border-[#e5e5e5]">
      <div className="bg-white border-b border-[#e5e5e5] px-5 py-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{t.title}</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex border-b border-[#e5e5e5]">
        {(['add', 'manage'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-[#2b5797] border-b-2 border-[#2b5797]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t[tab]}
          </button>
        ))}
      </div>

      <div className="p-5 overflow-y-auto max-h-[450px]">
        {activeTab === 'add' && (
          <div className="space-y-4">
            <div className="bg-[#f5f5f5] rounded-lg p-4">
              <p className="text-sm text-gray-600">{t.description}</p>
              <p className="text-xs text-gray-400 mt-2">{t.tips}</p>

            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.presets}</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {API_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`p-3 border rounded-lg text-left transition-colors ${
                      newProviderName === preset.name 
                        ? 'border-[#2b5797] bg-[#f0f5fb]' 
                        : 'border-[#e5e5e5] hover:border-[#c0c0c0] bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">{preset.name}</span>
                      {preset.local && (
                        <span className="text-xs bg-[#2b5797] text-white px-1.5 py-0.5 rounded whitespace-nowrap">{language === 'zh' ? '本地' : 'Local'}</span>
                      )}
                      {preset.free && !preset.local && (
                        <span className="text-xs bg-[#107c10] text-white px-1.5 py-0.5 rounded whitespace-nowrap">{t.free}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.providerName}</label>
                <input
                  type="text"
                  value={newProviderName}
                  onChange={e => setNewProviderName(e.target.value)}
                  placeholder="例如: OpenAI、Claude、DeepSeek"
                  className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:border-[#2b5797] focus:ring-1 focus:ring-[#2b5797]"
                />
              </div>
              
              {!selectedPreset?.local && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t.apiKey}</label>
                  <input
                    type="password"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:border-[#2b5797] focus:ring-1 focus:ring-[#2b5797]"
                  />
                  {selectedPreset && selectedPreset.apiKeyUrl && (
                    <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">{selectedPreset.apiKeyNote}</p>
                      <a 
                        href={selectedPreset.apiKeyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {language === 'zh' ? '前往获取API密钥' : 'Get API Key'}
                      </a>
                    </div>
                  )}
                </div>
              )}
              
              {selectedPreset?.local && (
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-700 font-medium">
                    {selectedPreset.id === 'ollama' 
                      ? (language === 'zh' ? 'Ollama 本地模型' : 'Ollama Local Model')
                      : (language === 'zh' ? 'LocalAI 本地模型' : 'LocalAI Local Model')}
                  </p>
                  <p className="text-xs text-green-600 mt-1">{language === 'zh' ? '无需API密钥，数据完全本地处理' : 'No API key required, data processed locally'}</p>
                  <p className="text-xs text-green-600 mt-1">
                    {language === 'zh' ? '首次使用请运行: ' : 'First time? Run: '}
                    <code className="bg-green-100 px-1 rounded">
                      {selectedPreset.id === 'ollama' ? '.\scripts\ollama\start-ollama.ps1' : '.\scripts\localai\start-localai.ps1'}
                    </code>
                  </p>
                  {selectedPreset.id === 'ollama' && (
                    <p className="text-xs text-green-600 mt-1">
                      {language === 'zh' ? '下载地址: ' : 'Download: '}
                      <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="underline">ollama.com/download</a>
                    </p>
                  )}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.endpoint}</label>
                <input
                  type="text"
                  value={newEndpoint}
                  onChange={e => setNewEndpoint(e.target.value)}
                  placeholder={t.endpointPlaceholder}
                  className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg text-sm focus:outline-none focus:border-[#2b5797] focus:ring-1 focus:ring-[#2b5797]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddKey}
                disabled={!newProviderName.trim() || (!selectedPreset?.local && !newKey.trim())}
                className="flex-1 py-2 bg-[#2b5797] text-white rounded-lg text-sm font-medium hover:bg-[#1e3f6f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.save}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border border-[#e5e5e5] text-gray-700 rounded-lg text-sm hover:bg-[#f5f5f5] transition-colors"
              >
                {t.cancel}
              </button>
            </div>

            {testResult && (
              <div className="p-3 bg-[#f5f5f5] rounded-lg text-sm">
                {testResult}
              </div>
            )}

            <div className="mt-4 p-4 bg-[#e8f0f8] rounded-lg border border-[#d0e0f0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#2b5797] rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">L</span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-800">{t.freeModel}</h4>
                  <p className="text-xs text-gray-500">{t.freeModelDesc}</p>
                </div>
                <span className="ml-auto text-xs bg-[#107c10] text-white px-2 py-0.5 rounded whitespace-nowrap">{t.free}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="space-y-4">
            {apiKeys.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-[#f5f5f5] rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <p className="text-gray-500">{t.noApis}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key, index) => (
                  <div
                    key={index}
                    className="border border-[#e5e5e5] rounded-lg p-4 hover:border-[#c0c0c0] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#f5f5f5] rounded flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600">
                              {customProviders.find(p => p.id === key.provider)?.name?.charAt(0) || 'A'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">
                              {customProviders.find(p => p.id === key.provider)?.name || key.provider}
                            </p>
                            <p className="text-xs text-gray-400">
                              {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                            </p>
                          </div>
                        </div>
                        {key.endpoint && (
                          <p className="text-xs text-gray-400 mt-2 ml-10 truncate">{key.endpoint}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1 ml-10">
                          {t.active} | {language === 'zh' ? '使用次数' : 'Usage'}: {key.usageCount}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTestKey(key.provider)}
                          className="px-3 py-1.5 text-xs border border-[#2b5797] text-[#2b5797] rounded hover:bg-[#f0f5fb] transition-colors"
                          disabled={isTesting}
                        >
                          {t.test}
                        </button>
                        <button
                          onClick={() => handleRemoveKey(key.provider)}
                          className="px-3 py-1.5 text-xs border border-[#d83b01] text-[#d83b01] rounded hover:bg-[#fff0e6] transition-colors"
                        >
                          {t.delete}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {testResult && (
              <div className="p-3 bg-[#f5f5f5] rounded-lg text-sm">
                {testResult}
              </div>
            )}

            <div className="pt-4 border-t border-[#e5e5e5]">
              <h4 className="font-medium text-gray-700 mb-3">{t.usage}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f5f5f5] rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-800">{usageStats.totalRequests}</p>
                  <p className="text-xs text-gray-500">{t.totalRequests}</p>
                </div>
                <div className="bg-[#f5f5f5] rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-800">{usageStats.totalTokens.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{t.totalTokens}</p>
                </div>
              </div>

              {usageStats.errors.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-[#d83b01] mb-2">{t.errors}</h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {usageStats.errors.slice(-5).map((error, index) => (
                      <div key={index} className="text-xs p-2 bg-[#fff0e6] rounded text-[#d83b01]">
                        <span className="font-mono">{error.code}</span>: {error.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
