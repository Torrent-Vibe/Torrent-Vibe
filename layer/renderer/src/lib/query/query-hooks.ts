/* eslint-disable react-hooks/rules-of-hooks */
import type { AddTorrentOptions, Preferences } from '@innei/qbittorrent-browser'
import type { UseMutationResult } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'

import { QBittorrentClient } from '~/shared/api/qbittorrent-client'

import { QueryKeys } from './query-keys'
import { qbQueryManager } from './query-manager-instance'
import { useAuthQuery } from './use-auth-query'

/**
 * Enhanced query hooks with automatic cache management
 */
export const useQBQuery = {
  categories: () =>
    useAuthQuery({
      queryKey: QueryKeys.categories.all(),
      queryFn: async () => {
        const data = await QBittorrentClient.shared.requestCategories()
        return data
      },
      refetchInterval: 30000,
      staleTime: 20000,
    }),

  categoriesWithCounts: () =>
    useAuthQuery({
      queryKey: QueryKeys.categories.withCounts(),
      queryFn: async () => {
        const data = await QBittorrentClient.shared.requestCategories()
        return data
      },
      refetchInterval: 30000,
      staleTime: 20000,
    }),

  tags: () =>
    useAuthQuery({
      queryKey: QueryKeys.tags.all(),
      queryFn: async () => {
        const data = await QBittorrentClient.shared.requestTags()
        return data
      },
      refetchInterval: 30000,
      staleTime: 20000,
    }),

  tagsWithCounts: () =>
    useAuthQuery({
      queryKey: QueryKeys.tags.withCounts(),
      queryFn: async () => {
        const data = await QBittorrentClient.shared.requestTags()
        return data
      },
      refetchInterval: 30000,
      staleTime: 20000,
    }),

  torrents: (filter?: string) =>
    useAuthQuery({
      queryKey: QueryKeys.torrents.list(filter),
      queryFn: async () => {
        const data = await QBittorrentClient.shared.listTorrents()
        return data
      },
      refetchInterval: 3000,
      staleTime: 2000,
    }),

  torrentFiles: (hash: string | null) =>
    useAuthQuery({
      queryKey: QueryKeys.torrentDetails.files(hash!),
      queryFn: () => QBittorrentClient.shared.requestTorrentFiles(hash!),
      enabled: !!hash,
      refetchInterval: 3000,
      staleTime: 2000,
    }),

  torrentPeers: (hash: string | null, rid?: number) =>
    useAuthQuery({
      queryKey: QueryKeys.torrentDetails.peers(hash!, rid),
      queryFn: () => QBittorrentClient.shared.requestTorrentPeers(hash!, rid),
      enabled: !!hash,
      refetchInterval: 3000,
      staleTime: 2000,
    }),

  torrentTrackers: (hash: string | null) =>
    useAuthQuery({
      queryKey: QueryKeys.torrentDetails.trackers(hash!),
      queryFn: () => QBittorrentClient.shared.requestTorrentTrackers(hash!),
      enabled: !!hash,
      refetchInterval: 6000, // Trackers update less frequently
      staleTime: 5000,
    }),

  torrentProperties: (hash: string | null) =>
    useAuthQuery({
      queryKey: QueryKeys.torrentDetails.properties(hash!),
      queryFn: () => QBittorrentClient.shared.requestTorrentProperties(hash!),
      enabled: !!hash,
      refetchInterval: 3000,
      staleTime: 2000,
    }),

  torrentPieceStates: (hash: string | null) =>
    useAuthQuery({
      queryKey: QueryKeys.torrentDetails.pieceStates(hash!),
      queryFn: () => QBittorrentClient.shared.requestTorrentPieceStates(hash!),
      enabled: !!hash,
      refetchInterval: 3000,
      staleTime: 2000,
    }),

  qbittorrentPreferences: () =>
    useAuthQuery({
      queryKey: QueryKeys.qbittorrent.preferences(),
      queryFn: () => QBittorrentClient.shared.getPreferences(),
      refetchInterval: false, // Only manual refresh
      staleTime: 60000, // 1 minute
    }),
}

/**
 * Direct object-based mutation hooks with full type safety and IDE support
 * Each mutation is directly accessible without proxy indirection
 * Usage: useQBMutation.categories.create() or useQBMutation.torrents.setCategory()
 */
export const useQBMutation = {
  categories: {
    create: (): UseMutationResult<
      void,
      Error,
      { name: string; savePath: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { name: string; savePath: string }) => {
          await QBittorrentClient.shared.createCategory(
            params.name,
            params.savePath,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onCategoryChange()
        },
        onError: (error) => {
          console.error('Category creation failed:', error)
        },
      })
    },

    delete: (): UseMutationResult<void, Error, string, unknown> => {
      return useMutation({
        mutationFn: async (name: string) => {
          await QBittorrentClient.shared.removeCategory(name)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onCategoryChange()
        },
        onError: (error) => {
          console.error('Category deletion failed:', error)
        },
      })
    },

    edit: (): UseMutationResult<
      void,
      Error,
      { name: string; savePath: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { name: string; savePath: string }) => {
          await QBittorrentClient.shared.editCategory(
            params.name,
            params.savePath,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onCategoryChange()
        },
        onError: (error) => {
          console.error('Category edit failed:', error)
        },
      })
    },
  },

  tags: {
    create: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (tags: string[]) => {
          await QBittorrentClient.shared.createTags(tags.join(','))
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTagChange()
        },
        onError: (error) => {
          console.error('Tag creation failed:', error)
        },
      })
    },

    delete: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (tags: string[]) => {
          await QBittorrentClient.shared.deleteTags(tags.join(','))
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTagChange()
        },
        onError: (error) => {
          console.error('Tag deletion failed:', error)
        },
      })
    },
  },

  torrents: {
    add: (): UseMutationResult<
      void,
      Error,
      { torrent: string | Uint8Array; options?: Partial<AddTorrentOptions> },
      unknown
    > => {
      return useMutation({
        mutationFn: async ({ torrent, options }) => {
          await QBittorrentClient.shared.addTorrent(torrent, options)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentAdded()
        },
        onError: (error) => {
          console.error('Torrent addition failed:', error)
        },
      })
    },

    delete: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; deleteFiles?: boolean },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: {
          hashes: string[]
          deleteFiles?: boolean
        }) => {
          await QBittorrentClient.shared.removeTorrent(
            params.hashes,
            params.deleteFiles,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent deletion failed:', error)
        },
      })
    },

    pause: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.pauseTorrent(hashes)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent pause failed:', error)
        },
      })
    },

    resume: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.resumeTorrent(hashes)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent resume failed:', error)
        },
      })
    },

    forceStart: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.requestSetForceStart(hashes, true)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent force start failed:', error)
        },
      })
    },

    setCategory: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; category: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; category: string }) => {
          await QBittorrentClient.shared.setTorrentCategory(
            params.hashes,
            params.category,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentCategoryAssignment()
        },
        onError: (error) => {
          console.error('Torrent category assignment failed:', error)
        },
      })
    },

    addTags: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; tags: string[] },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; tags: string[] }) => {
          await QBittorrentClient.shared.addTorrentTags(
            params.hashes,
            params.tags.join(','),
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentTagAssignment()
        },
        onError: (error) => {
          console.error('Torrent tag addition failed:', error)
        },
      })
    },

    removeTags: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; tags: string[] },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; tags: string[] }) => {
          await QBittorrentClient.shared.removeTorrentTags(
            params.hashes,
            params.tags.join(','),
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentTagAssignment()
        },
        onError: (error) => {
          console.error('Torrent tag removal failed:', error)
        },
      })
    },

    setLocation: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; location: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; location: string }) => {
          await QBittorrentClient.shared.setTorrentLocation(
            params.hashes,
            params.location,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent location change failed:', error)
        },
      })
    },

    rename: (): UseMutationResult<
      void,
      Error,
      { hash: string; name: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hash: string; name: string }) => {
          await QBittorrentClient.shared.setTorrentName(
            params.hash,
            params.name,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent rename failed:', error)
        },
      })
    },

    setPriority: (): UseMutationResult<
      void,
      Error,
      {
        hashes: string[]
        priority: 'increase' | 'decrease' | 'top' | 'bottom'
      },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: {
          hashes: string[]
          priority: 'increase' | 'decrease' | 'top' | 'bottom'
        }) => {
          // Map priority actions to appropriate methods
          switch (params.priority) {
            case 'increase': {
              await QBittorrentClient.shared.queueUp(params.hashes)
              break
            }
            case 'decrease': {
              await QBittorrentClient.shared.queueDown(params.hashes)
              break
            }
            case 'top': {
              await QBittorrentClient.shared.topPriority(params.hashes)
              break
            }
            case 'bottom': {
              await QBittorrentClient.shared.bottomPriority(params.hashes)
              break
            }
          }
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent priority change failed:', error)
        },
      })
    },

    toggleSequentialDownload: (): UseMutationResult<
      void,
      Error,
      string[],
      unknown
    > => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.requestToggleSequentialDownload(hashes)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Sequential download toggle failed:', error)
        },
      })
    },

    toggleFirstLastPiecePrio: (): UseMutationResult<
      void,
      Error,
      string[],
      unknown
    > => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.requestToggleFirstLastPiecePriority(
            hashes,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('First/last piece priority toggle failed:', error)
        },
      })
    },

    setAutoManagement: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; enable: boolean },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; enable: boolean }) => {
          await QBittorrentClient.shared.requestSetAutoManagement(
            params.hashes,
            params.enable,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Auto management setting failed:', error)
        },
      })
    },

    setSuperSeeding: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; enable: boolean },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; enable: boolean }) => {
          await QBittorrentClient.shared.requestSetSuperSeeding(
            params.hashes,
            params.enable,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Super seeding setting failed:', error)
        },
      })
    },

    setForceStart: (): UseMutationResult<
      void,
      Error,
      { hashes: string[]; enable: boolean },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hashes: string[]; enable: boolean }) => {
          await QBittorrentClient.shared.requestSetForceStart(
            params.hashes,
            params.enable,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Force start setting failed:', error)
        },
      })
    },

    recheck: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.requestRecheckTorrents(hashes)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent recheck failed:', error)
        },
      })
    },

    reannounce: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (hashes: string[]) => {
          await QBittorrentClient.shared.requestReannounceTorrents(hashes)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Torrent reannounce failed:', error)
        },
      })
    },

    setFilePriority: (): UseMutationResult<
      void,
      Error,
      { hash: string; fileIds: number[] | string; priority: 0 | 1 | 6 | 7 },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: {
          hash: string
          fileIds: number[] | string
          priority: 0 | 1 | 6 | 7
        }) => {
          await QBittorrentClient.shared.requestSetFilePriority(
            params.hash,
            params.fileIds,
            params.priority,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('File priority setting failed:', error)
        },
      })
    },

    addTrackers: (): UseMutationResult<
      void,
      Error,
      { hash: string; urls: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hash: string; urls: string }) => {
          await QBittorrentClient.shared.requestAddTrackers(
            params.hash,
            params.urls,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Add trackers failed:', error)
        },
      })
    },

    editTrackers: (): UseMutationResult<
      void,
      Error,
      { hash: string; origUrl: string; newUrl: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: {
          hash: string
          origUrl: string
          newUrl: string
        }) => {
          await QBittorrentClient.shared.requestEditTrackers(
            params.hash,
            params.origUrl,
            params.newUrl,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Edit trackers failed:', error)
        },
      })
    },

    removeTrackers: (): UseMutationResult<
      void,
      Error,
      { hash: string; urls: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: { hash: string; urls: string }) => {
          await QBittorrentClient.shared.requestRemoveTrackers(
            params.hash,
            params.urls,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Remove trackers failed:', error)
        },
      })
    },

    renameFile: (): UseMutationResult<
      void,
      Error,
      { hash: string; oldPath: string; newPath: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: {
          hash: string
          oldPath: string
          newPath: string
        }) => {
          await QBittorrentClient.shared.requestRenameFile(
            params.hash,
            params.oldPath,
            params.newPath,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('File rename failed:', error)
        },
      })
    },

    renameFolder: (): UseMutationResult<
      void,
      Error,
      { hash: string; oldPath: string; newPath: string },
      unknown
    > => {
      return useMutation({
        mutationFn: async (params: {
          hash: string
          oldPath: string
          newPath: string
        }) => {
          await QBittorrentClient.shared.requestRenameFolder(
            params.hash,
            params.oldPath,
            params.newPath,
          )
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Folder rename failed:', error)
        },
      })
    },
  },

  qbittorrent: {
    setPreferences: (): UseMutationResult<
      void,
      Error,
      Partial<Preferences>,
      unknown
    > => {
      return useMutation({
        mutationFn: async (preferences: Partial<Preferences>) => {
          await QBittorrentClient.shared.setPreferences(preferences)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onPreferencesChange()
        },
        onError: (error) => {
          console.error('Preferences update failed:', error)
        },
      })
    },

    setDownloadLimit: (): UseMutationResult<void, Error, number, unknown> => {
      return useMutation({
        mutationFn: async (limit: number) => {
          // Global download limit needs to be implemented via preferences
          await QBittorrentClient.shared.setPreferences({ dl_limit: limit })
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onPreferencesChange()
        },
        onError: (error) => {
          console.error('Download limit setting failed:', error)
        },
      })
    },

    setUploadLimit: (): UseMutationResult<void, Error, number, unknown> => {
      return useMutation({
        mutationFn: async (limit: number) => {
          await QBittorrentClient.shared.setPreferences({ up_limit: limit })
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onPreferencesChange()
        },
        onError: (error) => {
          console.error('Upload limit setting failed:', error)
        },
      })
    },

    banPeers: (): UseMutationResult<void, Error, string[], unknown> => {
      return useMutation({
        mutationFn: async (peers: string[]) => {
          await QBittorrentClient.shared.requestBanPeers(peers)
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onTorrentStateChange()
        },
        onError: (error) => {
          console.error('Peer banning failed:', error)
        },
      })
    },

    toggleAlternativeSpeedLimits: (): UseMutationResult<
      void,
      Error,
      void,
      unknown
    > => {
      return useMutation({
        mutationFn: async () => {
          await QBittorrentClient.shared.requestToggleAlternativeSpeedLimits()
        },
        onSuccess: async () => {
          await qbQueryManager.scenarios.onPreferencesChange()
        },
        onError: (error) => {
          console.error('Toggle alternative speed limits failed:', error)
        },
      })
    },
  },
} as const

/**
 * Type utility to extract mutation parameter types from useQBMutation hooks
 *
 * Usage examples:
 * - MutationParams<'categories', 'create'> → { name: string; savePath: string }
 * - MutationParams<'tags', 'create'> → string[]
 * - MutationParams<'torrents', 'setCategory'> → { hashes: string[]; category: string }
 */
export type MutationParams<
  TGroup extends keyof typeof useQBMutation,
  TAction extends keyof (typeof useQBMutation)[TGroup],
> = (typeof useQBMutation)[TGroup][TAction] extends () => UseMutationResult<
  any,
  any,
  infer P,
  any
>
  ? P
  : never

/**
 * Helper type to get all available mutation groups
 */
export type MutationGroups = keyof typeof useQBMutation

/**
 * Helper type to get all available actions for a specific group
 */
export type MutationActions<TGroup extends MutationGroups> =
  keyof (typeof useQBMutation)[TGroup]

/**
 * Convenience type aliases for commonly used mutation parameters
 */
export type QBMutationParams = {
  CategoriesCreate: MutationParams<'categories', 'create'>
  CategoriesDelete: MutationParams<'categories', 'delete'>
  CategoriesEdit: MutationParams<'categories', 'edit'>

  TagsCreate: MutationParams<'tags', 'create'>
  TagsDelete: MutationParams<'tags', 'delete'>

  TorrentsAdd: MutationParams<'torrents', 'add'>
  TorrentsDelete: MutationParams<'torrents', 'delete'>
  TorrentsPause: MutationParams<'torrents', 'pause'>
  TorrentsResume: MutationParams<'torrents', 'resume'>
  TorrentsForceStart: MutationParams<'torrents', 'forceStart'>
  TorrentsSetCategory: MutationParams<'torrents', 'setCategory'>
  TorrentsAddTags: MutationParams<'torrents', 'addTags'>
  TorrentsRemoveTags: MutationParams<'torrents', 'removeTags'>
  TorrentsSetLocation: MutationParams<'torrents', 'setLocation'>
  TorrentsRename: MutationParams<'torrents', 'rename'>
  TorrentsSetPriority: MutationParams<'torrents', 'setPriority'>
  TorrentsToggleSequentialDownload: MutationParams<
    'torrents',
    'toggleSequentialDownload'
  >
  TorrentsToggleFirstLastPiecePrio: MutationParams<
    'torrents',
    'toggleFirstLastPiecePrio'
  >
  TorrentsSetAutoManagement: MutationParams<'torrents', 'setAutoManagement'>
  TorrentsSetSuperSeeding: MutationParams<'torrents', 'setSuperSeeding'>
  TorrentsSetForceStart: MutationParams<'torrents', 'setForceStart'>
  TorrentsRecheck: MutationParams<'torrents', 'recheck'>
  TorrentsReannounce: MutationParams<'torrents', 'reannounce'>
  TorrentsSetFilePriority: MutationParams<'torrents', 'setFilePriority'>
  TorrentsAddTrackers: MutationParams<'torrents', 'addTrackers'>
  TorrentsEditTrackers: MutationParams<'torrents', 'editTrackers'>
  TorrentsRemoveTrackers: MutationParams<'torrents', 'removeTrackers'>
  TorrentsRenameFile: MutationParams<'torrents', 'renameFile'>
  TorrentsRenameFolder: MutationParams<'torrents', 'renameFolder'>

  QBittorrentSetPreferences: MutationParams<'qbittorrent', 'setPreferences'>
  QBittorrentSetDownloadLimit: MutationParams<'qbittorrent', 'setDownloadLimit'>
  QBittorrentSetUploadLimit: MutationParams<'qbittorrent', 'setUploadLimit'>
  QBittorrentBanPeers: MutationParams<'qbittorrent', 'banPeers'>
  QBittorrentToggleAlternativeSpeedLimits: MutationParams<
    'qbittorrent',
    'toggleAlternativeSpeedLimits'
  >
}
