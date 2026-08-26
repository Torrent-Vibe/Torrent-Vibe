import type {
  AgentOperationPlan,
  AgentOperationTarget,
  AgentOperationTargetOutcome,
  AgentTorrentOperation,
} from '@torrent-vibe/shared'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button/Button'
import { Prompt } from '~/components/ui/prompts/Prompt'
import { formatSpeed } from '~/lib/format'

import { AgentChatActions } from '../actions'

const actions = AgentChatActions.shared

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
    return `${target.name} → ${target.newName ?? plan.newName}`
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

export const PlanCard = ({ plan }: { plan: AgentOperationPlan }) => {
  const { t } = useTranslation()
  const isPending = plan.status === 'pending'
  const isExecuting = plan.status === 'executing'
  const isDestructive = plan.action === 'remove_torrent'
  const deletesFiles = isDestructive && plan.deleteFiles === true
  const visibleTargets = plan.targets.slice(0, 2)
  const showTargetChange =
    plan.action === 'rename_torrent' ||
    plan.action === 'move_torrent' ||
    plan.action === 'remove_torrent' ||
    plan.action === 'add_torrent' ||
    plan.action === 'set_category'
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

  const accent = isDestructive ? 'border-red/50' : 'border-orange/50'
  const iconColor = isDestructive ? 'text-red' : 'text-orange'

  if (!isPending && !isExecuting) {
    return (
      <section className={`border-l-2 py-1 pl-3 ${accent}`}>
        <div className="flex items-center gap-2 text-xs">
          <i
            className={`${operationIcons[plan.action]} shrink-0 ${iconColor}`}
          />
          <p className="min-w-0 flex-1 truncate text-text">
            {t('agent.plan.title', {
              action: t(`agent.operation.${plan.action}`),
            })}
          </p>
          <span className="shrink-0 text-text-tertiary">
            {t('agent.plan.targetCount', { count: plan.targets.length })}
            {' · '}
            {t(`agent.plan.status.${plan.status}`)}
          </span>
        </div>
        {plan.error ? (
          <p className="mt-1 text-[11px] text-red">{plan.error}</p>
        ) : null}
      </section>
    )
  }

  return (
    <section className={`border-l-2 py-1 pl-3 ${accent}`}>
      <div className="flex items-center gap-2">
        <i className={`${operationIcons[plan.action]} shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-text">
            {t('agent.plan.title', {
              action: t(`agent.operation.${plan.action}`),
            })}
          </h4>
          <p className="text-[11px] text-text-tertiary">
            {t('agent.plan.targetCount', { count: plan.targets.length })}
          </p>
        </div>
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

      <div className="mt-2 space-y-1">
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
                {showTargetChange ? (
                  <p
                    className="truncate text-[10px] text-text-tertiary"
                    title={change}
                  >
                    {change}
                  </p>
                ) : null}
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

      {plan.error ? (
        <p className="mt-2 text-xs text-red">{plan.error}</p>
      ) : null}
    </section>
  )
}
