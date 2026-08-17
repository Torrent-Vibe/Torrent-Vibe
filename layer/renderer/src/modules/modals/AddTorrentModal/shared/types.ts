import type { TorrentFormData, TorrentFormHandlers } from '../types'

export interface AddTorrentModalProps {
  initialFiles?: File[]
  initialMagnetLinks?: string
}

export interface AddTorrentModalSharedProps {
  categories: Record<string, any> | undefined | null
  formData: TorrentFormData
  handlers: TorrentFormHandlers
  handleSubmit: (e: React.FormEvent) => Promise<void>
  isFormValid: boolean
  isLoading: boolean
  resetFormData: () => void
  setFormData: React.Dispatch<React.SetStateAction<TorrentFormData>>
  setIsLoading: (loading: boolean) => void
}
