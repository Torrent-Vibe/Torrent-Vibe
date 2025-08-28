'use client'

import { ErrorElement } from '~/components/common/ErrorElement'

export default function Error({
  error: _error,
}: {
  error: Error & { digest?: string }
}) {
  return <ErrorElement />
}
