import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface Recommendation {
  category: string;
  reason: string;
}

export interface PricePrediction {
  predictedPrice: number;
  confidence: number;
  factors: string[];
}

export interface FraudAnalysis {
  fraudScore: number;
  isSuspicious: boolean;
  reasons: string[];
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
}

export interface RouteOptimization {
  estimatedTime: string;
  optimizedRoute: string[];
  tips: string[];
}

export const aiService = {
  /**
   * Suggests the best service based on user booking history.
   */
  async getServiceRecommendations(history: any[]): Promise<Recommendation[]> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on this user's service booking history, suggest 3 relevant services they might need next. 
      History: ${JSON.stringify(history)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              reason: { type: Type.STRING }
            },
            required: ["category", "reason"]
          }
        }
      }
    });

    try {
      return JSON.parse(response.text || '[]');
    } catch (e) {
      console.error("Failed to parse recommendations", e);
      return [];
    }
  },

  /**
   * Predicts a fair price for a service.
   */
  async predictPrice(location: string, serviceType: string, time: string): Promise<PricePrediction> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Predict a fair price in INR for a ${serviceType} service in ${location} at ${time}. 
      Return the predicted price, confidence level (0-1), and key factors influencing the price.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedPrice: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
            factors: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["predictedPrice", "confidence", "factors"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse price prediction", e);
      return { predictedPrice: 0, confidence: 0, factors: [] };
    }
  },

  /**
   * Analyzes a provider for potential fraud.
   */
  async detectFraud(providerData: any, reviews: any[]): Promise<FraudAnalysis> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this service provider and their reviews for potential fraud or suspicious activity. 
      Provider: ${JSON.stringify(providerData)}
      Reviews: ${JSON.stringify(reviews)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fraudScore: { type: Type.NUMBER, description: "0-100 score, higher means more suspicious" },
            isSuspicious: { type: Type.BOOLEAN },
            reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["fraudScore", "isSuspicious", "reasons"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse fraud analysis", e);
      return { fraudScore: 0, isSuspicious: false, reasons: [] };
    }
  },

  /**
   * Analyzes the sentiment of a review.
   */
  async analyzeSentiment(comment: string): Promise<SentimentAnalysis> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the sentiment of this review: "${comment}". 
      Return the sentiment (positive, negative, neutral) and a confidence score (0-1).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING, enum: ["positive", "negative", "neutral"] },
            score: { type: Type.NUMBER }
          },
          required: ["sentiment", "score"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse sentiment analysis", e);
      return { sentiment: 'neutral', score: 0 };
    }
  },

  /**
   * Optimizes the route for a worker.
   */
  async optimizeRoute(start: string, end: string): Promise<RouteOptimization> {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest the fastest route from ${start} to ${end}. 
      Include estimated time, key waypoints, and traffic tips.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedTime: { type: Type.STRING },
            optimizedRoute: { type: Type.ARRAY, items: { type: Type.STRING } },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["estimatedTime", "optimizedRoute", "tips"]
        }
      }
    });

    try {
      return JSON.parse(response.text || '{}');
    } catch (e) {
      console.error("Failed to parse route optimization", e);
      return { estimatedTime: "Unknown", optimizedRoute: [], tips: [] };
    }
  }
};
