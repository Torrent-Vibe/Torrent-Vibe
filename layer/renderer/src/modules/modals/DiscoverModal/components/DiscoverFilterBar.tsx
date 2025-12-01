import type { FormEvent } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { DiscoverFilterDefinition } from '~/modules/discover'

import { DiscoverModalActions } from '../actions'
import { useDiscoverModalStore } from '../store'
import { DiscoverSearchInput } from './DiscoverSearchInput'

export const DiscoverFilterBar = () => {
  const { t } = useTranslation('app')
  const { t: tSetting } = useTranslation('setting')
  const actions = DiscoverModalActions.shared
  const { form, search: searchSlice } = actions.slices

  const filters = useDiscoverModalStore((state) => state.filters)
  const filterDefinitions = useDiscoverModalStore(
    (state) => state.filterDefinitions,
  )
  const providerReady = useDiscoverModalStore((state) => state.providerReady)
  const isSearching = useDiscoverModalStore((state) => state.isSearching)

  const disabled = !providerReady
  const compactSelectIds = new Set(['mode', 'discount'])

  const handleFilterChange = (id: string, value: unknown) => {
    form.updateFilters((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const renderFilterField = (definition: DiscoverFilterDefinition) => {
    const value = filters[definition.id]

    switch (definition.type) {
      case 'select': {
        return (
          <div
            key={definition.id}
            className={`flex w-full flex-col gap-1 lg:order-2 lg:flex-1${
              compactSelectIds.has(definition.id)
                ? ' lg:min-w-[12rem] lg:max-w-[14rem]'
                : ' lg:min-w-[16rem]'
            }`}
          >
            <Label
              variant="form"
              className="text-xs font-medium text-text-secondary"
            >
              {tSetting(definition.label)}
            </Label>
            <Select
              value={String(value ?? '')}
              onValueChange={(next) => handleFilterChange(definition.id, next)}
              disabled={disabled}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue
                  placeholder={
                    definition.placeholder
                      ? tSetting(definition.placeholder)
                      : undefined
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {definition.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {tSetting(option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      }
      case 'tags': {
        return (
          <div
            key={definition.id}
            className="flex w-full flex-col gap-1 lg:order-2 lg:min-w-[16rem] lg:flex-1"
          >
            <Label
              variant="form"
              className="text-xs font-medium text-text-secondary"
            >
              {tSetting(definition.label)}
            </Label>
            <Input
              value={Array.isArray(value) ? value.join(', ') : ''}
              placeholder={
                definition.placeholder
                  ? tSetting(definition.placeholder)
                  : undefined
              }
              onChange={(event) => {
                const raw = event.target.value
                const parsed = raw
                  .split(',')
                  .map((token) => token.trim())
                  .filter(Boolean)
                handleFilterChange(definition.id, parsed)
              }}
              disabled={disabled}
            />
          </div>
        )
      }
      default: {
        return null
      }
    }
  }

  const filtersHeadingId = 'discover-modal-filters'

  const triggerSearch = useCallback(() => {
    void searchSlice.performSearch().then((result) => {
      if (result.ok || !result.error) {
        return
      }
      if (result.error === 'providerNotReady') {
        toast.error(t('discover.messages.providerNotReady'))
      } else if (result.error === 'requestFailed') {
        toast.error(t('discover.messages.searchFailed'))
      }
    })
  }, [searchSlice, t])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    triggerSearch()
  }

  const labelledBy = filterDefinitions.length > 0 ? filtersHeadingId : undefined

  return (
    <form onSubmit={handleSubmit} className="px-4" aria-labelledby={labelledBy}>
      <div className="rounded-lg border border-border bg-background-secondary/40 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
          <div className="flex w-full flex-col gap-1.5 lg:order-1 lg:flex-[2]">
            <Label
              variant="form"
              className="text-xs font-medium uppercase tracking-wide text-text-tertiary"
            >
              {t('discover.modal.keywordLabel')}
            </Label>
            <div className="flex gap-1.5">
              <DiscoverSearchInput />
            </div>
          </div>
          {filterDefinitions.map((definition) => renderFilterField(definition))}
          <div className="flex shrink-0 items-center gap-1.5 lg:order-3 lg:self-end">
            <Button size="sm" type="submit" disabled={disabled || isSearching}>
              <i className="i-mingcute-search-2-line mr-2" />
              <span>{t('discover.modal.search')}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => form.resetSearch()}
              disabled={isSearching}
              size="sm"
            >
              {t('discover.modal.reset')}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
