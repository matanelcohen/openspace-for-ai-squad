import { ChatClient } from './chat-client';

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b px-6 py-3">
        <h1 className="text-xl font-bold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">Talk to your squad in real time.</p>
      </div>
      <ChatClient />
    </div>
  );
}
