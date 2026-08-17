import type { Preferences } from '@innei/qbittorrent-browser'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useQBittorrentPrefsManager } from '~/atoms/settings/qbittorrent-prefs'
import { Button } from '~/components/ui/button'
import { getI18n } from '~/i18n'

import {
  PrefsTabLayout,
  SettingField,
  SettingInputField,
  SettingSectionCard,
  SettingSelectField,
  SettingSwitchField,
  SettingTextareaField,
} from './components'

export const WebUITab = () => {
  const {
    prefs,
    update,
    isLoading: loadingPrefs,
    error,
  } = useQBittorrentPrefsManager()

  const handlePrefsChange = useCallback(
    (updates: Partial<Preferences>) => {
      update(updates)
    },
    [update],
  )

  // Show error toast if query fails
  if (error) {
    toast.error(getI18n().t('messages.webuiLoadFailed'))
  }

  return (
    <PrefsTabLayout
      saveErrorI18nKey="messages.webuiSaveFailed"
      saveSuccessI18nKey="messages.webuiSaved"
    >
      {loadingPrefs && (
        <div className="text-xs text-text-tertiary flex items-center gap-2">
          <i className="i-mingcute-loading-3-line animate-spin" />
          Loading preferences...
        </div>
      )}

      {/* Web User Interface Section */}
      <SettingSectionCard title="Web User Interface (Remote Control)">
        <div className="grid grid-cols-2 gap-4">
          <SettingInputField
            id="web_ui_address"
            label="IP Address"
            placeholder="*"
            value={prefs.web_ui_address || '*'}
            onChange={(v) => handlePrefsChange({ web_ui_address: v })}
          />
          <SettingInputField
            id="web_ui_port"
            label="Port"
            placeholder="18888"
            type="number"
            value={String(prefs.web_ui_port || 18888)}
            onChange={(v) =>
              handlePrefsChange({ web_ui_port: Number.parseInt(v) || 18888 })
            }
          />
        </div>
        <SettingSwitchField
          checked={prefs.web_ui_upnp || false}
          id="web_ui_upnp"
          label="Use UPnP / NAT-PMP port forwarding from my router"
          onCheckedChange={(checked) =>
            handlePrefsChange({ web_ui_upnp: !!checked })
          }
        />

        <SettingSectionCard title="HTTPS">
          <SettingSwitchField
            label="Use HTTPS instead of HTTP"
            checked={
              window.location.protocol === 'https:' || prefs.use_https || false
            }
            onCheckedChange={(enabled) =>
              handlePrefsChange({ use_https: !!enabled })
            }
          />
          <SettingInputField
            label="Certificate path"
            placeholder="/path/to/cert.pem"
            value={prefs.web_ui_https_cert_path || ''}
            onChange={(v) => handlePrefsChange({ web_ui_https_cert_path: v })}
          />
          <SettingInputField
            label="Key path"
            placeholder="/path/to/key.pem"
            value={prefs.web_ui_https_key_path || ''}
            onChange={(v) => handlePrefsChange({ web_ui_https_key_path: v })}
          />
        </SettingSectionCard>
      </SettingSectionCard>

      {/* Authentication Section */}
      <SettingSectionCard title="Authentication">
        <div className="grid grid-cols-2 gap-4">
          <SettingInputField
            id="web_ui_username"
            label="Username"
            placeholder="admin"
            value={prefs.web_ui_username || 'admin'}
            onChange={(v) => handlePrefsChange({ web_ui_username: v })}
          />
          <SettingInputField
            id="web_ui_password"
            label="Password"
            placeholder="Modify current password"
            type="password"
            value={prefs.web_ui_password || ''}
            onChange={(v) => handlePrefsChange({ web_ui_password: v })}
          />
        </div>

        <SettingSwitchField
          checked={prefs.bypass_local_auth || false}
          id="bypass_local_auth"
          label="Bypass authentication for clients on localhost"
          onCheckedChange={(checked) =>
            handlePrefsChange({ bypass_local_auth: !!checked })
          }
        />

        <SettingSectionCard
          enabled={prefs.bypass_auth_subnet_whitelist_enabled || false}
          switchLabel="Bypass authentication for clients in whitelisted IP subnets"
          title="Subnet Whitelist"
          onToggleEnabled={(enabled) =>
            handlePrefsChange({
              bypass_auth_subnet_whitelist_enabled: !!enabled,
            })
          }
        >
          <SettingTextareaField
            id="bypass_auth_subnet_whitelist"
            label="Whitelisted IP subnets"
            placeholder="10.0.0.0/24"
            rows={3}
            value={prefs.bypass_auth_subnet_whitelist || '10.0.0.0/24'}
            onChange={(v) =>
              handlePrefsChange({ bypass_auth_subnet_whitelist: v })
            }
          />
        </SettingSectionCard>

        <div className="grid grid-cols-2 gap-4">
          <SettingInputField
            label="Ban client after consecutive failures"
            type="number"
            value={String(prefs.web_ui_max_auth_fail_count || 5)}
            onChange={(v) =>
              handlePrefsChange({
                web_ui_max_auth_fail_count: Number.parseInt(v) || 5,
              })
            }
          />
          <SettingField label={<span>Ban duration</span>}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                className="h-8 w-full sm:w-20 rounded border border-border bg-background px-2 text-xs"
                type="number"
                value={prefs.web_ui_ban_duration || 3600}
                onChange={(e) =>
                  handlePrefsChange({
                    web_ui_ban_duration:
                      Number.parseInt(e.target.value) || 3600,
                  })
                }
              />
              <span className="text-xs text-text-tertiary">seconds</span>
            </div>
          </SettingField>
        </div>

        <SettingField label={<span>Session timeout</span>}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              className="h-8 w-full sm:w-20 rounded border border-border bg-background px-2 text-xs"
              type="number"
              value={prefs.web_ui_session_timeout || 3600}
              onChange={(e) =>
                handlePrefsChange({
                  web_ui_session_timeout:
                    Number.parseInt(e.target.value) || 3600,
                })
              }
            />
            <span className="text-xs text-text-tertiary">seconds</span>
          </div>
        </SettingField>
      </SettingSectionCard>

      {/* Security Section */}
      <SettingSectionCard title="Security">
        <SettingSwitchField
          checked={prefs.web_ui_clickjacking_protection_enabled !== false}
          id="web_ui_clickjacking_protection_enabled"
          label="Enable clickjacking protection"
          onCheckedChange={(checked) =>
            handlePrefsChange({
              web_ui_clickjacking_protection_enabled: !!checked,
            })
          }
        />
        <SettingSwitchField
          checked={prefs.web_ui_csrf_protection_enabled !== false}
          id="web_ui_csrf_protection_enabled"
          label="Enable Cross-Site Request Forgery (CSRF) protection"
          onCheckedChange={(checked) =>
            handlePrefsChange({ web_ui_csrf_protection_enabled: !!checked })
          }
        />
        <SettingSwitchField
          checked={prefs.web_ui_secure_cookie_enabled || false}
          id="web_ui_secure_cookie_enabled"
          label="Enable cookie Secure flag (requires HTTPS)"
          onCheckedChange={(checked) =>
            handlePrefsChange({ web_ui_secure_cookie_enabled: !!checked })
          }
        />

        <SettingSectionCard
          title="Host header validation"
          onToggleEnabled={(enabled) =>
            handlePrefsChange({
              web_ui_host_header_validation_enabled: !!enabled,
            })
          }
        >
          <SettingSwitchField
            checked={!!prefs.web_ui_host_header_validation_enabled}
            label="Enable Host header validation"
            onCheckedChange={(enabled) =>
              handlePrefsChange({
                web_ui_host_header_validation_enabled: !!enabled,
              })
            }
          />
          <SettingTextareaField
            disabled={!prefs.web_ui_host_header_validation_enabled}
            label="Server domains"
            placeholder="*"
            rows={3}
            value={prefs.web_ui_domain_list || '*'}
            onChange={(v) => handlePrefsChange({ web_ui_domain_list: v })}
          />
        </SettingSectionCard>
      </SettingSectionCard>

      {/* Custom HTTP headers Section */}
      <SettingSectionCard title="Custom HTTP headers">
        <SettingSwitchField
          checked={prefs.web_ui_use_custom_http_headers_enabled || false}
          label="Add custom HTTP headers"
          onCheckedChange={(enabled) =>
            handlePrefsChange({
              web_ui_use_custom_http_headers_enabled: !!enabled,
            })
          }
        />
        <SettingTextareaField
          disabled={!prefs.web_ui_use_custom_http_headers_enabled}
          label="Headers"
          placeholder="Access-Control-Allow-Origin: *"
          rows={4}
          value={
            prefs.web_ui_custom_http_headers || 'Access-Control-Allow-Origin: *'
          }
          onChange={(v) => handlePrefsChange({ web_ui_custom_http_headers: v })}
        />
      </SettingSectionCard>

      {/* Alternative Web UI Section */}
      <SettingSectionCard title="Alternative Web UI">
        <SettingSwitchField
          checked={prefs.alternative_webui_enabled || false}
          label="Use alternative Web UI"
          onCheckedChange={(enabled) =>
            handlePrefsChange({ alternative_webui_enabled: !!enabled })
          }
        />
        <SettingInputField
          disabled={!prefs.alternative_webui_enabled}
          label="Files location"
          placeholder="Path to alternative Web UI files"
          value={prefs.alternative_webui_path || ''}
          onChange={(v) => handlePrefsChange({ alternative_webui_path: v })}
        />
      </SettingSectionCard>

      {/* Update my dynamic domain name Section */}
      <SettingSectionCard title="Dynamic DNS">
        <SettingSwitchField
          checked={prefs.dyndns_enabled || false}
          label="Update my dynamic domain name"
          onCheckedChange={(enabled) =>
            handlePrefsChange({ dyndns_enabled: !!enabled })
          }
        />
        <SettingSelectField
          label="Service"
          options={[
            { value: '0', label: 'DynDNS' },
            { value: '1', label: 'No-IP' },
          ]}
          value={String(
            typeof prefs.dyndns_service === 'number' ? prefs.dyndns_service : 0,
          )}
          onValueChange={(v) =>
            handlePrefsChange({ dyndns_service: Number(v) })
          }
        />
        <SettingField label="Action">
          <Button size="sm" variant="secondary">
            Register
          </Button>
        </SettingField>
      </SettingSectionCard>
    </PrefsTabLayout>
  )
}
