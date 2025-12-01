import { AddedOnCell } from './AddedOnCell'
import { CategoryCell } from './CategoryCell'
import { CheckboxCell } from './CheckboxCell'
import { CompletionCell } from './CompletionCell'
import { DownloadedCell } from './DownloadedCell'
import { EtaCell } from './EtaCell'
import { LastActivityCell } from './LastActivityCell'
import { NameCell } from './NameCell'
import { PeersCell } from './PeersCell'
import { PriorityCell } from './PriorityCell'
import { ProgressCell } from './ProgressCell'
import { RatioCell } from './RatioCell'
import { RemainingCell } from './RemainingCell'
import { SavePathCell } from './SavePathCell'
import { SeedingTimeCell } from './SeedingTimeCell'
import { SeedsCell } from './SeedsCell'
import { SizeCell } from './SizeCell'
import { SpeedCell } from './SpeedCell'
import { StatusCell } from './StatusCell'
import { TagsCell } from './TagsCell'
import { TimeActiveCell } from './TimeActiveCell'
import { TrackerCell } from './TrackerCell'
import { UploadedCell } from './UploadedCell'

// Static cell renderer functions - these are defined at module level
// so they don't get recreated on every render
export const SelectCellRenderer = (props: { rowIndex: number }) => (
  <CheckboxCell rowIndex={props.rowIndex} />
)

export const NameCellRenderer = (props: { rowIndex: number }) => (
  <NameCell rowIndex={props.rowIndex} />
)

export const SizeCellRenderer = (props: { rowIndex: number }) => (
  <SizeCell rowIndex={props.rowIndex} />
)

export const ProgressCellRenderer = (props: { rowIndex: number }) => (
  <ProgressCell rowIndex={props.rowIndex} />
)

export const DlspeedCellRenderer = (props: { rowIndex: number }) => (
  <SpeedCell rowIndex={props.rowIndex} speedType="dlspeed" />
)

export const UpspeedCellRenderer = (props: { rowIndex: number }) => (
  <SpeedCell rowIndex={props.rowIndex} speedType="upspeed" />
)

export const EtaCellRenderer = (props: { rowIndex: number }) => (
  <EtaCell rowIndex={props.rowIndex} />
)

export const RatioCellRenderer = (props: { rowIndex: number }) => (
  <RatioCell rowIndex={props.rowIndex} />
)

export const StateCellRenderer = (props: { rowIndex: number }) => (
  <StatusCell rowIndex={props.rowIndex} />
)

export const PriorityCellRenderer = (props: { rowIndex: number }) => (
  <PriorityCell rowIndex={props.rowIndex} />
)

export const TrackerCellRenderer = (props: { rowIndex: number }) => (
  <TrackerCell rowIndex={props.rowIndex} />
)

export const CategoryCellRenderer = (props: { rowIndex: number }) => (
  <CategoryCell rowIndex={props.rowIndex} />
)

export const TagsCellRenderer = (props: { rowIndex: number }) => (
  <TagsCell rowIndex={props.rowIndex} />
)

export const AddedOnCellRenderer = (props: { rowIndex: number }) => (
  <AddedOnCell rowIndex={props.rowIndex} />
)

export const CompletionCellRenderer = (props: { rowIndex: number }) => (
  <CompletionCell rowIndex={props.rowIndex} />
)

export const LastActivityCellRenderer = (props: { rowIndex: number }) => (
  <LastActivityCell rowIndex={props.rowIndex} />
)

export const SavePathCellRenderer = (props: { rowIndex: number }) => (
  <SavePathCell rowIndex={props.rowIndex} />
)

export const DownloadedCellRenderer = (props: { rowIndex: number }) => (
  <DownloadedCell rowIndex={props.rowIndex} />
)

export const UploadedCellRenderer = (props: { rowIndex: number }) => (
  <UploadedCell rowIndex={props.rowIndex} />
)

export const SeedsCellRenderer = (props: { rowIndex: number }) => (
  <SeedsCell rowIndex={props.rowIndex} />
)

export const PeersCellRenderer = (props: { rowIndex: number }) => (
  <PeersCell rowIndex={props.rowIndex} />
)

export const RemainingCellRenderer = (props: { rowIndex: number }) => (
  <RemainingCell rowIndex={props.rowIndex} />
)

export const TimeActiveCellRenderer = (props: { rowIndex: number }) => (
  <TimeActiveCell rowIndex={props.rowIndex} />
)

export const SeedingTimeCellRenderer = (props: { rowIndex: number }) => (
  <SeedingTimeCell rowIndex={props.rowIndex} />
)
