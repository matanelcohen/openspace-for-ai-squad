'use client';

import { useCallback, useEffect, useRef } from 'react';

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

const AGENT_VOICE_PITCH: Record<string, { pitch: number; rate: number }> = {
  leela: { pitch: 1.1, rate: 1.0 },
  fry: { pitch: 1.2, rate: 1.05 },
  bender: { pitch: 0.7, rate: 0.95 },
  zoidberg: { pitch: 1.3, rate: 1.0 },
};

/**
 * Invisible component — plays TTS queue sequentially.
 * Processes items one at a time, advances on completion or timeout.
 */
export function VoiceSpeaker({
  queue,
  onSpeakingStart,
  onSpeakingEnd,
  onQueueEmpty,
}: VoiceSpeakerProps) {
  const processedCountRef = useRef(0);
  const busyRef = useRef(false);

  const processNext = useCallback(() => {
    if (busyRef.current) return;
    if (processedCountRef.current >= queue.length) return;

    const item = queue[processedCountRef.current];
    if (!item) return;

    busyRef.current = true;
    const synth = window.speechSynthesis;
    if (!synth) {
      busyRef.current = false;
      processedCountRef.current++;
      return;
    }

    const config = AGENT_VOICE_PITCH[item.agentId] ?? { pitch: 1, rate: 1 };
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;

    const voices = synth.getVoices();
    if (voices.length > 0) {
      const idx = Object.keys(AGENT_VOICE_PITCH).indexOf(item.agentId);
      utterance.voice = voices[idx % voices.length] ?? voices[0] ?? null;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      busyRef.current = false;
      processedCountRef.current++;
      onSpeakingEnd?.(item.agentId);
      // Process next in queue on next tick
      setTimeout(processNext, 100);
    };

    console.log('[TTS] Speaking as', item.agentId, '-', item.text.substring(0, 40));
    onSpeakingStart?.(item.agentId);

    utterance.onend = () => {
      console.log('[TTS] Finished', item.agentId);
      finish();
    };
    utterance.onerror = () => finish();

    synth.speak(utterance);

    // Safety: if nothing happens in estimated time + 3s, force advance
    const timeoutMs = Math.max(3000, (item.text.length * 80) / config.rate) + 3000;
    setTimeout(() => {
      if (!done) {
        console.warn('[TTS] Timeout for', item.agentId);
        synth.cancel();
        finish();
      }
    }, timeoutMs);
  }, [queue, onSpeakingStart, onSpeakingEnd]);

  // Trigger processing when queue grows
  useEffect(() => {
    if (queue.length > processedCountRef.current && !busyRef.current) {
      processNext();
    }
  }, [queue.length, processNext]);

  // Notify when all items are processed
  useEffect(() => {
    if (queue.length > 0 && processedCountRef.current >= queue.length && !busyRef.current) {
      onQueueEmpty?.();
    }
  });

  return null;
}
