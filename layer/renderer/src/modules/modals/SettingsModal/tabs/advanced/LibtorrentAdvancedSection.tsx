import type { Preferences } from '@innei/qbittorrent-browser'

import { Input } from '~/components/ui/input'

import {
  SettingField,
  SettingInputField,
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
} from '../components'

interface LibtorrentAdvancedSectionProps {
  onPrefsChange: (updates: Partial<Preferences>) => void
  prefs: Partial<Preferences>
}

export const LibtorrentAdvancedSection = ({
  prefs,
  onPrefsChange,
}: LibtorrentAdvancedSectionProps) => {
  return (
    <SettingSectionCard title="libtorrent">
      <SettingInputField
        label="Async I/O threads"
        type="number"
        value={String(prefs.async_io_threads ?? 10)}
        onChange={(v) =>
          onPrefsChange({ async_io_threads: Number.parseInt(v) || 10 })
        }
      />
      <SettingInputField
        label="File pool size"
        type="number"
        value={String(prefs.file_pool_size ?? 100)}
        onChange={(v) =>
          onPrefsChange({ file_pool_size: Number.parseInt(v) || 100 })
        }
      />
      <SettingField label="Disk cache (requires libtorrent < 2.0)">
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            id="disk-cache"
            type="number"
            value={prefs.disk_cache ?? -1}
            onChange={(e) =>
              onPrefsChange({
                disk_cache: Number.parseInt(e.target.value) || -1,
              })
            }
          />
          <span className="text-sm text-text-tertiary">MiB</span>
        </div>
      </SettingField>
      <SettingField label="Disk cache expiry interval (requires libtorrent < 2.0)">
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            id="disk-cache-ttl"
            type="number"
            value={prefs.disk_cache_ttl ?? 60}
            onChange={(e) =>
              onPrefsChange({
                disk_cache_ttl: Number.parseInt(e.target.value) || 60,
              })
            }
          />
          <span className="text-sm text-text-tertiary">s</span>
        </div>
      </SettingField>
      <SettingSelectField
        label="Upload choking algorithm"
        value={String(prefs.upload_choking_algorithm ?? 0)}
        options={[
          { value: '0', label: 'Round-robin' },
          { value: '1', label: 'Fastest upload' },
          { value: '2', label: 'Anti-leech' },
        ]}
        onValueChange={(value) =>
          onPrefsChange({ upload_choking_algorithm: Number.parseInt(value) })
        }
      />
      <SettingSelectField
        label="Upload slots behavior"
        value={String(prefs.upload_slots_behavior ?? 0)}
        options={[
          { value: '0', label: 'Fixed slots' },
          { value: '1', label: 'Upload rate based' },
        ]}
        onValueChange={(value) =>
          onPrefsChange({ upload_slots_behavior: Number.parseInt(value) })
        }
      />
      <SettingSwitchField
        checked={prefs.enable_os_cache ?? false}
        id="enable-os-cache"
        label="Enable OS cache"
        onCheckedChange={(checked) =>
          onPrefsChange({ enable_os_cache: Boolean(checked) })
        }
      />
      <SettingSwitchField
        checked={prefs.enable_coalesce_read_write ?? false}
        id="enable-coalesce-read-write"
        label="Coalesce reads & writes (requires libtorrent < 2.0)"
        onCheckedChange={(checked) =>
          onPrefsChange({ enable_coalesce_read_write: Boolean(checked) })
        }
      />
      <SettingSwitchField
        checked={prefs.enable_piece_extent_affinity ?? false}
        id="enable-piece-extent-affinity"
        label="Use piece extent affinity"
        onCheckedChange={(checked) =>
          onPrefsChange({ enable_piece_extent_affinity: Boolean(checked) })
        }
      />
      <SettingSwitchField
        checked={prefs.enable_upload_suggestions ?? false}
        id="enable-upload-suggestions"
        label="Send upload piece suggestions"
        onCheckedChange={(checked) =>
          onPrefsChange({ enable_upload_suggestions: Boolean(checked) })
        }
      />
      <SettingField label="Send buffer watermark">
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            id="send-buffer-watermark"
            type="number"
            value={prefs.send_buffer_watermark ?? 500}
            onChange={(e) =>
              onPrefsChange({
                send_buffer_watermark: Number.parseInt(e.target.value) || 500,
              })
            }
          />
          <span className="text-sm text-text-tertiary">KiB</span>
        </div>
      </SettingField>
      <SettingField label="Send buffer low watermark">
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            id="send-buffer-low-watermark"
            type="number"
            value={prefs.send_buffer_low_watermark ?? 10}
            onChange={(e) =>
              onPrefsChange({
                send_buffer_low_watermark:
                  Number.parseInt(e.target.value) || 10,
              })
            }
          />
          <span className="text-sm text-text-tertiary">KiB</span>
        </div>
      </SettingField>
      <SettingField label="Send buffer watermark factor">
        <div className="flex items-center gap-2">
          <Input
            className="w-24"
            id="send-buffer-watermark-factor"
            type="number"
            value={prefs.send_buffer_watermark_factor ?? 50}
            onChange={(e) =>
              onPrefsChange({
                send_buffer_watermark_factor:
                  Number.parseInt(e.target.value) || 50,
              })
            }
          />
          <span className="text-sm text-text-tertiary">%</span>
        </div>
      </SettingField>
      <SettingInputField
        label="Outgoing port (min) [0: disabled]"
        type="number"
        value={String(prefs.outgoing_ports_min ?? 0)}
        onChange={(v) =>
          onPrefsChange({ outgoing_ports_min: Number.parseInt(v) || 0 })
        }
      />
      <SettingInputField
        label="Outgoing port (max) [0: disabled]"
        type="number"
        value={String(prefs.outgoing_ports_max ?? 0)}
        onChange={(v) =>
          onPrefsChange({ outgoing_ports_max: Number.parseInt(v) || 0 })
        }
      />
      <SettingInputField
        label="Socket backlog size"
        type="number"
        value={String(prefs.socket_backlog_size ?? 30)}
        onChange={(v) =>
          onPrefsChange({ socket_backlog_size: Number.parseInt(v) || 30 })
        }
      />
    </SettingSectionCard>
  )
}
