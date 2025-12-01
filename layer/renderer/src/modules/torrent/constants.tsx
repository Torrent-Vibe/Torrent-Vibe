import type { ColumnDef, RowData } from '@tanstack/react-table'
import * as React from 'react'

import type { TorrentInfo } from '~/types/torrent'

import { HeaderCheckboxCell } from './cells/CheckboxCell'
import { HeaderCell } from './cells/HeaderCell'
import { CELL_RENDERERS } from './cells/StaticCellRenderers'

// Extend TableMeta to include our custom properties
declare module '@tanstack/react-table' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface TableMeta<TData extends RowData> {
    sortState?: {
      sortKey?: keyof TorrentInfo
      sortDirection?: 'asc' | 'desc'
    }
    handleSort?: (key: keyof TorrentInfo, direction: 'asc' | 'desc') => void
  }
}

// All available columns that can be displayed
const tableAllColumns: ColumnDef<TorrentInfo>[] = [
  {
    id: 'select',
    header: () => <HeaderCheckboxCell />,
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.select
      return <Renderer rowIndex={row.index} />
    },
    size: 48,
    minSize: 48,
    maxSize: 48,
    enableResizing: false,
    enableHiding: false,
  },
  {
    id: 'name',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.name'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="name"
          align="left"
          cellClassName="px-4"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.name
      return <Renderer rowIndex={row.index} />
    },
    size: 600,
    minSize: 300,
    maxSize: 1200,
    enableResizing: true,
    enableHiding: false,
  },
  {
    id: 'size',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.size'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="size"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.size
      return <Renderer rowIndex={row.index} />
    },
    size: 86,
    minSize: 80,
    maxSize: 150,
    enableResizing: true,
    enableHiding: true,
  },
  {
    id: 'progress',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.progress'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="progress"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.progress
      return <Renderer rowIndex={row.index} />
    },
    size: 120,
    minSize: 100,
    maxSize: 200,
    enableResizing: false,
    enableHiding: true,
  },
  {
    id: 'dlspeed',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.downloadSpeed'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="dlspeed"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.dlspeed
      return <Renderer rowIndex={row.index} />
    },
    size: 100,
    minSize: 80,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  {
    id: 'upspeed',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.uploadSpeed'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="upspeed"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.upspeed
      return <Renderer rowIndex={row.index} />
    },
    size: 100,
    minSize: 80,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  {
    id: 'eta',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.eta'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="eta"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.eta
      return <Renderer rowIndex={row.index} />
    },
    size: 120,
    enableResizing: false,
    enableHiding: true,
  },
  {
    id: 'ratio',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.ratio'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="ratio"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.ratio
      return <Renderer rowIndex={row.index} />
    },
    size: 80,
    minSize: 80,
    maxSize: 80,
    enableResizing: false,
    enableHiding: true,
  },
  {
    id: 'state',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.status'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="state"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.state
      return <Renderer rowIndex={row.index} />
    },
    size: 120,

    enableResizing: false,
    enableHiding: true,
  },
  // Priority column
  {
    id: 'priority',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.priority'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="priority"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.priority
      return <Renderer rowIndex={row.index} />
    },
    size: 80,
    minSize: 80,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  // Tracker column
  {
    id: 'tracker',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.tracker'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="tracker"
          align="left"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.tracker
      return <Renderer rowIndex={row.index} />
    },
    size: 120,
    minSize: 100,
    maxSize: 200,
    enableResizing: true,
    enableHiding: true,
  },
  // Category column
  {
    id: 'category',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.category'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="category"
          align="left"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.category
      return <Renderer rowIndex={row.index} />
    },
    size: 100,
    minSize: 80,
    maxSize: 150,
    enableResizing: true,
    enableHiding: true,
  },
  // Tags column
  {
    id: 'tags',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.tags'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="tags"
          align="left"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.tags
      return <Renderer rowIndex={row.index} />
    },
    size: 120,
    minSize: 100,
    maxSize: 200,
    enableResizing: true,
    enableHiding: true,
  },
  // Seeds column
  {
    id: 'num_seeds',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.seeds'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="num_seeds"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.num_seeds
      return <Renderer rowIndex={row.index} />
    },
    size: 80,
    minSize: 70,
    maxSize: 100,
    enableResizing: true,
    enableHiding: true,
  },
  // Peers column
  {
    id: 'num_leechs',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.peers'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="num_leechs"
          align="center"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.num_leechs
      return <Renderer rowIndex={row.index} />
    },
    size: 80,
    minSize: 70,
    maxSize: 100,
    enableResizing: true,
    enableHiding: true,
  },
  // Downloaded column
  {
    id: 'downloaded',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.downloaded'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="downloaded"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.downloaded
      return <Renderer rowIndex={row.index} />
    },
    size: 90,
    minSize: 70,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  // Uploaded column
  {
    id: 'uploaded',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.uploaded'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="uploaded"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.uploaded
      return <Renderer rowIndex={row.index} />
    },
    size: 90,
    minSize: 70,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  // Remaining column
  {
    id: 'amount_left',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.remaining'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="amount_left"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.amount_left
      return <Renderer rowIndex={row.index} />
    },
    size: 100,
    minSize: 80,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  // Time Active column
  {
    id: 'time_active',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.activeTime'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="time_active"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.time_active
      return <Renderer rowIndex={row.index} />
    },
    size: 90,
    minSize: 70,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  // Seeding Time column
  {
    id: 'seeding_time',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.seedingTime'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="seeding_time"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.seeding_time
      return <Renderer rowIndex={row.index} />
    },
    size: 90,
    minSize: 70,
    maxSize: 120,
    enableResizing: true,
    enableHiding: true,
  },
  // Added On column
  {
    id: 'added_on',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.addedOn'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="added_on"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.added_on
      return <Renderer rowIndex={row.index} />
    },
    size: 170,
    enableResizing: true,
    enableHiding: true,
  },
  // Completion On column
  {
    id: 'completion_on',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.completedOn'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="completion_on"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.completion_on
      return <Renderer rowIndex={row.index} />
    },
    size: 170,

    enableResizing: true,
    enableHiding: true,
  },
  // Last Activity column
  {
    id: 'last_activity',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.lastActivity'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="last_activity"
          align="right"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.last_activity
      return <Renderer rowIndex={row.index} />
    },
    size: 100,
    enableResizing: true,
    enableHiding: true,
  },
  // Save Path column
  {
    id: 'save_path',
    header: ({ table }) => {
      const { sortKey, sortDirection } = table.options.meta?.sortState || {}
      return (
        <HeaderCell
          label={'torrent.columns.savePath'}
          sortable={true}
          onSort={table.options.meta?.handleSort}
          sortKey={sortKey as keyof TorrentInfo}
          sortDirection={sortDirection}
          columnKey="save_path"
          align="left"
        />
      )
    },
    cell: ({ row }) => {
      const Renderer = CELL_RENDERERS.save_path
      return <Renderer rowIndex={row.index} />
    },
    size: 200,
    minSize: 150,
    maxSize: 300,
    enableResizing: true,
    enableHiding: true,
  },
]

// Default columns that are visible by default
export const DEFAULT_VISIBLE_COLUMNS = [
  'name',
  'size',
  'progress',
  'state',
  'dlspeed',
  'upspeed',
  'eta',
  'ratio',
]

// Function to get all columns with translations
export const getAllColumns = () => tableAllColumns

export const BASE_ROW_HEIGHT = 56 // Base height for torrent rows
