import express from "express";
import { synthesize } from "../services/tts.service.js";

const router = express.Router();

/**
 * POST /api/tts/synthesize
 * Synthesize speech from text using Sarvam TTS API
 * 
 * Body:
 * - text: string (required) - Text to synthesize
 * - lang: string (optional) - Language code (will auto-detect if not provided)
 * 
 * Response:
 * - audioData: string - Base64 encoded audio data
 * - language: string - Language used for synthesis
 */
router.post("/synthesize", async (req, res) => {
  try {
    const { text, lang } = req.body;

    // Validate input
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: "Text is required and must be a non-empty string"
      });
    }

    // Call TTS service
    const audioData = await synthesize({ text, lang });

    // Return audio data
    res.json({
      success: true,
      audioData: audioData,
      language: lang || 'auto-detected',
      message: 'Speech synthesis successful'
    });

  } catch (error) {
    // Handle specific error types
    if (error.message.includes('API key')) {
      return res.status(500).json({
        error: "TTS service configuration error",
        details: "API key not properly configured"
      });
    }
    
    if (error.message.includes('TTS API failed')) {
      return res.status(502).json({
        error: "External TTS service error",
        details: error.message
      });
    }

    // Generic error response
    res.status(500).json({
      error: "Speech synthesis failed",
      details: error.message
    });
  }
});

/**
 * GET /api/tts/health
 * Health check endpoint for TTS service
 */
router.get("/health", async (req, res) => {
  try {
    // Check if API key is configured
    if (!process.env.SARVAM_TTS_API_KEY) {
      return res.status(503).json({
        status: "unhealthy",
        message: "Sarvam API key not configured"
      });
    }

    // Test the API key with a simple request
    try {
      const testResponse = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': process.env.SARVAM_TTS_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          target_language_code: 'en-IN',
          speaker: 'anushka',
          text: 'test',
          model: 'bulbul:v2'
        })
      });

      console.log('Health check - API test response status:', testResponse.status);
      
      if (testResponse.status === 403) {
        return res.status(503).json({
          status: "unhealthy",
          message: "Sarvam API key is invalid or subscription not found",
          apiKeyConfigured: true,
          testStatus: testResponse.status
        });
      }

      res.json({
        status: "healthy", 
        message: "TTS service is ready",
        apiKeyConfigured: true,
        testStatus: testResponse.status,
        supportedLanguages: [
          'en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 
          'ml-IN', 'mr-IN', 'ne-NP', 'or-IN', 'pa-IN', 
          'ta-IN', 'te-IN', 'ur-IN'
        ]
      });
    } catch (apiError) {
      console.error('API key test failed:', apiError);
      res.status(503).json({
        status: "unhealthy",
        message: "Could not validate API key",
        apiKeyConfigured: true,
        error: apiError.message
      });
    }
  } catch (error) {
    console.error('TTS health check error:', error);
    res.status(500).json({
      status: "unhealthy", 
      message: "Health check failed",
      error: error.message
    });
  }
});

export default router;