// Speaker mapping for different languages - using bulbul:v2 compatible speakers
const LANGUAGE_SPEAKERS = {
  'hi-IN': 'manisha', // Hindi speaker - compatible with bulbul:v2
  'en-IN': 'anushka', // English speaker
  'bn-IN': 'vidya',   // Bengali speaker
  'gu-IN': 'arya',    // Gujarati speaker
  'kn-IN': 'karun',   // Kannada speaker
  'ml-IN': 'vidya',   // Malayalam speaker
  'mr-IN': 'manisha', // Marathi speaker
  'ne-NP': 'abhilash', // Nepali speaker
  'or-IN': 'vidya',   // Odia speaker
  'pa-IN': 'hitesh',  // Punjabi speaker
  'ta-IN': 'arya',    // Tamil speaker
  'te-IN': 'karun',   // Telugu speaker
  'ur-IN': 'abhilash' // Urdu speaker
};

/**
 * Clean markdown and formatting from text
 * @param {string} text - Raw text with markdown
 * @returns {string} - Clean text for TTS
 */
function cleanTextForTTS(text) {
  if (!text) return '';
  
  let cleaned = text
    // Remove markdown headers but keep content
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italic markers but keep content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove inline code markers but keep content
    .replace(/`([^`]+)`/g, '$1')
    // Remove code blocks completely (they're usually not readable)
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove blockquotes markers but keep content
    .replace(/^>\s*/gm, '')
    // Remove list markers but keep content
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Replace multiple newlines with period and space
    .replace(/\n\s*\n/g, '. ')
    // Replace single newlines with spaces
    .replace(/\n/g, ' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
    
  return cleaned;
}

/**
 * Identify language of text using comprehensive regex patterns
 * @param {string} text - Text to identify language for
 * @returns {string} - Language code
 */
function identifyLanguage(text) {
  const cleanText = cleanTextForTTS(text);
  if (!cleanText || cleanText.length < 3) {
    return 'en-IN'; // Default to English
  }

  // Comprehensive Unicode ranges for Indian languages
  const languagePatterns = {
    // Hindi - Devanagari script
    'hi-IN': /[\u0900-\u097F]/,
    
    // Bengali - Bengali script
    'bn-IN': /[\u0980-\u09FF]/,
    
    // Gujarati - Gujarati script
    'gu-IN': /[\u0A80-\u0AFF]/,
    
    // Kannada - Kannada script
    'kn-IN': /[\u0C80-\u0CFF]/,
    
    // Malayalam - Malayalam script
    'ml-IN': /[\u0D00-\u0D7F]/,
    
    // Marathi - Devanagari script (same as Hindi but check for Marathi-specific words)
    'mr-IN': /[\u0900-\u097F]/,
    
    // Nepali - Devanagari script
    'ne-NP': /[\u0900-\u097F]/,
    
    // Odia - Odia script
    'or-IN': /[\u0B00-\u0B7F]/,
    
    // Punjabi - Gurmukhi script
    'pa-IN': /[\u0A00-\u0A7F]/,
    
    // Tamil - Tamil script
    'ta-IN': /[\u0B80-\u0BFF]/,
    
    // Telugu - Telugu script
    'te-IN': /[\u0C00-\u0C7F]/,
    
    // Urdu - Arabic script
    'ur-IN': /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  };

  // Check each language pattern
  for (const [langCode, pattern] of Object.entries(languagePatterns)) {
    if (pattern.test(cleanText)) {
      // Special handling for Devanagari script (Hindi/Marathi/Nepali)
      if (langCode === 'mr-IN' && /[\u0900-\u097F]/.test(cleanText)) {
        // Common Marathi words/patterns to distinguish from Hindi
        const marathiWords = /\b(आहे|आहेत|होता|होते|करते|करतो|मराठी|महाराष्ट्र|मुंबई|पुणे)\b/;
        if (marathiWords.test(cleanText)) {
          return 'mr-IN';
        }
      }
      
      if (langCode === 'ne-NP' && /[\u0900-\u097F]/.test(cleanText)) {
        // Common Nepali words/patterns to distinguish from Hindi
        const nepaliWords = /\b(छ|छु|छौं|थियो|गर्छु|नेपाल|काठमाडौं)\b/;
        if (nepaliWords.test(cleanText)) {
          return 'ne-NP';
        }
      }
      
      // For Hindi, return if no specific Marathi/Nepali patterns found
      if (langCode === 'hi-IN' && /[\u0900-\u097F]/.test(cleanText)) {
        const marathiWords = /\b(आहे|आहेत|होता|होते|करते|करतो|मराठी|महाराष्ट्र|मुंबई|पुणे)\b/;
        const nepaliWords = /\b(छ|छु|छौं|थियो|गर्छु|नेपाल|काठमाडौं)\b/;
        if (!marathiWords.test(cleanText) && !nepaliWords.test(cleanText)) {
          return 'hi-IN';
        }
      }
      
      // For other languages, return immediately
      if (!['mr-IN', 'ne-NP', 'hi-IN'].includes(langCode)) {
        return langCode;
      }
    }
  }

  // Additional check for English with Latin script
  const englishPattern = /^[a-zA-Z0-9\s.,!?;:()\-'"]+$/;
  if (englishPattern.test(cleanText.replace(/[^\w\s.,!?;:()\-'"]/g, ''))) {
    // If text is mostly Latin characters, it's likely English
    const latinRatio = (cleanText.match(/[a-zA-Z]/g) || []).length / cleanText.length;
    if (latinRatio > 0.7) {
      return 'en-IN';
    }
  }

  // Default fallback
  return 'en-IN';
}

/**
 * Split long text into smaller chunks for TTS processing
 * @param {string} text - Text to split
 * @param {number} maxLength - Maximum length per chunk
 * @returns {Array<string>} - Array of text chunks
 */
function splitTextIntoChunks(text, maxLength = 250) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  // Split by sentences using Hindi and English punctuation
  const sentences = text.split(/[।\.\!\?\n]+/).filter(s => s.trim().length > 0);
  let currentChunk = '';

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    
    if (!sentence) continue;
    
    // If this single sentence exceeds maxLength, split it by words
    if (sentence.length > maxLength) {
      // Save current chunk if not empty
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Split long sentence by words and create word-based chunks
      const words = sentence.split(/\s+/);
      let wordChunk = '';
      
      for (const word of words) {
        const testChunk = wordChunk + (wordChunk.length > 0 ? ' ' : '') + word;
        if (testChunk.length > maxLength && wordChunk.length > 0) {
          chunks.push(wordChunk.trim());
          wordChunk = word;
        } else {
          wordChunk = testChunk;
        }
      }
      
      if (wordChunk.trim().length > 0) {
        currentChunk = wordChunk.trim();
      }
      continue;
    }
    
    // Test if adding this sentence would exceed the limit
    const testChunk = currentChunk + (currentChunk.length > 0 ? ' ' : '') + sentence;
    
    if (testChunk.length > maxLength && currentChunk.length > 0) {
      // Save current chunk and start new one with this sentence
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = testChunk;
    }
  }
  
  // Add the last chunk if not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Combine multiple base64 audio chunks into single audio
 * @param {Array<string>} audioChunks - Array of base64 audio data
 * @returns {Promise<string>} - Combined base64 audio data
 */
async function combineAudioChunks(audioChunks) {
  if (audioChunks.length === 1) {
    return audioChunks[0];
  }
  
  try {
    // Convert base64 chunks to buffers
    const audioBuffers = audioChunks.map(chunk => Buffer.from(chunk, 'base64'));
    
    // Extract audio data from each WAV file (skip 44-byte header)
    const audioDataChunks = [];
    let totalDataSize = 0;
    
    audioBuffers.forEach((buffer, index) => {
      if (buffer.length > 44) {
        if (index === 0) {
          // Keep entire first file as base
          audioDataChunks.push(buffer);
          totalDataSize = buffer.readUInt32LE(40); // Original data size
        } else {
          // Extract only audio data from subsequent files (skip 44-byte header)
          const audioData = buffer.slice(44);
          audioDataChunks.push(audioData);
          totalDataSize += audioData.length;
        }
      }
    });
    
    // Combine all audio data
    const combinedBuffer = Buffer.concat(audioDataChunks);
    
    // Update WAV header with new file size and data size
    if (combinedBuffer.length > 44) {
      // Update file size in header (bytes 4-7): total file size - 8
      combinedBuffer.writeUInt32LE(combinedBuffer.length - 8, 4);
      
      // Update data chunk size in header (bytes 40-43): total audio data size
      combinedBuffer.writeUInt32LE(totalDataSize, 40);
    }
    
    // Convert back to base64
    const combinedBase64 = combinedBuffer.toString('base64');
    
    return combinedBase64;
    
  } catch (error) {
    // Fallback: return first chunk only
    return audioChunks[0];
  }
}

/**
 * Synthesize speech using Sarvam TTS API
 * @param {Object} options - TTS options
 * @param {string} options.text - Text to synthesize
 * @param {string} options.lang - Language code (optional, will auto-detect if not provided)
 * @returns {Promise<string>} - Base64 audio data or audio URL
 */
export async function synthesize({ text, lang }) {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for synthesis');
    }

    if (!process.env.SARVAM_TTS_API_KEY) {
      throw new Error('Sarvam API key not configured');
    }

    // Clean the text for TTS
    let cleanText = cleanTextForTTS(text);
    
    if (!cleanText || cleanText.length === 0) {
      throw new Error('No valid text after cleaning for TTS');
    }



    // Identify language if not provided
    let targetLanguage = lang;
    if (!targetLanguage) {
      targetLanguage = identifyLanguage(text);
    } else {
      // Use provided language directly (should be in correct format)
      targetLanguage = lang;
    }

    // Get appropriate speaker for the language
    const speaker = LANGUAGE_SPEAKERS[targetLanguage] || 'anushka';
    
    // Sarvam TTS has a ~680KB output limit, which corresponds to about 250 characters of Hindi text
    // Split text into chunks if too long to handle this limitation
    if (cleanText.length > 250) {
      const textChunks = splitTextIntoChunks(cleanText, 250);
      if (textChunks.length > 1) {
        return await processTextChunks(textChunks, targetLanguage, speaker);
      }
    }
    
    // Prepare TTS parameters with language-specific optimizations
    const ttsParams = {
      target_language_code: targetLanguage,
      speaker: speaker,
      text: cleanText,
      pitch: 0,
      pace: targetLanguage === 'hi-IN' ? 0.8 : 0.9, // Slightly slower for Hindi
      loudness: 1.0,
      speech_sample_rate: 22050,
      enable_preprocessing: true,
      model: 'bulbul:v2'
    };
    
    // Call Sarvam TTS API
    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_TTS_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(ttsParams)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sarvam TTS API error:', response.status, errorText);
      throw new Error(`TTS API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    if (result.audio_data) {
      return result.audio_data;
    } else if (result.audios && result.audios.length > 0) {
      return result.audios[0];
    } else {
      throw new Error('No audio data received from TTS API');
    }

  } catch (error) {
    console.error('TTS synthesis error:', error);
    throw error;
  }
}

/**
 * Process multiple text chunks and combine their audio
 * @param {Array<string>} textChunks - Array of text chunks
 * @param {string} targetLanguage - Target language code
 * @param {string} speaker - Speaker name
 * @returns {Promise<string>} - Combined base64 audio data
 */
async function processTextChunks(textChunks, targetLanguage, speaker) {
  const audioChunks = [];
  
  for (let i = 0; i < textChunks.length; i++) {
    const chunk = textChunks[i];
    
    try {
      // Prepare TTS parameters for this chunk
      const ttsParams = {
        target_language_code: targetLanguage,
        speaker: speaker,
        text: chunk,
        pitch: 0,
        pace: targetLanguage === 'hi-IN' ? 0.8 : 0.9,
        loudness: 1.0,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: 'bulbul:v2'
      };
      
      // Call Sarvam TTS API for this chunk
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': process.env.SARVAM_TTS_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify(ttsParams)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Chunk ${i + 1} TTS API error:`, response.status, errorText);
        throw new Error(`TTS API failed for chunk ${i + 1}: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.audio_data) {
        audioChunks.push(result.audio_data);
      } else if (result.audios && result.audios.length > 0) {
        audioChunks.push(result.audios[0]);
      } else {
        throw new Error(`No audio data received for chunk ${i + 1}`);
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < textChunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      throw error;
    }
  }
  
  // Combine all audio chunks
  return await combineAudioChunks(audioChunks);
}
