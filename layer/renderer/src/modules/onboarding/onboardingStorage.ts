import { getI18n } from '~/i18n'

export interface OnboardingFormData {
  host: string
  port?: number
  username: string
  password: string
  useHttps: boolean
  rememberPassword: boolean
  useCurrentPath?: boolean
}

export const ONBOARDING_FORM_STORAGE_KEY = 'onboarding-form-data'

export const saveFormFieldToStorage = (
  field: keyof OnboardingFormData,
  value: string | number | boolean,
) => {
  try {
    const existingData = localStorage.getItem(ONBOARDING_FORM_STORAGE_KEY)
    const data = existingData ? JSON.parse(existingData) : {}
    data[field] = value
    localStorage.setItem(ONBOARDING_FORM_STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.warn(`${getI18n().t('messages.preferencesSaveFailed')}:`, error)
  }
}

export const loadFormDataFromStorage = (): Partial<OnboardingFormData> => {
  try {
    const data = localStorage.getItem(ONBOARDING_FORM_STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.warn(`${getI18n().t('messages.preferencesLoadFailed')}:`, error)
    return {}
  }
}

export const clearFormDataFromStorage = () => {
  try {
    localStorage.removeItem(ONBOARDING_FORM_STORAGE_KEY)
  } catch (error) {
    console.warn(`${getI18n().t('messages.preferencesLoadFailed')}:`, error)
  }
}
