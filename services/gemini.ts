import { GoogleGenAI, GenerateContentResponse, LiveSessionCallbacks, Modality, GenerateVideosOperation, Type, Blob } from "@google/genai";
import { AspectRatio, ChatMessage, Restaurant, YouTubeVideo } from '../types';

async function getGenAI(): Promise<GoogleGenAI> {
    if ((window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey()) {
         return new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export async function generateChatResponse(history: ChatMessage[], newMessage: string): Promise<GenerateContentResponse> {
    const ai = await getGenAI();

    const activitySchema = {
        type: Type.OBJECT,
        properties: {
            time: { type: Type.STRING, description: "e.g., '9:00 AM' or 'Afternoon'" },
            description: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['flight', 'hotel', 'dining', 'activity', 'travel'] }
        },
        required: ["time", "description", "type"]
    };

    const daySchema = {
        type: Type.OBJECT,
        properties: {
            day: { type: Type.INTEGER },
            title: { type: Type.STRING, description: "A catchy title for the day, e.g., 'Arrival in Tokyo & Shinjuku Exploration'." },
            summary: { type: Type.STRING, description: "A brief summary of the day's plan." },
            activities: { type: Type.ARRAY, items: activitySchema }
        },
        required: ["day", "title", "summary", "activities"]
    };

    const itinerarySchema = {
        type: Type.OBJECT,
        properties: {
            destination: { type: Type.STRING },
            duration: { type: Type.STRING, description: "e.g., '10 Days'" },
            budget: { type: Type.STRING, description: "e.g., '$5000 per person'" },
            itinerary: { type: Type.ARRAY, items: daySchema }
        },
        required: ["destination", "duration", "budget", "itinerary"]
    };

    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            contentType: {
                type: Type.STRING,
                enum: ['itinerary', 'text'],
                description: "The type of response. Use 'itinerary' if generating a travel plan, otherwise use 'text'."
            },
            itineraryPayload: itinerarySchema,
            textPayload: { type: Type.STRING, description: "A standard text response for general conversation or questions." }
        },
        required: ["contentType"]
    };

    const contents = [
        ...history.map(msg => ({
            role: msg.role,
            parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
        })),
        { role: 'user', parts: [{ text: newMessage }] }
    ];

    return await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents,
        config: {
            systemInstruction: "You are TravelMind, an advanced AI travel companion. You MUST respond in JSON format matching the provided schema. Based on the user's prompt, decide if you are creating an itinerary or providing a text answer and set contentType accordingly. Populate ONLY ONE of `itineraryPayload` or `textPayload` with the relevant information.",
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    });
}


export async function generateWithThinking(prompt: string): Promise<GenerateContentResponse> {
    const ai = await getGenAI();
    return await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 32768 }
        }
    });
}

export async function groundWithSearch(prompt: string): Promise<GenerateContentResponse> {
    const ai = await getGenAI();
    const newPrompt = `Find information about "${prompt}".

You MUST respond with a single JSON object. Do not include any other text or markdown formatting. The JSON object should be the only content in your response.

The object should have the following structure:
{
  "summary": "string",
  "articles": [
    {
      "title": "string",
      "source": "string",
      "url": "string",
      "snippet": "string"
    }
  ]
}`;

    return await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: newPrompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
}

export async function getNearbyRestaurants(prompt: string, latitude: number, longitude: number): Promise<Restaurant[]> {
    const ai = await getGenAI();
    
    const newPrompt = `Find popular places near the user, such as restaurants, hotels, and attractions based on the query: "${prompt}".

You MUST respond with ONLY a JSON array of objects. Do not include any other text, markdown formatting, or explanations. The JSON array must be the only content in your response.

Each object in the array should represent a place and have the following structure:
{
  "placeId": "string",
  "name": "string",
  "rating": number,
  "reviewCount": number,
  "vicinity": "string",
  "location": { "lat": number, "lng": number },
  "types": ["string"]
}

Ensure the response is a valid JSON array.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: newPrompt,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: {
                        latitude,
                        longitude,
                    }
                }
            }
        },
    });

    try {
        const jsonText = response.text?.trim().replace(/^```json|```$/g, '');
        if (!jsonText) {
            console.error("Gemini response for nearby places was empty or undefined.");
            return [];
        }
        const places = JSON.parse(jsonText);

        return places.map((place: any): Restaurant => ({
            placeId: place.placeId || `generated-${place.name}-${Math.random()}`,
            name: place.name,
            rating: place.rating || 0,
            reviewCount: place.reviewCount || 0,
            vicinity: place.vicinity,
            location: place.location,
            types: place.types || [],
        }));
    } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", e, "Response text:", response.text);
        return [];
    }
}

export async function findYouTubeVideosByTopic(topic: string): Promise<YouTubeVideo[]> {
    const ai = await getGenAI();
    
    const prompt = `Find 5-10 popular YouTube videos about "${topic}".

You MUST respond with ONLY a valid JSON array of objects. Do not include any other text, markdown formatting (like \`\`\`json), or explanations. The JSON array must be the only content in your response.

Each object in the array should represent a YouTube video and have the following structure:
{
  "videoId": "string",
  "title": "string",
  "description": "string",
  "channelTitle": "string",
  "thumbnailUrl": "string"
}

Ensure all thumbnail URLs are high quality.
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });

    try {
        const jsonText = response.text?.trim().replace(/^```json|```$/g, '');
        if (!jsonText) {
            console.error("Gemini response for YouTube videos was empty or undefined.");
            return [];
        }
        const videos = JSON.parse(jsonText);
        if (Array.isArray(videos)) {
            return videos.filter(v => v.videoId && v.title && v.thumbnailUrl);
        }
        console.error("Gemini response for YouTube videos was not an array:", videos);
        return [];
    } catch (e) {
        console.error("Failed to parse Gemini response for YouTube videos as JSON:", e, "Response text:", response.text);
        return [];
    }
}


export async function generateImage(prompt: string, aspectRatio: AspectRatio): Promise<string> {
    const ai = await getGenAI();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio,
        },
    });
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
}

export async function editImage(base64Image: string, mimeType: string, prompt: string): Promise<string> {
    const ai = await getGenAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        }
    }
    throw new Error("No image generated");
}

export async function generateVideo(prompt: string, base64Image: string | null, mimeType: string | null, aspectRatio: '16:9' | '9:16'): Promise<GenerateVideosOperation> {
    if ((window as any).aistudio) {
        if (!(await (window as any).aistudio.hasSelectedApiKey())) {
            await (window as any).aistudio.openSelectKey();
        }
    }

    const ai = await getGenAI();
    
    let operation;
    if (base64Image && mimeType) {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: { imageBytes: base64Image, mimeType },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio
            }
        });
    } else {
        operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio
            }
        });
    }
    return operation;
}

export async function checkVideoStatus(operation: GenerateVideosOperation): Promise<GenerateVideosOperation> {
    const ai = await getGenAI();
    return await ai.operations.getVideosOperation({ operation });
}

export async function analyzeImage(base64Image: string, mimeType: string, prompt: string): Promise<GenerateContentResponse> {
    const ai = await getGenAI();
    return await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { data: base64Image, mimeType } },
                { text: prompt },
            ],
        },
    });
}

export async function analyzeVideo(prompt: string): Promise<GenerateContentResponse> {
    const ai = await getGenAI();
    return await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
    });
}

export async function generateSpeech(text: string): Promise<string> {
    const ai = await getGenAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
        throw new Error("No audio data received from TTS API.");
    }
    return base64Audio;
}

export async function startLiveSession(callbacks: LiveSessionCallbacks) {
    const ai = await getGenAI();
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: 'You are TravelMind, a friendly and helpful AI travel assistant. Keep your responses concise and conversational.',
        },
    });
}