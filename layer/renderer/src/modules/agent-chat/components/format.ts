export const formatDuration = (milliseconds?: number) =>
  milliseconds === undefined
    ? '—'
    : milliseconds < 1_000
      ? `${milliseconds} ms`
      : `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`

export const formatCost = (cost: number | null) =>
  cost === null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        currency: 'USD',
        maximumFractionDigits: 6,
        minimumFractionDigits: cost > 0 && cost < 0.01 ? 4 : 2,
        style: 'currency',
      }).format(cost)
