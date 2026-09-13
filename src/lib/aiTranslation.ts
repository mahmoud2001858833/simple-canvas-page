import { supabase } from '@/integrations/supabase/client';

// Translation AI Key configured by the platform administrator
const TRANSLATION_AI_KEY = atob('QVEuQWI4Uk42TFZLU2xhRUdwaG5hVUd1am9kMFBqc0stOHhFMURHMEhFWGVud3p5UFZHMXc=');

interface TranslateParams {
  text: string;
  sourceLang: 'ar' | 'en' | string;
  targetLang: 'ar' | 'en' | string;
}

/**
 * Translates text between Arabic and English using Gemini 2.5 Flash with edge function fallback.
 */
export async function translateTextWithAI({ text, sourceLang, targetLang }: TranslateParams): Promise<string> {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';

  const src = sourceLang === 'en' ? 'English' : 'Arabic';
  const tgt = targetLang === 'ar' ? 'Arabic' : 'English';

  // Primary: Direct call to Gemini OpenAI-compatible endpoint with model fallback
  const TRANSLATION_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ];

  for (const model of TRANSLATION_MODELS) {
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TRANSLATION_AI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a professional educational translator. Translate the text accurately and naturally from ${src} to ${tgt}. Preserve all formatting, line breaks, bullet points, and terms. Return ONLY the translation, with no preface, explanations, or enclosing quotes.`,
            },
            { role: 'user', content: trimmed },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const translated = data?.choices?.[0]?.message?.content?.trim();
        if (translated) {
          return translated;
        }
      } else {
        console.warn(`Translation model ${model} returned status ${response.status}, trying next...`);
      }
    } catch (err) {
      console.warn(`Translation model ${model} call error:`, err);
    }
  }

  // Native Gemini generateContent fallback
  try {
    const nativeRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${TRANSLATION_AI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{
              text: `Translate the following text accurately from ${src} to ${tgt}. Return ONLY the translation:\n\n${trimmed}`
            }]
          }]
        })
      }
    );
    if (nativeRes.ok) {
      const nativeData = await nativeRes.json();
      const nativeText = nativeData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (nativeText) return nativeText;
    }
  } catch (nativeErr) {
    console.warn('Native Gemini translation fallback error:', nativeErr);
  }

  // Fallback: Supabase Edge function
  try {
    const { data, error } = await supabase.functions.invoke('translate-course-description', {
      body: { text: trimmed, sourceLang, targetLang },
    });
    if (!error && data?.translated) {
      return data.translated;
    }
  } catch (edgeErr) {
    console.error('Edge function translation fallback error:', edgeErr);
  }

  throw new Error('Failed to translate text. Please try again.');
}
