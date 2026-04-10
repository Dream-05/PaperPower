import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Language, getAvailableLanguages } from '@/i18n'

interface LanguageState {
  language: Language
  availableLanguages: Language[]
  setLanguage: (lang: Language) => void
  cycleLanguage: () => void
  getLanguageName: (lang: Language) => string
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: 'zh',
      availableLanguages: getAvailableLanguages(),
      setLanguage: (lang) => set({ language: lang }),
      cycleLanguage: () => {
        const current = get().language
        const langs = get().availableLanguages
        const currentIndex = langs.indexOf(current)
        const nextIndex = (currentIndex + 1) % langs.length
        set({ language: langs[nextIndex] })
      },
      getLanguageName: (lang: Language) => {
        const names: Record<Language, string> = {
          en: 'English',
          zh: '中文',
          ja: '日本語',
          ko: '한국어',
          es: 'Español',
          fr: 'Français',
          de: 'Deutsch',
          ru: 'Русский',
          ar: 'العربية',
          pt: 'Português',
          it: 'Italiano',
          nl: 'Nederlands',
          pl: 'Polski',
          tr: 'Türkçe',
          vi: 'Tiếng Việt',
          th: 'ไทย',
          id: 'Bahasa Indonesia',
          ms: 'Bahasa Melayu',
          hi: 'हिन्दी',
          bn: 'বাংলা'
        }
        return names[lang] || lang
      }
    }),
    {
      name: 'zhiban-language',
    }
  )
)
