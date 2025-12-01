import { useRef, useState } from 'react'

import { Label } from '~/components/ui/label/Label'
import { cn } from '~/lib/cn'

import type { TorrentFormData, TorrentFormHandlers } from './types'

interface FileUploadAreaProps {
  formData: TorrentFormData
  handlers: TorrentFormHandlers
}

export const FileUploadArea = ({ formData, handlers }: FileUploadAreaProps) => {
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (files: File[]) => {
    if (files.length > 0) {
      void handlers.handleFilesSelected(files)
    }
  }

  const removeFile = (index: number) => {
    void handlers.removeFile(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    handleFileSelect(files)
  }

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors duration-200',
          dragActive
            ? 'border-accent bg-accent/5'
            : 'border-border hover:border-accent/50 hover:bg-fill/50',
          formData.files.length > 0 && 'border-green bg-green/5',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".torrent"
          multiple
          onChange={(e) =>
            e.target.files && handleFileSelect(Array.from(e.target.files))
          }
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        <div className="text-center">
          {formData.files.length > 0 ? (
            <div className="space-y-2">
              <i className="i-mingcute-file-check-line text-2xl text-green" />
              <p className="text-sm font-medium text-text">
                <span>{formData.files.length} file</span>
                <span>{formData.files.length > 1 ? 's' : ''}</span>
                <span> selected</span>
              </p>
              <p className="text-xs text-text-secondary">
                {(
                  formData.files.reduce((sum, file) => sum + file.size, 0) /
                  1024
                ).toFixed(1)}{' '}
                KB total
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <i
                className={cn(
                  'text-2xl transition-colors',
                  dragActive
                    ? 'i-mingcute-download-line text-accent'
                    : 'i-mingcute-file-line text-text-secondary',
                )}
              />
              <div>
                <p className="text-sm font-medium text-text">
                  {dragActive
                    ? 'Drop your torrent files here'
                    : 'Choose torrent files'}
                </p>
                <p className="text-xs text-text-secondary">
                  or drag and drop (multiple files supported)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File List for multiple files */}
      {formData.files.length > 0 && (
        <div className="flex flex-col gap-2 min-w-0 mt-2">
          <Label variant="form" className="text-text-secondary">
            Selected Files
          </Label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {formData.files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified || index}`}
                className="flex items-center gap-2 bg-fill/30 rounded-md px-3 py-2"
              >
                <i className="i-mingcute-file-line text-text-secondary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-text-secondary hover:text-red transition-colors p-1 flex-shrink-0"
                >
                  <i className="i-mingcute-close-line text-sm" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {handlers.previewState.source === 'file' && (
        <div className="text-xs text-text-secondary">
          {handlers.previewState.status === 'error' &&
          handlers.previewState.error ? (
            <span className="text-red">{handlers.previewState.error}</span>
          ) : null}
        </div>
      )}
    </div>
  )
}
