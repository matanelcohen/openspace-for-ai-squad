'use client';

/**
 * Invisible bridge component: wires WebSocket events into TanStack Query
 * caches so agent cards and summary stats update without polling.
 */

import type { WsEnvelope } from '@/hooks/use-websocket';
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';

interface Props {
  addWsListener: (type: string, cb: (e: WsEnvelope) => void) => () => void;
}

export function RealtimeDashboardBridge({ addWsListener }: Props) {
  useRealtimeDashboard(addWsListener);
  return null;
}
