import {
  ActionBarPrimitive,
  AuiIf,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react';
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
} from 'lucide-react';
import type { FC } from 'react';

import {
  ComposerAttachments,
  UserMessageAttachments,
} from '@/components/assistant-ui/attachment';
import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { cn } from '@/lib/utils';

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root className="flex h-full flex-col items-stretch bg-background px-4 text-foreground dark:bg-[#212121] dark:text-foreground">
      <ThreadPrimitive.Viewport className="flex grow flex-col gap-8 overflow-y-scroll pt-16">
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <ThreadWelcome />
        </AuiIf>

        <ThreadPrimitive.Messages>
          {({ message }) => {
            if (message.role === 'user') return <UserMessage />;
            return <AssistantMessage />;
          }}
        </ThreadPrimitive.Messages>

        <ThreadPrimitive.ViewportFooter className="sticky bottom-0 mx-auto mt-auto flex w-full max-w-3xl flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-2 dark:bg-[#212121]">
          <ThreadScrollToBottom />
          <Composer />
          <p className="text-center text-muted-foreground text-xs dark:text-[#cdcdcd]">
            openspace.ai squad — AI agents may make mistakes
          </p>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="flex grow flex-col items-center justify-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl border shadow dark:border-white/15">
        <span className="text-2xl">🚀</span>
      </div>
      <p className="mt-4 text-xl font-medium dark:text-white">
        Hey, your squad is here!
      </p>
      <p className="mt-1 text-sm text-muted-foreground dark:text-[#cdcdcd]">
        Talk to the team or pick an agent to chat with.
      </p>
    </div>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        className="absolute -top-10 z-10 self-center rounded-full border bg-background p-2 shadow-sm disabled:invisible dark:border-white/15 dark:bg-[#2a2a2a]"
      >
        <ChevronDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const Composer: FC = () => {
  return (
    <ComposerPrimitive.Root className="w-full rounded-3xl border pl-2 dark:border-none dark:bg-white/5">
      <AuiIf condition={(s) => s.composer.attachments.length > 0}>
        <div className="flex flex-row flex-wrap gap-2 px-1 py-3">
          <ComposerAttachments />
        </div>
      </AuiIf>
      <div className="flex items-center justify-center">
        <ComposerPrimitive.AddAttachment className="flex size-8 items-center justify-center overflow-hidden rounded-full hover:bg-foreground/5 dark:hover:bg-foreground/15">
          <PlusIcon size={18} />
        </ComposerPrimitive.AddAttachment>
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="h-12 max-h-40 grow resize-none bg-transparent p-3.5 text-foreground text-sm outline-none placeholder:text-muted-foreground dark:text-white dark:placeholder:text-white/50"
          autoFocus
        />
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send className="m-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-10 dark:bg-white dark:text-black">
            <ArrowUpIcon className="size-5 dark:[&_path]:stroke-1 dark:[&_path]:stroke-black" />
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel className="m-2 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground dark:bg-white">
            <SquareIcon className="size-2.5 fill-current" />
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </ComposerPrimitive.Root>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AGENT_NAMES: Record<string, string> = {
  leela: 'Leela', fry: 'Fry', bender: 'Bender', zoidberg: 'Zoidberg',
  scribe: 'Scribe', ralph: 'Ralph', coordinator: 'Squad',
};
const AGENT_EMOJI: Record<string, string> = {
  leela: '👁️', fry: '🍕', bender: '🤖', zoidberg: '🦀',
  scribe: '📝', ralph: '🔄', coordinator: '👥',
};
const AGENT_AVATAR_COLORS: Record<string, string> = {
  leela: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 dark:border-purple-500/30',
  fry: 'bg-blue-500/20 text-blue-700 dark:text-blue-400 dark:border-blue-500/30',
  bender: 'bg-orange-500/20 text-orange-700 dark:text-orange-400 dark:border-orange-500/30',
  zoidberg: 'bg-green-500/20 text-green-700 dark:text-green-400 dark:border-green-500/30',
  scribe: 'bg-gray-500/20 text-gray-700 dark:text-gray-400 dark:border-gray-500/30',
  ralph: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 dark:border-yellow-500/30',
};
const AGENT_NAME_COLORS: Record<string, string> = {
  leela: 'text-purple-600 dark:text-purple-400',
  fry: 'text-blue-600 dark:text-blue-400',
  bender: 'text-orange-600 dark:text-orange-400',
  zoidberg: 'text-green-600 dark:text-green-400',
};

const AssistantMessage: FC = () => {
  const agentId = useAuiState((s) => {
    const meta = s.message.metadata as { custom?: { agentId?: string } } | undefined;
    return meta?.custom?.agentId ?? 'assistant';
  });

  const name = AGENT_NAMES[agentId] ?? agentId;
  const emoji = AGENT_EMOJI[agentId] ?? '🤖';
  const avatarColor = AGENT_AVATAR_COLORS[agentId] ?? 'bg-muted text-muted-foreground dark:border-white/15';
  const nameColor = AGENT_NAME_COLORS[agentId] ?? 'text-foreground';

  return (
    <MessagePrimitive.Root
      className="relative mx-auto flex w-full max-w-3xl gap-3"
      data-role="assistant"
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border shadow-sm text-sm',
          avatarColor,
        )}
      >
        {emoji}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <span className={cn('text-sm font-bold', nameColor)}>{name}</span>
        <div className="mt-1 text-foreground dark:text-[#eee]">
          <MessagePrimitive.Parts>
            {({ part }) => {
              if (part.type === 'text') return <MarkdownText />;
              if (part.type === 'tool-call') return part.toolUI ?? <ToolFallback {...part} />;
              return null;
            }}
          </MessagePrimitive.Parts>
          <MessageError />
        </div>

        <div className="flex pt-2">
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="flex items-center gap-1 rounded-lg data-floating:absolute data-floating:border-2 data-floating:p-1"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy" className="text-[#b4b4b4]">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Reload" className="text-[#b4b4b4]">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="relative mx-auto flex w-full max-w-3xl flex-col items-end gap-1"
      data-role="user"
    >
      <div className="flex flex-row flex-wrap justify-end gap-2">
        <UserMessageAttachments />
      </div>

      <div className="flex items-start gap-4">
        <ActionBarPrimitive.Root
          hideWhenRunning
          autohide="not-last"
          autohideFloat="single-branch"
          className="mt-2"
        >
          <ActionBarPrimitive.Copy asChild>
            <TooltipIconButton tooltip="Copy" className="text-[#b4b4b4]">
              <AuiIf condition={(s) => s.message.isCopied}>
                <CheckIcon />
              </AuiIf>
              <AuiIf condition={(s) => !s.message.isCopied}>
                <CopyIcon />
              </AuiIf>
            </TooltipIconButton>
          </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>

        <div className="rounded-3xl bg-secondary px-5 py-2.5 text-foreground dark:bg-white/5 dark:text-[#eee]">
          <MessagePrimitive.Parts />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};
