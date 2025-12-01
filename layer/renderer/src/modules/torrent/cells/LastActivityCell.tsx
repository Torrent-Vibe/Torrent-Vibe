import { DateTimeCell } from './DateTimeCell'

interface LastActivityCellProps {
  rowIndex: number
}

export const LastActivityCell = ({ rowIndex }: LastActivityCellProps) => {
  return (
    <DateTimeCell rowIndex={rowIndex} format="relative" field="last_activity" />
  )
}
