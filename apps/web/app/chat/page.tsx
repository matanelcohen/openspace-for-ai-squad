import { ChatClient } from './chat-client';

export default function ChatPage() {
  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col md:-m-6">
      <ChatClient />
    </div>
  );
}
