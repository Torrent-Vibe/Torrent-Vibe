import { DateTimeCell } from './DateTimeCell'

interface CompletionCellProps {
  rowIndex: number
}

export const CompletionCell = ({ rowIndex }: CompletionCellProps) => {
  return (
    <DateTimeCell format="relative" rowIndex={rowIndex} field="completion_on" />
  )
}
