import { DateTimeCell } from './DateTimeCell'

interface AddedOnCellProps {
  rowIndex: number
}

export const AddedOnCell = ({ rowIndex }: AddedOnCellProps) => {
  return <DateTimeCell format="relative" rowIndex={rowIndex} field="added_on" />
}
