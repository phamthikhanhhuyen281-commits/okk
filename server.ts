import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini Client
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

// API: Enrich Vocabulary using Gemini
app.post('/api/enrich-vocabulary', async (req, res) => {
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
2. Accurate and natural Vietnamese translation/meaning.
3. Common high-yielding IELTS collocations (comma-separated, e.g. make a reservation, confirm a reservation).
4. A high-quality, practical IELTS-level example sentence in English using this word.
5. Vietnamese translation of that example sentence.

Provide the response in structured JSON format matching the schema. Ensure fields are concise, helpful, and natural.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING },
        ipa: { type: Type.STRING, description: 'IPA pronunciation, e.g. /.../' },
        meaning: { type: Type.STRING, description: 'Vietnamese meaning/definition' },
        collocation: { type: Type.STRING, description: 'Common collocations, comma-separated' },
        example: { type: Type.STRING, description: 'An English example sentence' },
        exampleTranslation: { type: Type.STRING, description: 'Vietnamese translation of the example sentence' }
      },
      required: ['word', 'ipa', 'meaning', 'collocation', 'example', 'exampleTranslation']
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
    res.json(parsedData);
  } catch (error: any) {
    console.error('Error enriching vocabulary:', error);
    res.status(500).json({ error: error.message || 'Failed to enrich vocabulary' });
  }
});

// Start server and handle Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
