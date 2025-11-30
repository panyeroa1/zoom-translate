
export const LANGUAGES = [
  'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Azerbaijani', 'Basque', 'Bengali', 'Bosnian', 
  'Bulgarian', 'Catalan', 'Cebuano', 'Chinese (Mandarin)', 'Chinese (Cantonese)', 'Corsican', 'Croatian', 
  'Czech', 'Danish', 'Dutch', 'English', 'Esperanto', 'Estonian', 'Finnish', 'French', 'Frisian', 'Galician', 
  'Georgian', 'German', 'Greek', 'Gujarati', 'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew', 'Hindi', 
  'Hmong', 'Hungarian', 'Icelandic', 'Igbo', 'Indonesian', 'Irish', 'Italian', 'Japanese', 'Javanese', 
  'Kannada', 'Kazakh', 'Khmer', 'Korean', 'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lithuanian', 
  'Luxembourgish', 'Macedonian', 'Malagasy', 'Malay', 'Malayalam', 'Maltese', 'Maori', 'Marathi', 
  'Mongolian', 'Myanmar (Burmese)', 'Nepali', 'Norwegian', 'Nyanja (Chichewa)', 'Pashto', 'Persian', 
  'Polish', 'Portuguese', 'Punjabi', 'Romanian', 'Russian', 'Samoan', 'Scots Gaelic', 'Serbian', 'Sesotho', 
  'Shona', 'Sindhi', 'Sinhala (Sinhalese)', 'Slovak', 'Slovenian', 'Somali', 'Spanish', 'Sundanese', 
  'Swahili', 'Swedish', 'Tagalog (Filipino)', 'Tajik', 'Tamil', 'Telugu', 'Thai', 'Turkish', 'Ukrainian', 
  'Urdu', 'Uzbek', 'Vietnamese', 'Welsh', 'Xhosa', 'Yiddish', 'Yoruba', 'Zulu'
];

const CODE_MAP: Record<string, string> = {
  'Afrikaans': 'af-ZA', 'Amharic': 'am-ET', 'Arabic': 'ar-SA', 'Bengali': 'bn-IN', 'Bulgarian': 'bg-BG',
  'Catalan': 'ca-ES', 'Chinese (Mandarin)': 'zh-CN', 'Chinese (Cantonese)': 'zh-HK', 'Croatian': 'hr-HR',
  'Czech': 'cs-CZ', 'Danish': 'da-DK', 'Dutch': 'nl-NL', 'English': 'en-US', 'Estonian': 'et-EE',
  'Filipino': 'fil-PH', 'Finnish': 'fi-FI', 'French': 'fr-FR', 'German': 'de-DE', 'Greek': 'el-GR',
  'Gujarati': 'gu-IN', 'Hebrew': 'he-IL', 'Hindi': 'hi-IN', 'Hungarian': 'hu-HU', 'Icelandic': 'is-IS',
  'Indonesian': 'id-ID', 'Italian': 'it-IT', 'Japanese': 'ja-JP', 'Kannada': 'kn-IN', 'Korean': 'ko-KR',
  'Latvian': 'lv-LV', 'Lithuanian': 'lt-LT', 'Malay': 'ms-MY', 'Malayalam': 'ml-IN', 'Marathi': 'mr-IN',
  'Norwegian': 'nb-NO', 'Polish': 'pl-PL', 'Portuguese': 'pt-PT', 'Romanian': 'ro-RO', 'Russian': 'ru-RU',
  'Serbian': 'sr-RS', 'Slovak': 'sk-SK', 'Slovenian': 'sl-SI', 'Spanish': 'es-ES', 'Swahili': 'sw-KE',
  'Swedish': 'sv-SE', 'Tagalog (Filipino)': 'tl-PH', 'Tamil': 'ta-IN', 'Telugu': 'te-IN', 'Thai': 'th-TH',
  'Turkish': 'tr-TR', 'Ukrainian': 'uk-UA', 'Urdu': 'ur-PK', 'Vietnamese': 'vi-VN', 'Welsh': 'cy-GB',
  'Zulu': 'zu-ZA'
};

export function getLanguageCode(languageName: string): string {
  return CODE_MAP[languageName] || 'en-US';
}
