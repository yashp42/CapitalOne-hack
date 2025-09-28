import React, { useState, useRef, useCallback } from 'react';
import { FaSpinner, FaVolumeUp, FaStop } from 'react-icons/fa';
import { ttsAPI } from '../services/api';

const TextToSpeech = ({ text, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const abortControllerRef = useRef(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const audioUrl = audio.src;
      
      // Remove event listeners to prevent race conditions
      audio.onended = null;
      audio.onpause = null;
      audio.onerror = null;
      audio.oncanplay = null;
      
      audio.pause();
      audio.currentTime = 0;
      
      // Clean up URL if it exists
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
      
      audioRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Always reset states when manually stopping
    setIsPlaying(false);
    setIsLoading(false);
    setError(null);
  }, []);

  const playAudio = useCallback(async () => {
    if (!text || text.trim().length === 0) {
      setError('No text to speak');
      return;
    }

    try {
      setError(null);
      
      // Stop any existing playback first
      if (audioRef.current) {
        const audio = audioRef.current;
        const audioUrl = audio.src;
        
        // Remove event listeners to prevent race conditions
        audio.onended = null;
        audio.onpause = null;
        audio.onerror = null;
        audio.oncanplay = null;
        
        audio.pause();
        audio.currentTime = 0;
        
        // Clean up URL if it exists
        if (audioUrl && audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl);
        }
        
        audioRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Now set loading state after cleanup
      setIsLoading(true);
      setIsPlaying(false);

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      // Call TTS API using the API service
      const data = await ttsAPI.synthesize(text);
      
      if (!data.audioData) {
        throw new Error('No audio data received from server');
      }

      // Validate base64 data
      if (!data.audioData || data.audioData.length === 0) {
        throw new Error('Empty audio data received');
      }
      
      try {
        // Create audio blob from base64 data with proper error handling
        const binaryString = atob(data.audioData);
        const audioBytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
          audioBytes[i] = binaryString.charCodeAt(i);
        }
        
        const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
        
        if (audioBlob.size === 0) {
          throw new Error('Failed to create audio blob');
        }
      
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Create audio element
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        // Set audio properties for better compatibility
        audio.preload = 'auto';
        audio.controls = false;

      // Set up audio event handlers
      audio.oncanplay = () => {
        setIsLoading(false);
        setIsPlaying(true);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsLoading(false);
        audioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };

      audio.onpause = () => {
        // Only update state if this is a natural pause, not a manual stop
        if (audioRef.current === audio) {
          setIsPlaying(false);
          setIsLoading(false);
        }
      };

      audio.onerror = (e) => {
        setError('Audio playback failed');
        setIsLoading(false);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl); // Clean up blob URL
      };

        // Start playing with better error handling
        try {
          await audio.play();
        } catch (playError) {
          throw new Error(`Audio playback failed: ${playError.message}`);
        }
        
      } catch (blobError) {
        throw new Error(`Audio processing failed: ${blobError.message}`);
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return;
      }
      
      setError(error.message || 'Speech synthesis failed');
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [text, stopAudio]);

  const handleClick = useCallback(() => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  }, [isPlaying, playAudio, stopAudio]);

  // Clean up on unmount
  React.useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return (
    <div className="mt-2 flex justify-end">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className={`
          flex items-center gap-1.5 px-3 py-1.5
          bg-primary-400 hover:bg-primary-500
          text-white
          rounded-lg transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-secondary-500/20
          text-xs font-medium shadow-sm
          ${className}
        `}
        title={isPlaying ? 'Stop speaking' : 'Speak text aloud'}
      >
        {isLoading ? (
          <>
            <FaSpinner className="text-xs animate-spin" />
            <span>Loading...</span>
          </>
        ) : isPlaying ? (
          <>
            <FaStop className="text-xs" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <FaVolumeUp className="text-xs" />
            <span>Speak Aloud</span>
          </>
        )}
      </button>
      
      {/* Error message */}
      {error && (
        <div className="mt-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default TextToSpeech;
