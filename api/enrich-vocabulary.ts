import { GoogleGenAI, Type } from '@google/genai';

let aiClient: GoogleGenAI | null = null;

function getAIClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export default async function handler(req: any, res: any) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { word, definition } = req.body;
    if (!word) {
      res.status(400).json({ error: 'Word parameter is required' });
      return;
    }

    const ai = getAIClient();
    const prompt = `You are an expert IELTS English-Vietnamese dictionary assistant.
For the word or phrase "${word}"${definition ? ` (original meaning/notes: "${definition}")` : ''}, generate:
1. Standard IPA (International Phonetic Alphabet, UK or US style, e.g. /ˌrez.əˈveɪ.ʃən/).
2. Accurate and natural English meaning/definition.
3. Accurate and natural Vietnamese translation/meaning.
4. Common high-yielding IELTS collocations (comma-separated, e.g. make a reservation, confirm a reservation).
5. A high-quality, practical IELTS-level example sentence in English using this word.
6. Vietnamese translation of that example sentence.
7. Word synonyms (comma-separated).

Provide the response in structured JSON format matching the schema. Ensure fields are concise, helpful, and natural.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING },
        ipa: { type: Type.STRING, description: 'IPA pronunciation, e.g. /.../' },
        meaning: { type: Type.STRING, description: 'English meaning/definition' },
        vietnameseMeaning: { type: Type.STRING, description: 'Vietnamese meaning/definition' },
        collocation: { type: Type.STRING, description: 'Common collocations, comma-separated' },
        example: { type: Type.STRING, description: 'An English example sentence' },
        exampleTranslation: { type: Type.STRING, description: 'Vietnamese translation of the example sentence' },
        synonym: { type: Type.STRING, description: 'Synonyms, comma-separated' }
      },
      required: ['word', 'ipa', 'meaning', 'vietnameseMeaning', 'collocation', 'example', 'exampleTranslation', 'synonym']
    };

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema
        }
      });
    } catch (err) {
      console.warn('Primary model gemini-3.1-flash-lite failed, trying fallback model gemini-3.5-flash:', err);
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema
        }
      });
    }

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error('No text returned from Gemini');
    }

    const parsedData = JSON.parse(jsonText);
    res.status(200).json(parsedData);
  } catch (error: any) {
    console.error('Error enriching vocabulary:', error);
    res.status(500).json({ error: error.message || 'Failed to enrich vocabulary' });
  }
}
