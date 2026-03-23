'use client';

import { useState } from 'react';

import { Card } from '@/components/ui/card';
import { useVoiceSession } from '@/hooks/use-voice-session';

import { AgentCircle } from './agent-circle';
import { AgentSelector } from './agent-selector';
import { MicrophoneButton } from './microphone-button';
import { SessionControls } from './session-controls';
import { VoiceTextInput } from './voice-text-input';
import { VoiceTranscript } from './voice-transcript';

const DEFAULT_AGENTS = ['leela', 'bender', 'fry', 'zoidberg'];

export function VoiceRoom() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const {
    session,
    isRecording,
    isMuted,
    currentSpeaker,
    startSession,
    endSession,
    startRecording,
    stopRecording,
    toggleMute,
    sendTextMessage,
  } = useVoiceSession();

  const handleStartSession = () => {
    startSession(DEFAULT_AGENTS);
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSendMessage = (content: string) => {
    sendTextMessage(content, selectedAgent || undefined);
  };

  const isActive = session?.status === 'active';

  return (
    <div className="flex flex-col h-full" data-testid="voice-room">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Voice Room</h1>
          {session && (
            <p className="text-sm text-muted-foreground">
              Session: {session.id}
            </p>
          )}
        </div>
        <SessionControls
          sessionStatus={session?.status || null}
          isMuted={isMuted}
          onStartSession={handleStartSession}
          onEndSession={endSession}
          onToggleMute={toggleMute}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Agent Circles */}
        <div className="w-1/3 p-4 border-r overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            {session ? (
              session.participantAgentIds.map((agentId) => (
                <AgentCircle
                  key={agentId}
                  agentId={agentId}
                  isSpeaking={currentSpeaker === agentId}
                />
              ))
            ) : (
              <div className="col-span-2 text-center text-muted-foreground py-8">
                Start a session to see agents
              </div>
            )}
          </div>
        </div>

        {/* Right: Transcript */}
        <div className="flex-1 flex flex-col">
          <VoiceTranscript
            messages={session?.messages || []}
            className="flex-1"
          />

          {/* Controls */}
          {isActive && (
            <Card className="m-4 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <AgentSelector
                  availableAgents={session?.participantAgentIds || []}
                  selectedAgent={selectedAgent}
                  onSelectAgent={setSelectedAgent}
                />
                <MicrophoneButton
                  isRecording={isRecording}
                  isMuted={isMuted}
                  onToggleRecording={handleToggleRecording}
                />
              </div>
              <VoiceTextInput
                onSendMessage={handleSendMessage}
                placeholder="Type a message..."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
