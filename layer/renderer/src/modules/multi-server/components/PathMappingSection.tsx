import type { DragEndEvent } from '@dnd-kit/core'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { PathMappingEntry } from '~/atoms/settings/path-mappings'
import {
  removePathMapping,
  setPathMappings,
  updatePathMapping,
  usePathMappings,
} from '~/atoms/settings/path-mappings'
import { Button } from '~/components/ui/button'
import { Modal } from '~/components/ui/modal/ModalManager'
import { Prompt } from '~/components/ui/prompts/Prompt'
import { Switch } from '~/components/ui/switch'
import { cn } from '~/lib/cn'
import { SettingSectionCard } from '~/modules/modals/SettingsModal/tabs/components'

import { useMultiServerStore } from '../stores/multi-server-store'
import { PathMappingModal } from './PathMappingModal'

export const PathMappingSection = () => {
  const { t } = useTranslation('setting')
  const mappings = usePathMappings()
  const servers = useMultiServerStore((state) => state.servers)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const sortableIds = useMemo(() => mappings.map((item) => item.id), [mappings])

  const handleRemove = async (id: string) => {
    await Prompt.prompt({
      title: t('servers.pathMapping.removeConfirmTitle'),
      description: t('servers.pathMapping.removeConfirmMessage'),
      onConfirmText: t('servers.pathMapping.remove'),
      onCancelText: t('servers.pathMapping.modal.cancel'),
      variant: 'danger',
      onConfirm: () => {
        removePathMapping(id)
      },
    })
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setPathMappings((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id)
      const newIndex = prev.findIndex((item) => item.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }, [])

  return (
    <SettingSectionCard
      title={t('servers.pathMapping.title')}
      description={t('servers.pathMapping.description')}
    >
      <div className="space-y-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            {mappings.length === 0 ? (
              <div className="border border-dashed border-border rounded-md p-4 text-sm text-text-secondary">
                {t('servers.pathMapping.empty')}
              </div>
            ) : (
              mappings.map((mapping, index) => {
                const serverLabel = mapping.serverId
                  ? servers[mapping.serverId]?.name || mapping.serverId
                  : t('servers.pathMapping.serverAny')

                const remoteDisplay =
                  mapping.remoteBasePath ||
                  t('servers.pathMapping.fallbackName', {
                    index: index + 1,
                  })
                const localDisplay = mapping.localBasePath || '—'

                return (
                  <SortableMappingRow
                    key={mapping.id}
                    mapping={mapping}
                    remoteLabel={remoteDisplay}
                    localLabel={localDisplay}
                    serverLabel={serverLabel}
                    onToggle={(checked) =>
                      updatePathMapping(mapping.id, {
                        enabled: Boolean(checked),
                      })
                    }
                    onEdit={() =>
                      Modal.present(PathMappingModal, {
                        mode: 'edit',
                        mappingId: mapping.id,
                      })
                    }
                    onRemove={() => handleRemove(mapping.id)}
                  />
                )
              })
            )}
          </SortableContext>
        </DndContext>

        <Button
          onClick={() =>
            Modal.present(PathMappingModal, {
              mode: 'create',
            })
          }
          variant="secondary"
        >
          <i className="i-lucide-plus mr-1 size-4" />
          {t('servers.pathMapping.add')}
        </Button>
      </div>
    </SettingSectionCard>
  )
}

type SortableMappingRowProps = {
  mapping: PathMappingEntry
  remoteLabel: string
  localLabel: string
  serverLabel: string
  onToggle: (checked: boolean) => void
  onEdit: () => void
  onRemove: () => void
}

const SortableMappingRow = ({
  mapping,
  remoteLabel,
  localLabel,
  serverLabel,
  onToggle,
  onEdit,
  onRemove,
}: SortableMappingRowProps) => {
  const { t } = useTranslation('setting')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mapping.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 shadow-sm transition-colors',
          isDragging && 'ring-2 ring-accent/40',
          !mapping.enabled && 'opacity-60',
        )}
      >
        <button
          type="button"
          className="text-text-tertiary inline-flex items-center hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 rounded-md p-1 -ml-1 cursor-grab active:cursor-grabbing"
          aria-label={t('servers.pathMapping.a11y.dragHandle')}
          {...attributes}
          {...listeners}
        >
          <i className="i-lucide-grip size-4" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
            <span className="truncate max-w-[45%]" title={localLabel}>
              {localLabel}
            </span>
            <i className="i-lucide-arrow-left-right size-4 text-text-tertiary" />
            <span
              className="truncate max-w-[45%] text-text-secondary"
              title={remoteLabel}
            >
              {remoteLabel}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <i className="i-mingcute-server-2-line size-3.5" />
              <span className="truncate max-w-[180px]" title={serverLabel}>
                {serverLabel}
              </span>
            </span>
            {mapping.caseSensitive && (
              <span className="flex items-center gap-1">
                <i className="i-mingcute-keyboard-line size-3.5" />
                {t('servers.pathMapping.caseSensitive')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span>{t('servers.pathMapping.enabled')}</span>
            <Switch
              checked={mapping.enabled}
              onCheckedChange={(checked) => onToggle(Boolean(checked))}
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="text-text-secondary hover:text-text p-2 -mr-2"
            aria-label={t('servers.pathMapping.edit')}
          >
            <i className="i-mingcute-edit-2-line size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red hover:text-red p-2"
            onClick={onRemove}
            aria-label={t('servers.pathMapping.remove')}
          >
            <i className="i-lucide-trash-2 size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
