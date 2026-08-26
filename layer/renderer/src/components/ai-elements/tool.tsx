import type { AgentChatActivity } from '@torrent-vibe/shared'

import { cn } from '~/lib/cn'

const statusIcon: Record<AgentChatActivity['status'], string> = {
  failed: 'i-mingcute-close-circle-line text-red',
  running: 'i-mingcute-loading-3-line animate-spin text-accent',
  succeeded: 'i-mingcute-check-circle-line text-green',
}

// Adapted from Vercel AI Elements Tool for Agent activity events.
export const Tool = ({ activity }: { activity: AgentChatActivity }) => (
  <details className="group min-w-0 text-xs">
    <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-text-secondary">
      <i className={cn('shrink-0', statusIcon[activity.status])} />
      <span className="min-w-0 flex-1 truncate">{activity.label}</span>
      {activity.summary && (
        <i className="i-mingcute-down-line shrink-0 text-text-quaternary transition-transform group-open:rotate-180" />
      )}
    </summary>
    {activity.summary && (
      <div className="pl-6 pb-1.5 font-mono text-text-tertiary whitespace-pre-wrap break-all">
        {activity.summary}
      </div>
    )}
  </details>
)
