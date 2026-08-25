import type {
  AgentChatContext,
  AgentChatMessageMetadata,
  AgentOperationPlan,
  AgentOperationTarget,
  AgentOperationTargetOutcome,
  AgentTorrentOperation,
} from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '~/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '~/components/ai-elements/message'
import { Reasoning } from '~/components/ai-elements/reasoning'
import { Tool } from '~/components/ai-elements/tool'
import { Button } from '~/components/ui/button/Button'
import { Textarea } from '~/components/ui/input/Textarea'
import { Prompt } from '~/components/ui/prompts/Prompt'
import { formatSpeed } from '~/lib/format'
import { useMultiServerStore } from '~/modules/multi-server/stores/multi-server-store'
import { useTorrentDataStore } from '~/modules/torrent/stores/torrent-data-store'
import { useTorrentTableSelectors } from '~/modules/torrent/stores/torrent-table-store'

import { AgentChatActions } from './actions'
import { createAgentContext } from './context'
import { useAgentChatStore } from './store'
import type { AgentChatUiMessage } from './types'

const actions = AgentChatActions.shared

const formatDuration = (milliseconds?: number) =>
  milliseconds === undefined
    ? '—'
    : milliseconds < 1_000
      ? `${milliseconds} ms`
      : `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`

const formatCost = (cost: number | null) =>
  cost === null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        currency: 'USD',
        maximumFractionDigits: 6,
        minimumFractionDigits: cost > 0 && cost < 0.01 ? 4 : 2,
        style: 'currency',
      }).format(cost)

const operationIcons: Record<AgentTorrentOperation, string> = {
  add_tags: 'i-mingcute-tag-2-fill',
  add_torrent: 'i-mingcute-add-circle-fill',
  move_torrent: 'i-mingcute-folder-upload-fill',
  pause: 'i-mingcute-pause-fill',
  reannounce: 'i-mingcute-announcement-fill',
  recheck: 'i-mingcute-refresh-2-fill',
  remove_tags: 'i-mingcute-tag-off-fill',
  remove_torrent: 'i-mingcute-delete-2-fill',
  rename_torrent: 'i-mingcute-edit-3-fill',
  resume: 'i-mingcute-play-fill',
  set_category: 'i-mingcute-folder-fill',
  set_download_limit: 'i-mingcute-download-2-fill',
  set_share_limits: 'i-mingcute-percent-fill',
  set_upload_limit: 'i-mingcute-upload-2-fill',
}

const outcomeClasses: Record<AgentOperationTargetOutcome, string> = {
  changed: 'bg-green/10 text-green',
  failed: 'bg-red/10 text-red',
  pending: 'bg-orange/10 text-orange',
  skipped: 'bg-fill-secondary text-text-tertiary',
}

const formatTags = (tags: string[]) => (tags.length > 0 ? tags.join(', ') : '—')

interface TargetChangeLabels {
  addCategory: string
  addPaused: string
  addSavePath: string
  addServer: string
  addStarted: string
  global: string
  minutes: string
  noCategory: string
  noServer: string
  ratio: string
  reannounceRequested: string
  recheckRequested: string
  removeDeleteFiles: string
  removeKeepFiles: string
  seedingTime: string
  serverDefault: string
  unlimited: string
}

const formatSpeedLimit = (
  value: number | undefined,
  labels: TargetChangeLabels,
) =>
  value === undefined ? '—' : value <= 0 ? labels.unlimited : formatSpeed(value)

const formatShareLimit = (
  value: number | undefined,
  labels: TargetChangeLabels,
) =>
  value === undefined
    ? '—'
    : value === -2
      ? labels.global
      : value === -1
        ? labels.unlimited
        : String(value)

const targetChange = (
  plan: AgentOperationPlan,
  target: AgentOperationTarget,
  labels: TargetChangeLabels,
): string => {
  const currentTags = target.tags ?? []
  if (plan.action === 'add_torrent') {
    return [
      `${labels.addServer}: ${plan.serverName || labels.noServer}`,
      `${labels.addSavePath}: ${plan.savePath || labels.serverDefault}`,
      `${labels.addCategory}: ${plan.category || labels.noCategory}`,
      plan.startPaused ? labels.addPaused : labels.addStarted,
    ].join(' · ')
  }
  if (plan.action === 'rename_torrent') {
    return `${target.name} → ${plan.newName}`
  }
  if (plan.action === 'move_torrent') {
    return `${target.savePath || '—'} → ${plan.savePath}`
  }
  if (plan.action === 'remove_torrent') {
    return plan.deleteFiles ? labels.removeDeleteFiles : labels.removeKeepFiles
  }
  if (plan.action === 'set_category') {
    return `${target.category || labels.noCategory} → ${plan.category || labels.noCategory}`
  }
  if (plan.action === 'add_tags') {
    return `${formatTags(currentTags)} → ${formatTags([
      ...new Set([...currentTags, ...(plan.tags ?? [])]),
    ])}`
  }
  if (plan.action === 'remove_tags') {
    const removed = new Set(plan.tags ?? [])
    return `${formatTags(currentTags)} → ${formatTags(
      currentTags.filter((tag) => !removed.has(tag)),
    )}`
  }
  if (plan.action === 'set_download_limit') {
    return `${formatSpeedLimit(target.downloadLimitBytesPerSecond, labels)} → ${formatSpeedLimit(plan.limitBytesPerSecond, labels)}`
  }
  if (plan.action === 'set_upload_limit') {
    return `${formatSpeedLimit(target.uploadLimitBytesPerSecond, labels)} → ${formatSpeedLimit(plan.limitBytesPerSecond, labels)}`
  }
  if (plan.action === 'set_share_limits') {
    const changes: string[] = []
    if (plan.shareRatioLimit !== undefined) {
      changes.push(
        `${labels.ratio}: ${formatShareLimit(target.shareRatioLimit, labels)} → ${formatShareLimit(plan.shareRatioLimit, labels)}`,
      )
    }
    if (plan.seedingTimeLimitMinutes !== undefined) {
      const before = formatShareLimit(target.seedingTimeLimitMinutes, labels)
      const after = formatShareLimit(plan.seedingTimeLimitMinutes, labels)
      changes.push(
        `${labels.seedingTime}: ${before}${target.seedingTimeLimitMinutes !== undefined && target.seedingTimeLimitMinutes >= 0 ? ` ${labels.minutes}` : ''} → ${after}${plan.seedingTimeLimitMinutes >= 0 ? ` ${labels.minutes}` : ''}`,
      )
    }
    return changes.join(' · ')
  }
  if (plan.action === 'recheck') {
    return `${target.state} → ${labels.recheckRequested}`
  }
  if (plan.action === 'reannounce') {
    return `${target.state} → ${labels.reannounceRequested}`
  }
  return target.state
}

const targetOutcome = (
  plan: AgentOperationPlan,
  target: AgentOperationTarget,
): AgentOperationTargetOutcome =>
  target.outcome ??
  (plan.status === 'succeeded'
    ? 'changed'
    : plan.status === 'failed'
      ? 'failed'
      : plan.status === 'expired'
        ? 'skipped'
        : 'pending')

const ContextChip = ({
  icon,
  label,
  onRemove,
}: {
  icon: string
  label: string
  onRemove?: () => void
}) => {
  const { t } = useTranslation()
  const className =
    'inline-flex h-6 max-w-48 shrink-0 items-center gap-1.5 rounded-md bg-fill-secondary px-2 text-[11px] text-text-secondary'
  const content = (
    <>
      <i className={`${icon} shrink-0 text-text-tertiary`} />
      <span className="truncate">{label}</span>
      {onRemove ? <i className="i-mingcute-close-line shrink-0" /> : null}
    </>
  )

  return onRemove ? (
    <button
      aria-label={t('agent.context.remove', { label })}
      className={`${className} transition-colors hover:bg-fill-tertiary hover:text-text`}
      title={t('agent.context.remove', { label })}
      type="button"
      onClick={onRemove}
    >
      {content}
    </button>
  ) : (
    <span className={className} title={label}>
      {content}
    </span>
  )
}

const AgentContextChips = ({
  context,
  label,
  pinned = false,
  removable = false,
}: {
  context: AgentChatContext
  label: string
  pinned?: boolean
  removable?: boolean
}) => {
  const { t, i18n } = useTranslation()
  const filter = context.filter
  const filterLabels = [
    ...(filter?.statuses ?? []).map((status) => {
      const key = `torrent.filters.${status}`
      return i18n.exists(key) ? String(t(key as never)) : status
    }),
    ...(filter?.categories ?? []),
    ...(filter?.tags ?? []).map((tag) => `#${tag}`),
  ]
  const filterLabel = filterLabels.join(' · ')
  const serverLabel = context.activeServerName || t('agent.context.noServer')

  return (
    <div
      aria-label={label}
      className="flex min-w-0 items-center gap-1.5"
      data-agent-context={pinned ? 'pinned' : removable ? 'live' : 'snapshot'}
    >
      {pinned ? (
        <i
          aria-label={t('agent.context.pinned')}
          className="i-mingcute-pin-2-fill shrink-0 text-xs text-accent"
          title={t('agent.context.pinned')}
        />
      ) : null}
      <ContextChip
        icon="i-mingcute-server-line"
        label={serverLabel}
        onRemove={
          removable && context.activeServerId
            ? () => actions.removeDraftContextPart('server')
            : undefined
        }
      />
      <ContextChip
        icon="i-mingcute-eye-2-line"
        label={t('agent.context.visible', {
          count: context.visibleTorrentCount,
        })}
      />
      {context.selectedTorrentHashes.length > 0 ? (
        <ContextChip
          icon="i-mingcute-check-circle-line"
          label={t('agent.context.selected', {
            count: context.selectedTorrentHashes.length,
          })}
          onRemove={
            removable
              ? () => actions.removeDraftContextPart('selection')
              : undefined
          }
        />
      ) : null}
      {filterLabel ? (
        <ContextChip
          icon="i-mingcute-filter-2-line"
          label={filterLabel}
          onRemove={
            removable
              ? () => actions.removeDraftContextPart('filter')
              : undefined
          }
        />
      ) : null}
      {filter?.search ? (
        <ContextChip
          icon="i-mingcute-search-2-line"
          label={`“${filter.search}”`}
          onRemove={
            removable
              ? () => actions.removeDraftContextPart('search')
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

const MessageMetadataBar = ({
  metadata,
}: {
  metadata: AgentChatMessageMetadata
}) => {
  const { t } = useTranslation()
  const tps = metadata.tokensPerSecond?.toFixed(1) ?? '—'
  const cost = formatCost(metadata.usage.costUsd)
  const detail = [
    `${t('agent.metadata.model')}: ${metadata.provider} / ${metadata.model}`,
    `${t('agent.metadata.duration')}: ${formatDuration(metadata.durationMs)}`,
    `${t('agent.metadata.ttft')}: ${formatDuration(metadata.ttftMs)}`,
    `${t('agent.metadata.tokens')}: ${metadata.usage.totalTokens}`,
    `${t('agent.metadata.input')}: ${metadata.usage.inputTokens}`,
    `${t('agent.metadata.output')}: ${metadata.usage.outputTokens}`,
    `${t('agent.metadata.cache')}: ${metadata.usage.cacheReadTokens + metadata.usage.cacheWriteTokens}`,
    `${t('agent.metadata.reasoning')}: ${metadata.usage.reasoningTokens}`,
    `${t('agent.metadata.cost')}: ${cost}`,
  ].join('\n')

  return (
    <div
      aria-label={detail}
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-text-quaternary"
      title={detail}
    >
      <span className="inline-flex min-w-0 items-center gap-1">
        <i className="i-mingcute-chip-line shrink-0" />
        <span className="truncate">{metadata.model}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="i-mingcute-time-line" />
        {formatDuration(metadata.durationMs)}
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="i-mingcute-flash-line" />
        {tps} tok/s
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="i-mingcute-coin-line" />
        {cost}
      </span>
    </div>
  )
}

const PlanCard = ({ plan }: { plan: AgentOperationPlan }) => {
  const { t } = useTranslation()
  const isPending = plan.status === 'pending'
  const isExecuting = plan.status === 'executing'
  const isDestructive = plan.action === 'remove_torrent'
  const deletesFiles = isDestructive && plan.deleteFiles === true
  const dividerClass = isDestructive ? 'border-red/15' : 'border-orange/15'
  const visibleTargets = plan.targets.slice(0, 3)
  const changeLabels: TargetChangeLabels = {
    addCategory: t('agent.plan.add.category'),
    addPaused: t('agent.plan.add.paused'),
    addSavePath: t('agent.plan.add.savePath'),
    addServer: t('agent.plan.add.server'),
    addStarted: t('agent.plan.add.started'),
    global: t('agent.plan.limit.global'),
    minutes: t('agent.plan.limit.minutes'),
    noCategory: t('addTorrent.noCategory'),
    noServer: t('agent.context.noServer'),
    ratio: t('agent.plan.limit.ratio'),
    reannounceRequested: t('agent.plan.reannounceRequested'),
    recheckRequested: t('agent.plan.recheckRequested'),
    removeDeleteFiles: t('agent.plan.remove.deleteFiles'),
    removeKeepFiles: t('agent.plan.remove.keepFiles'),
    seedingTime: t('agent.plan.limit.seedingTime'),
    serverDefault: t('agent.plan.add.serverDefault'),
    unlimited: t('agent.plan.limit.unlimited'),
  }

  const execute = async (destructiveConfirmed = false) => {
    const result = await actions.executePlan(plan.id, destructiveConfirmed)
    if (result.ok) {
      const changedCount =
        result.data?.plan?.targets.filter(
          (target) => target.outcome === 'changed',
        ).length ?? plan.targets.length
      toast.success(
        t('agent.plan.success', {
          action: t(`agent.operation.${plan.action}`),
          count: changedCount,
        }),
      )
    } else {
      toast.error(result.error || t('agent.error.operationFailed'))
    }
  }

  const handleExecute = () => {
    if (deletesFiles) {
      Prompt.prompt({
        description: t('agent.plan.deleteFiles.description', {
          count: plan.targets.length,
        }),
        onCancelText: t('buttons.cancel'),
        onConfirm: () => execute(true),
        onConfirmText: t('agent.plan.deleteFiles.confirm'),
        title: t('agent.plan.deleteFiles.title'),
        variant: 'danger',
      })
      return
    }
    void execute()
  }

  return (
    <section
      className={`mt-3 overflow-hidden rounded-xl border ${isDestructive ? 'border-red/30 bg-red/5' : 'border-orange/30 bg-orange/5'}`}
    >
      <div
        className={`flex items-start gap-3 border-b ${dividerClass} px-3 py-3`}
      >
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${isDestructive ? 'bg-red/12 text-red' : 'bg-orange/12 text-orange'}`}
        >
          <i className={operationIcons[plan.action]} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-text">
              {t('agent.plan.title', {
                action: t(`agent.operation.${plan.action}`),
              })}
            </h4>
            <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
              {t(`agent.plan.status.${plan.status}`)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-secondary">
            {t('agent.plan.targetCount', { count: plan.targets.length })}
          </p>
        </div>
      </div>

      <div className="space-y-1 px-3 py-2.5">
        {visibleTargets.map((target) => {
          const change = targetChange(plan, target, changeLabels)
          const outcome = targetOutcome(plan, target)
          return (
            <div className="flex items-center gap-2 text-xs" key={target.hash}>
              <span
                className={`size-1.5 shrink-0 rounded-full ${isDestructive ? 'bg-red/60' : 'bg-orange/60'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-text" title={target.name}>
                  {target.name}
                </p>
                <p
                  className="truncate text-[10px] text-text-tertiary"
                  title={change}
                >
                  {change}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${outcomeClasses[outcome]}`}
              >
                {t(`agent.plan.outcome.${outcome}`)}
              </span>
            </div>
          )
        })}
        {plan.targets.length > visibleTargets.length && (
          <p className="pl-3.5 text-xs text-text-tertiary">
            {t('agent.plan.moreTargets', {
              count: plan.targets.length - visibleTargets.length,
            })}
          </p>
        )}
      </div>

      {plan.error && (
        <p className="border-t border-red/15 bg-red/5 px-3 py-2 text-xs text-red">
          {plan.error}
        </p>
      )}

      {(isPending || isExecuting) && (
        <div
          className={`flex items-center justify-between gap-3 border-t ${dividerClass} px-3 py-2.5`}
        >
          <p className="text-[11px] leading-4 text-text-tertiary">
            {t(
              plan.action === 'add_torrent'
                ? 'agent.plan.add.confirmHint'
                : 'agent.plan.revalidateHint',
            )}
          </p>
          <Button
            className="shrink-0 px-3 py-1.5 text-xs"
            disabled={isExecuting}
            isLoading={isExecuting}
            size="sm"
            variant={isDestructive ? 'destructive' : 'primary'}
            onClick={handleExecute}
          >
            {deletesFiles ? t('agent.plan.continue') : t('agent.plan.confirm')}
          </Button>
        </div>
      )}
    </section>
  )
}

const AssistantMessage = ({ message }: { message: AgentChatUiMessage }) => {
  const { t } = useTranslation()
  const isStreaming = message.status === 'streaming'

  return (
    <Message from="assistant">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-fill-secondary text-accent">
        <i className="i-mingcute-brain-line text-sm" />
      </div>
      <MessageContent from="assistant">
        {message.activities.length > 0 && (
          <div className="mb-3 space-y-1">
            {message.activities.map((activity) => (
              <Tool activity={activity} key={activity.id} />
            ))}
          </div>
        )}
        {message.reasoning && (
          <Reasoning isStreaming={isStreaming} label={t('agent.reasoning')}>
            {message.reasoning}
          </Reasoning>
        )}
        {message.content ? (
          <MessageResponse isAnimating={isStreaming}>
            {message.content}
          </MessageResponse>
        ) : (
          isStreaming && (
            <div className="flex items-center gap-2 text-text-tertiary">
              <i className="i-mingcute-loading-3-line animate-spin" />
              <span>{t('agent.thinking')}</span>
            </div>
          )
        )}
        {message.plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
        {message.metadata && <MessageMetadataBar metadata={message.metadata} />}
      </MessageContent>
    </Message>
  )
}

const UserMessage = ({ message }: { message: AgentChatUiMessage }) => {
  const { t } = useTranslation()

  return (
    <Message from="user">
      <MessageContent from="user">
        {message.content}
        {message.context ? (
          <div className="mt-2 max-w-full overflow-x-auto pb-0.5 opacity-80">
            <AgentContextChips
              context={message.context}
              label={t('agent.context.messageScope')}
            />
          </div>
        ) : null}
      </MessageContent>
    </Message>
  )
}

const EmptyState = ({ selectedCount }: { selectedCount: number }) => {
  const { t } = useTranslation()
  const suggestions = [
    selectedCount > 0
      ? t('agent.suggestion.inspectSelected', { count: selectedCount })
      : t('agent.suggestion.summarizeQueue'),
    t('agent.suggestion.findStalled'),
    selectedCount > 0
      ? t('agent.suggestion.organizeSelected')
      : t('agent.suggestion.organizeCompleted'),
  ]

  return (
    <div className="flex min-h-full flex-col justify-center px-5 py-8">
      <div className="mb-6">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-fill-secondary text-accent shadow-sm">
          <i className="i-mingcute-brain-line text-xl" />
        </div>
        <h3 className="text-base font-semibold text-text">
          {t('agent.empty.title')}
        </h3>
        <p className="mt-1 max-w-sm text-sm leading-5 text-text-secondary">
          {t('agent.empty.description')}
        </p>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion, index) => (
          <button
            className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:border-accent/30 hover:bg-fill-secondary hover:text-text"
            key={suggestion}
            type="button"
            onClick={() => void actions.send(suggestion)}
          >
            <i
              className={
                index === 0
                  ? 'i-mingcute-list-check-3-line text-accent'
                  : index === 1
                    ? 'i-mingcute-search-2-line text-orange'
                    : 'i-mingcute-flash-line text-green'
              }
            />
            <span className="flex-1">{suggestion}</span>
            <i className="i-mingcute-arrow-right-line text-text-quaternary transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  )
}

export const AgentChatPanel = () => {
  const { t, i18n } = useTranslation()
  const draft = useAgentChatStore((state) => state.draft)
  const draftContext = useAgentChatStore((state) => state.draftContext)
  const error = useAgentChatStore((state) => state.error)
  const isDemo = useAgentChatStore((state) => state.isDemo)
  const isRunning = useAgentChatStore((state) => state.isRunning)
  const messages = useAgentChatStore((state) => state.messages)
  const torrentContext = useTorrentDataStore(
    useShallow((state) => ({
      filterState: state.filterState,
      searchQuery: state.searchQuery,
      selectedTorrentHashes: state.selectedTorrents,
      visibleTorrentCount: state.sortedTorrents.length,
    })),
  )
  const serverContext = useMultiServerStore(
    useShallow((state) => {
      const activeServer = state.activeServerId
        ? state.servers[state.activeServerId]
        : null
      return {
        activeServerId: state.activeServerId,
        activeServerName: activeServer?.name ?? null,
      }
    }),
  )
  const activeTorrentHash = useTorrentTableSelectors.useActiveTorrentHash()
  const liveContext = createAgentContext({
    ...serverContext,
    ...torrentContext,
    locale: i18n.language,
    selectedTorrentHashes:
      torrentContext.selectedTorrentHashes.length > 0
        ? torrentContext.selectedTorrentHashes
        : activeTorrentHash
          ? [activeTorrentHash]
          : [],
  })
  const composerContext = draftContext ?? liveContext
  const selectedCount = composerContext.selectedTorrentHashes.length
  const displayError = error
    ? i18n.exists(error)
      ? String(i18n.t(error as never))
      : error
    : null

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 overflow-x-auto border-b border-border bg-fill-secondary/20 px-3 py-2">
        <AgentContextChips
          label={t('agent.context.draftScope')}
          pinned={Boolean(draftContext)}
          removable={!isDemo}
          context={
            isDemo
              ? {
                  ...composerContext,
                  activeServerId: 'local-demo',
                  activeServerName: t('agent.demo.badge'),
                  selectedTorrentHashes: [],
                  visibleTorrentCount: 12,
                }
              : composerContext
          }
        />
      </div>

      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <EmptyState selectedCount={selectedCount} />
          ) : (
            <div className="space-y-5 px-4 py-5">
              {messages.map((message) =>
                message.role === 'user' ? (
                  <UserMessage key={message.id} message={message} />
                ) : (
                  <AssistantMessage key={message.id} message={message} />
                ),
              )}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t border-border bg-background p-3">
        {displayError && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-red/20 bg-red/5 px-2.5 py-2 text-xs text-red">
            <i className="i-mingcute-warning-line mt-0.5 shrink-0" />
            <span className="min-w-0 break-words">{displayError}</span>
          </div>
        )}
        <div className="rounded-xl border border-border bg-background shadow-sm transition-colors focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/10">
          <Textarea
            data-agent-composer
            aria-label={t('agent.composer.placeholder')}
            className="max-h-32 min-h-[68px] resize-none border-0 bg-transparent px-3 py-2.5 shadow-none focus:ring-0"
            disabled={isRunning || isDemo}
            value={draft}
            placeholder={
              isDemo
                ? t('agent.demo.readOnly')
                : t('agent.composer.placeholder')
            }
            onChange={(event) => actions.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void actions.send()
              }
            }}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="px-1 text-[10px] text-text-quaternary">
              {isDemo ? t('agent.demo.readOnly') : t('agent.composer.hint')}
            </span>
            {isRunning ? (
              <Button
                className="size-8 rounded-lg p-0"
                title={t('agent.stop')}
                variant="secondary"
                onClick={() => actions.cancel()}
              >
                <i className="i-mingcute-stop-fill" />
              </Button>
            ) : (
              <Button
                className="size-8 rounded-lg p-0"
                disabled={isDemo || !draft.trim()}
                title={t('agent.send')}
                onClick={() => void actions.send()}
              >
                <i className="i-mingcute-arrow-up-line text-base" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
