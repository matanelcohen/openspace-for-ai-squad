'use client';

import { useEffect, useRef, useState } from 'react';
import { useSpeech } from 'react-text-to-speech';

interface SpeechItem {
  id: string;
  agentId: string;
  text: string;
}

interface VoiceSpeakerProps {
  /** Queue of speech items to play. New items are appended. */
  queue: SpeechItem[];
  /** Called when an agent starts speaking. */
  onSpeakingStart?: (agentId: string) => void;
  /** Called when an agent finishes speaking. */
  onSpeakingEnd?: (agentId: string) => void;
  /** Called when the queue is fully drained and all speech is done. */
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
 * Renders nothing visible — plays TTS for each item in the queue sequentially.
 * Uses react-text-to-speech for reliable onStart/onEnd callbacks.
 */
export function VoiceSpeaker({
  queue,
  onSpeakingStart,
  onSpeakingEnd,
  onQueueEmpty,
}: VoiceSpeakerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const processedRef = useRef(0);

  const current = queue[currentIndex] as SpeechItem | undefined;
  const config = current
    ? (AGENT_VOICE_PITCH[current.agentId] ?? { pitch: 1, rate: 1 })
    : { pitch: 1, rate: 1 };

  const { start, speechStatus } = useSpeech({
    text: current?.text ?? '',
    pitch: config.pitch,
    rate: config.rate,
    onStart: () => {
      if (current) {
        onSpeakingStart?.(current.agentId);
      }
    },
    onEnd: () => {
      if (current) {
        onSpeakingEnd?.(current.agentId);
      }
      setCurrentIndex((prev) => prev + 1);
    },
    onError: () => {
      if (current) {
        onSpeakingEnd?.(current.agentId);
      }
      setCurrentIndex((prev) => prev + 1);
    },
  });

  // Auto-start when a new item is ready
  useEffect(() => {
    if (current && currentIndex >= processedRef.current && speechStatus !== 'started') {
      processedRef.current = currentIndex + 1;
      start();
    }
  }, [current, currentIndex, start, speechStatus]);

  // Notify when queue is drained
  useEffect(() => {
    if (currentIndex > 0 && currentIndex >= queue.length) {
      onQueueEmpty?.();
    }
  }, [currentIndex, queue.length, onQueueEmpty]);

  return null;
}
