import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  addPathMapping,
  updatePathMapping,
  usePathMappings,
} from '~/atoms/settings/path-mappings'
import { Button } from '~/components/ui/button'
import { DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'
import type { ModalComponent } from '~/components/ui/modal/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Switch } from '~/components/ui/switch'
import { ipcServices } from '~/lib/ipc-client'

import { useMultiServerStore } from '../stores/multi-server-store'

interface PathMappingModalProps {
  mode: 'create' | 'edit'
  mappingId?: string
}

type FormState = {
  remoteBasePath: string
  localBasePath: string
  serverId: string
  caseSensitive: boolean
}

const DEFAULT_FORM_STATE: FormState = {
  remoteBasePath: '',
  localBasePath: '',
  serverId: 'all',
  caseSensitive: false,
}

export const PathMappingModal: ModalComponent<PathMappingModalProps> = ({
  mode,
  mappingId,
  dismiss,
}) => {
  const { t } = useTranslation('setting')
  const mappings = usePathMappings()
  const servers = useMultiServerStore((state) => state.servers)
  const order = useMultiServerStore((state) => state.order)
  const isElectron = typeof ELECTRON !== 'undefined' && ELECTRON

  const mapping = useMemo(() => {
    if (mode !== 'edit' || !mappingId) return null
    return mappings.find((item) => item.id === mappingId) ?? null
  }, [mode, mappingId, mappings])

  useEffect(() => {
    if (mode === 'edit' && !mapping) {
      dismiss()
    }
  }, [mode, mapping, dismiss])

  const initialState = useMemo<FormState>(() => {
    if (mode === 'edit' && mapping) {
      return {
        remoteBasePath: mapping.remoteBasePath,
        localBasePath: mapping.localBasePath,
        serverId: mapping.serverId ?? 'all',
        caseSensitive: mapping.caseSensitive,
      }
    }
    return DEFAULT_FORM_STATE
  }, [mode, mapping])

  const [formState, setFormState] = useState<FormState>(initialState)

  useEffect(() => {
    setFormState(initialState)
  }, [initialState])

  const serverOptions = useMemo(() => {
    const options = order.map((id) => ({
      id,
      name: servers[id]?.name || id,
    }))

    if (
      formState.serverId !== 'all' &&
      !options.some((option) => option.id === formState.serverId)
    ) {
      options.push({ id: formState.serverId, name: formState.serverId })
    }

    return options
  }, [order, servers, formState.serverId])

  const canSave =
    Boolean(formState.remoteBasePath.trim()) &&
    Boolean(formState.localBasePath.trim())

  const [selectingLocalPath, setSelectingLocalPath] = useState(false)

  const handleSelectLocalPath = useCallback(async () => {
    if (!isElectron || !ipcServices?.fileSystem?.selectDirectory) {
      toast.error(t('servers.pathMapping.selectLocalPathUnsupported'))
      return
    }

    try {
      setSelectingLocalPath(true)
      const result = await ipcServices.fileSystem.selectDirectory({
        defaultPath: formState.localBasePath || undefined,
        title: t('servers.pathMapping.selectLocalPathDialogTitle'),
      })

      if (!result?.canceled && result.path) {
        setFormState((prev) => ({
          ...prev,
          localBasePath: result.path ?? '',
        }))
      }
    } catch (error) {
      console.error('Failed to select local path', error)
      toast.error(t('servers.pathMapping.selectLocalPathFailed'))
    } finally {
      setSelectingLocalPath(false)
    }
  }, [formState.localBasePath, isElectron, t])

  const handleSave = () => {
    if (!canSave) return

    const payload = {
      remoteBasePath: formState.remoteBasePath.trim(),
      localBasePath: formState.localBasePath.trim(),
      serverId: formState.serverId === 'all' ? null : formState.serverId,
      caseSensitive: formState.caseSensitive,
    }

    if (mode === 'edit' && mappingId) {
      updatePathMapping(mappingId, payload)
    } else {
      addPathMapping({ ...payload, enabled: true })
    }

    dismiss()
  }

  const title =
    mode === 'edit'
      ? t('servers.pathMapping.modal.editTitle')
      : t('servers.pathMapping.modal.createTitle')

  return (
    <div>
      <DialogHeader className="mb-4">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label
            variant="form"
            className="text-xs font-medium text-text-secondary"
            htmlFor="mapping-local"
          >
            {t('servers.pathMapping.localLabel')}
          </Label>
          <Input
            id="mapping-local"
            value={formState.localBasePath}
            placeholder="\\\\nas\\\\downloads or smb://nas/downloads"
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                localBasePath: event.target.value,
              }))
            }
            endAdornmentVisibility="always"
            endAdornment={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="p-2 -mr-2 !bg-transparent"
                onClick={handleSelectLocalPath}
                disabled={!isElectron || selectingLocalPath}
                aria-label={t('servers.pathMapping.selectLocalPath')}
                title={t('servers.pathMapping.selectLocalPath')}
              >
                {selectingLocalPath ? (
                  <i className="i-mingcute-loading-3-line animate-spin" />
                ) : (
                  <i className="i-mingcute-folder-open-line text-lg" />
                )}
                <span className="sr-only">
                  {t('servers.pathMapping.selectLocalPath')}
                </span>
              </Button>
            }
          />
        </div>

        <div>
          <Label
            variant="form"
            className="text-xs font-medium text-text-secondary"
            htmlFor="mapping-remote"
          >
            {t('servers.pathMapping.remoteLabel')}
          </Label>
          <Input
            id="mapping-remote"
            value={formState.remoteBasePath}
            placeholder="/downloads"
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                remoteBasePath: event.target.value,
              }))
            }
          />
        </div>

        <div>
          <Label
            variant="form"
            className="text-xs font-medium text-text-secondary"
            htmlFor="mapping-server"
          >
            {t('servers.pathMapping.serverScope')}
          </Label>
          <Select
            value={formState.serverId}
            onValueChange={(value) =>
              setFormState((prev) => ({
                ...prev,
                serverId: value,
              }))
            }
          >
            <SelectTrigger id="mapping-server">
              <SelectValue placeholder={t('servers.pathMapping.serverAny')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('servers.pathMapping.serverAny')}
              </SelectItem>
              {serverOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <div>
            <div className="text-xs font-medium text-text">
              {t('servers.pathMapping.caseSensitive')}
            </div>
            <div className="text-[11px] text-text-secondary">
              {t('servers.pathMapping.caseSensitiveHint')}
            </div>
          </div>
          <Switch
            checked={formState.caseSensitive}
            onCheckedChange={(checked) =>
              setFormState((prev) => ({
                ...prev,
                caseSensitive: Boolean(checked),
              }))
            }
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {t('servers.pathMapping.modal.cancel')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          {t('servers.pathMapping.modal.save')}
        </Button>
      </div>
    </div>
  )
}

export default PathMappingModal

PathMappingModal.contentClassName = 'w-full max-w-lg'
