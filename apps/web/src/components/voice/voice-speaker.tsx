'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechItem {
  id: string;
  agentId: string;
  text: string;
}

interface VoiceSpeakerProps {
  queue: SpeechItem[];
  onSpeakingStart?: (agentId: string) => void;
  onSpeakingEnd?: (agentId: string) => void;
  onQueueEmpty?: () => void;
}

/** Agent voice configs for browser SpeechSynthesis. */
const AGENT_VOICE_PITCH: Record<string, { pitch: number; rate: number }> = {
  leela: { pitch: 1.1, rate: 1.0 },
  fry: { pitch: 1.2, rate: 1.05 },
  bender: { pitch: 0.7, rate: 0.95 },
  zoidberg: { pitch: 1.3, rate: 1.0 },
};

/**
 * Invisible component that plays TTS for queued speech items.
 * Uses native SpeechSynthesis directly for maximum reliability.
 */
export function VoiceSpeaker({
  queue,
  onSpeakingStart,
  onSpeakingEnd,
  onQueueEmpty,
}: VoiceSpeakerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isSpeakingRef = useRef(false);
  const lastQueueLenRef = useRef(0);

  const speakItem = useCallback(
    (item: SpeechItem) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // Cancel any in-progress speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(item.text);
      const config = AGENT_VOICE_PITCH[item.agentId] ?? { pitch: 1, rate: 1 };
      utterance.pitch = config.pitch;
      utterance.rate = config.rate;

      // Pick a voice
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const voiceIndex = Object.keys(AGENT_VOICE_PITCH).indexOf(item.agentId);
        utterance.voice = voices[voiceIndex % voices.length] ?? voices[0] ?? null;
      }

      utterance.onstart = () => {
        console.log('[TTS] Speaking as', item.agentId);
        isSpeakingRef.current = true;
        onSpeakingStart?.(item.agentId);
      };

      const advance = () => {
        if (!isSpeakingRef.current) return;
        isSpeakingRef.current = false;
        onSpeakingEnd?.(item.agentId);
        setCurrentIndex((prev) => prev + 1);
      };

      utterance.onend = () => {
        console.log('[TTS] Finished', item.agentId);
        advance();
      };

      utterance.onerror = (e) => {
        console.warn('[TTS] Error:', e.error);
        advance();
      };

      window.speechSynthesis.speak(utterance);

      // Safety timeout — if onend never fires, unstick after estimated duration
      const estimatedMs = Math.max(3000, (item.text.length * 80) / config.rate);
      setTimeout(() => {
        if (isSpeakingRef.current) {
          console.warn('[TTS] Timeout, forcing advance for', item.agentId);
          window.speechSynthesis.cancel();
          advance();
        }
      }, estimatedMs + 2000);
    },
    [onSpeakingStart, onSpeakingEnd],
  );

  // Process next item when index advances or new items arrive
  useEffect(() => {
    if (currentIndex < queue.length && !isSpeakingRef.current) {
      const item = queue[currentIndex];
      if (item) {
        speakItem(item);
      }
    }
  }, [currentIndex, queue, speakItem]);

  // Detect when queue is fully drained
  useEffect(() => {
    if (
      queue.length > 0 &&
      currentIndex >= queue.length &&
      lastQueueLenRef.current < queue.length
    ) {
      onQueueEmpty?.();
    }
    lastQueueLenRef.current = queue.length;
  }, [currentIndex, queue.length, onQueueEmpty]);

  return null;
}
