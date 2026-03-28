import { SquadGuard } from '@/components/workspace/squad-guard';

import { ChatClient } from './chat-client';

export default function ChatPage() {
  return (
    <SquadGuard>
      <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col md:-m-6">
        <ChatClient />
      </div>
    </SquadGuard>
  );
}
