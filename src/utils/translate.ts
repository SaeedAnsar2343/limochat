// Real-time Translation Utility using free Google Translate service
export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'tl', name: 'Filipino / Tagalog', nativeName: 'Tagalog' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
];

export async function translateText(
  text: string, 
  targetLang: string = 'en',
  sourceLang: string = 'auto'
): Promise<{ translatedText: string; detectedSourceLanguage: string }> {
  if (!text || !text.trim()) {
    return { translatedText: '', detectedSourceLanguage: 'auto' };
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(
      text
    )}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Google translate returns nested arrays: [[[translatedChunk, originalChunk, ...], ...], detectedLang]
    if (data && Array.isArray(data[0])) {
      const translated = data[0].map((chunk: any) => chunk[0]).join('');
      const detectedLang = data[2] || 'auto';
      return {
        translatedText: translated,
        detectedSourceLanguage: detectedLang,
      };
    }

    return {
      translatedText: text,
      detectedSourceLanguage: 'auto',
    };
  } catch (error) {
    console.warn("Translation failed, falling back to original:", error);
    return {
      translatedText: text,
      detectedSourceLanguage: 'auto',
    };
  }
}
