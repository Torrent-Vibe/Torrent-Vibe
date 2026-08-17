import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'
import { Switch } from '~/components/ui/switch'
import { getI18n } from '~/i18n'
import { QBittorrentClient } from '~/shared/api/qbittorrent-client'
import type { QBittorrentConfig } from '~/shared/types/qbittorrent'

export interface ServerFormData {
  host: string
  name: string
  password: string
  port: string
  remember: boolean
  useHttps: boolean

  username: string
}

export interface ValidationErrors {
  baseUrl?: string
  host?: string
  name?: string
  port?: string
  username?: string
}

export interface TestResult {
  message: string
  responseTime?: number
  success: boolean
}

interface ServerConfigFormProps {
  initialData?: Partial<ServerFormData>
  isLoading?: boolean
  mode: 'add' | 'edit'
  onCancel?: () => void
  onSubmit: (data: ServerFormData) => Promise<void>
  onTest: (data: ServerFormData) => Promise<TestResult>
  testResult?: TestResult | null
}

const getInitialFormData = (
  mode: 'add' | 'edit',
  initialData?: Partial<ServerFormData>,
): ServerFormData => {
  if (mode === 'edit' && initialData) {
    return {
      name: initialData.name || '',
      host: initialData.host || '',
      port: initialData.port || '',
      username: initialData.username || '',
      password: initialData.password || '',
      useHttps: initialData.useHttps || true,

      remember: initialData.remember || false,
    }
  }

  return {
    name: 'New Server',
    host: '',
    port: '8080',
    username: 'admin',
    password: '',
    useHttps: false,
    remember: false,
  }
}

export const ServerConfigForm = ({
  mode,
  initialData,
  onSubmit,
  onTest,
  isLoading = false,
  testResult = null,
  onCancel,
}: ServerConfigFormProps) => {
  const [form, setForm] = useState(() => getInitialFormData(mode, initialData))
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [isTesting, setIsTesting] = useState(false)

  const canSubmit = form.username && form.host && form.port

  const validate = (): boolean => {
    const next: ValidationErrors = {}

    if (!form.name.trim()) next.name = 'Server name is required'
    if (!form.username.trim()) next.username = 'Username is required'

    if (!form.host.trim()) next.host = 'Host is required'
    if (!form.port.trim()) {
      next.port = 'Port is required when baseUrl is empty'
    } else if (Number.isNaN(Number(form.port))) {
      next.port = 'Port must be a number'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    try {
      await onSubmit(form)
    } catch (error) {
      console.error(`${getI18n().t('messages.serverUpdateFailed')}:`, error)
    }
  }

  const handleTest = async () => {
    if (!validate()) return

    setIsTesting(true)
    try {
      const cfg: QBittorrentConfig = {
        host: form.host,
        port: Number(form.port) || 0,
        username: form.username,
        password: form.password ?? '',
        useHttps: form.useHttps,
      }

      const client = QBittorrentClient.create(cfg)
      const startTime = Date.now()
      const ok = await client.login()
      const responseTime = Date.now() - startTime

      const result: TestResult = {
        success: ok,
        message: ok
          ? getI18n().t('messages.connectionTestSuccess', {
              message: 'Connection successful',
              responseTime,
            })
          : getI18n().t('messages.connectionTestFailed', {
              message: 'Authentication failed',
            }),
        responseTime: ok ? responseTime : undefined,
      }

      await onTest(form)

      if (ok) {
        toast.success(
          getI18n().t('messages.connectionTestSuccess', {
            message: result.message,
            responseTime,
          }),
        )
      } else {
        toast.error(
          getI18n().t('messages.connectionTestFailed', {
            message: result.message,
          }),
        )
      }
    } catch (e: any) {
      const msg = String(e?.message || e || '')
      const errorMessage = /401|unauthorized|forbidden/i.test(msg)
        ? getI18n().t('messages.connectionTestFailed', {
            message: 'Authentication failed',
          })
        : getI18n().t('messages.connectionTestFailed', {
            message: 'Network error: unable to reach server',
          })

      toast.error(errorMessage)
      await onTest(form) // Still call onTest to update parent state
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label className="mb-1" variant="form">
            Name
          </Label>
          <Input
            disabled={isLoading}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          {errors.name && (
            <div className="text-xs text-red mt-1">{errors.name}</div>
          )}
        </div>

        <div>
          <Label className="mb-1" variant="form">
            Host
          </Label>
          <Input
            disabled={isLoading}
            value={form.host}
            onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
          />
          {errors.host && (
            <div className="text-xs text-red mt-1">{errors.host}</div>
          )}
        </div>

        <div>
          <Label className="mb-1" variant="form">
            Port
          </Label>
          <Input
            disabled={isLoading}
            inputMode="numeric"
            value={form.port}
            onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
          />
          {errors.port && (
            <div className="text-xs text-red mt-1">{errors.port}</div>
          )}
        </div>

        <div>
          <Label className="mb-1" variant="form">
            Username
          </Label>
          <Input
            disabled={isLoading}
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
          />
          {errors.username && (
            <div className="text-xs text-red mt-1">{errors.username}</div>
          )}
        </div>

        <div>
          <Label className="mb-1" variant="form">
            Password
          </Label>
          <Input
            disabled={isLoading}
            type="password"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
        </div>
        <div className="flex gap-2 col-span-2 flex-col">
          <div className="flex items-center gap-2 w-full justify-between">
            <Label htmlFor="https">Use HTTPS</Label>
            <Switch
              checked={form.useHttps}
              id="https"
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, useHttps: Boolean(v) }))
              }
            />
          </div>

          <div className="flex items-center gap-2 w-full justify-between">
            <Label htmlFor="remember">Remember password</Label>
            <Switch
              checked={form.remember}
              disabled={isLoading}
              id="remember"
              onCheckedChange={(v) =>
                setForm((f) => ({ ...f, remember: Boolean(v) }))
              }
            />
          </div>
        </div>

        <div className="col-span-2 flex items-center justify-end">
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                disabled={isLoading || isTesting}
                size="sm"
                variant="ghost"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              disabled={!canSubmit || isLoading || isTesting}
              size="sm"
              variant="secondary"
              onClick={handleTest}
            >
              {isTesting ? 'Testing...' : 'Test'}
            </Button>
            <Button
              disabled={!canSubmit || isLoading || isTesting}
              size="sm"
              onClick={handleSubmit}
            >
              {isLoading
                ? 'Saving...'
                : mode === 'add'
                  ? 'Add Server'
                  : 'Save Changes'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={`col-span-2 text-xs mt-1 ${
              testResult.success ? 'text-green' : 'text-red'
            }`}
          >
            <span>{testResult.message}</span>
            {testResult.responseTime && (
              <span> ({testResult.responseTime}ms)</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
