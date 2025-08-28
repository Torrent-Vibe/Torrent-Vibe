import { useEffect, useRef } from 'react'

import { attachOpenInEditor } from '~/lib/dev'

import { Button } from '../ui/button'

interface ErrorElementProps {
  error?: Error
  message?: string
}

export function ErrorElement({
  error,
  message: customMessage,
}: ErrorElementProps = {}) {
  const message =
    customMessage ||
    (error instanceof Error ? error.message : 'An unexpected error occurred')
  const stack = error instanceof Error ? error.stack : null

  useEffect(() => {
    if (error) {
      console.error('Error handled by ErrorElement:', error)
    }
  }, [error])

  const reloadRef = useRef(false)
  if (
    message.startsWith('Failed to fetch dynamically imported module') &&
    window.sessionStorage.getItem('reload') !== '1'
  ) {
    if (reloadRef.current) return null
    window.sessionStorage.setItem('reload', '1')
    window.location.reload()
    reloadRef.current = true
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header spacer */}
      <div className="h-16" />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full">
          {/* Error icon and status */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background-secondary mb-4">
              <svg
                className="w-8 h-8 text-red"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-medium text-text mb-2">
              Something went wrong
            </h1>
            <p className="text-text-secondary text-lg">
              We encountered an unexpected error
            </p>
          </div>

          {/* Error message */}
          <div className="bg-material-medium rounded-lg border border-fill-tertiary p-4 mb-6">
            <p className="text-sm font-mono text-text-secondary break-words">
              {message}
            </p>
          </div>

          {/* Stack trace in development */}
          {process.env.NODE_ENV === 'development' && stack && (
            <div className="mb-6">
              <div className="bg-material-medium rounded-lg border border-fill-tertiary p-4 overflow-auto">
                <pre className="text-xs font-mono text-red whitespace-pre-wrap break-words">
                  {attachOpenInEditor(stack)}
                </pre>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button
              onClick={() => (window.location.href = '/')}
              className="flex-1 bg-material-opaque text-text-vibrant hover:bg-control-enabled/90 border-0 h-10 font-medium transition-colors"
            >
              Reload Application
            </Button>
            <Button
              onClick={() => window.history.back()}
              className="flex-1 bg-material-thin text-text border border-fill-tertiary hover:bg-fill-tertiary h-10 font-medium transition-colors"
            >
              Go Back
            </Button>
          </div>

          {/* Help text */}
          <div className="text-center">
            <p className="text-sm text-text-secondary mb-3">
              If this problem persists, please try refreshing the page or
              contact support.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
