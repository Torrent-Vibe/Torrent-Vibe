import type { TorrentFormData, TorrentFormHandlers } from '../types'

export interface AddTorrentModalProps {
  initialFiles?: File[]
  initialMagnetLinks?: string
}

export interface AddTorrentModalSharedProps {
  formData: TorrentFormData
  setFormData: React.Dispatch<React.SetStateAction<TorrentFormData>>
  resetFormData: () => void
  isFormValid: boolean
  categories: Record<string, any> | undefined | null
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  handleSubmit: (e: React.FormEvent) => Promise<void>
  handlers: TorrentFormHandlers
}
