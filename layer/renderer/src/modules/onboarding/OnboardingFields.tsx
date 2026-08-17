import type { Control, UseFormGetValues } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Checkbox } from '~/components/ui/checkbox'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'

import type { OnboardingFormData } from './onboardingStorage'
import { saveFormFieldToStorage } from './onboardingStorage'

export interface FormValidationRules {
  hostMessage: string
  portMax: number
  portMessage: string
  portMin: number
  usernameMessage: string
}

interface Props {
  control: Control<OnboardingFormData>
  getValues: UseFormGetValues<OnboardingFormData>
  showUseCurrentPath?: boolean
  useCurrentPath?: boolean
  validation: FormValidationRules
}

export function OnboardingFields(props: Props) {
  const { control, getValues, useCurrentPath, showUseCurrentPath, validation } =
    props
  const { t } = useTranslation()

  return (
    <>
      {showUseCurrentPath && (
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name={'useCurrentPath'}
            render={({ field }) => (
              <Checkbox
                checked={Boolean(field.value)}
                id="useCurrentPath"
                onCheckedChange={(v) => {
                  const checked = Boolean(v)
                  field.onChange(checked)
                  saveFormFieldToStorage('useCurrentPath', checked)
                }}
              />
            )}
          />
          <Label htmlFor="useCurrentPath">
            {t('onboarding.fields.useCurrentPath.label')}
          </Label>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="host">{t('onboarding.fields.host.label')}</Label>
        <Controller
          control={control}
          name={'host'}
          render={({ field, fieldState }) => (
            <Input
              aria-invalid={Boolean(fieldState.error)}
              disabled={useCurrentPath}
              id="host"
              placeholder={t('onboarding.fields.host.placeholder')}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={(e) => {
                field.onBlur()
                saveFormFieldToStorage('host', e.target.value.trim())
              }}
            />
          )}
          rules={{
            validate: (v: string) =>
              getValues('useCurrentPath') ||
              v.trim() !== '' ||
              validation.hostMessage,
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="port">{t('onboarding.fields.port.label')}</Label>
        <Controller
          control={control}
          name={'port'}
          render={({ field, fieldState }) => (
            <Input
              aria-invalid={Boolean(fieldState.error)}
              disabled={useCurrentPath}
              id="port"
              max={validation.portMax}
              min={validation.portMin}
              placeholder={t('onboarding.fields.port.placeholder')}
              type="number"
              value={field.value ?? ''}
              onBlur={(e) => {
                field.onBlur()
                const v = e.target.value
                const n = Number(v)
                if (!Number.isNaN(n) && n > 0) {
                  saveFormFieldToStorage('port', n)
                }
              }}
              onChange={(e) => {
                const v = e.target.value
                ;(field as any).onChange(v === '' ? undefined : Number(v))
              }}
            />
          )}
          rules={{
            validate: (v: any) => {
              if (getValues('useCurrentPath')) return true
              if (v === undefined || v === null) return validation.portMessage
              const n = Number(v)
              if (Number.isNaN(n)) return validation.portMessage
              if (n < validation.portMin || n > validation.portMax)
                return validation.portMessage
              return true
            },
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username">
          {t('onboarding.fields.username.label')}
        </Label>
        <Controller
          control={control}
          name={'username'}
          render={({ field, fieldState }) => (
            <Input
              aria-invalid={Boolean(fieldState.error)}
              id="username"
              placeholder={t('onboarding.fields.username.placeholder')}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={(e) => {
                field.onBlur()
                saveFormFieldToStorage('username', e.target.value.trim())
              }}
            />
          )}
          rules={{
            validate: (v: string) =>
              v.trim() !== '' || validation.usernameMessage,
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          {t('onboarding.fields.password.label')}
        </Label>
        <Controller
          control={control}
          name={'password'}
          render={({ field }) => (
            <Input
              id="password"
              type="password"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={(e) => {
                field.onBlur()
                saveFormFieldToStorage('password', e.target.value)
              }}
            />
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={'useHttps'}
          render={({ field }) => (
            <Checkbox
              checked={Boolean(field.value)}
              id="useHttps"
              disabled={
                (typeof window !== 'undefined' &&
                  window.location.protocol === 'https:') ||
                Boolean(useCurrentPath) ||
                useCurrentPath
              }
              onCheckedChange={(v) => {
                field.onChange(Boolean(v))
                saveFormFieldToStorage('useHttps', Boolean(v))
              }}
            />
          )}
        />
        <Label htmlFor="useHttps">
          {t('onboarding.fields.useHttps.label')}
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={'rememberPassword'}
          render={({ field }) => (
            <Checkbox
              checked={Boolean(field.value)}
              id="rememberPassword"
              onCheckedChange={(v) => {
                field.onChange(Boolean(v))
                saveFormFieldToStorage('rememberPassword', Boolean(v))
              }}
            />
          )}
        />
        <Label htmlFor="rememberPassword">
          {t('onboarding.fields.rememberPassword.label')}
        </Label>
      </div>
    </>
  )
}
