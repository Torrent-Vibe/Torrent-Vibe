import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearHelperBinding,
  getHelperBinding,
  setHelperBinding,
  useHelperBindingsStore,
} from './bindings'

describe('helper bindings store', () => {
  beforeEach(() => {
    useHelperBindingsStore.setState({ bindings: {} })
    localStorage.clear()
  })

  it('clones the map so pairing subscribers see unbind and rebind', () => {
    const seen: number[] = []
    const unsubscribe = useHelperBindingsStore.subscribe(
      state => state.bindings,
      () => {
        seen.push(
          Object.keys(useHelperBindingsStore.getState().bindings).length,
        )
      },
    )

    const empty = useHelperBindingsStore.getState().bindings
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'tok' })
    const paired = useHelperBindingsStore.getState().bindings
    expect(paired).not.toBe(empty)
    expect(paired['srv-a']?.token).toBe('tok')

    clearHelperBinding('srv-a')
    const unbound = useHelperBindingsStore.getState().bindings
    expect(unbound).not.toBe(paired)
    expect(unbound['srv-a']).toBeUndefined()
    expect(seen).toEqual([1, 0])
    unsubscribe()
  })

  it('rejects pairing a helper URL already owned by another server', () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'a' })
    expect(() =>
      setHelperBinding('srv-b', { url: 'http://nas:17890/', token: 'b' })).toThrow('helperUrlInUse')
    expect(getHelperBinding('srv-b')).toBeNull()
  })

  it('allows rebind of the same server id', () => {
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'a' })
    setHelperBinding('srv-a', { url: 'http://nas:17890', token: 'a2' })
    expect(getHelperBinding('srv-a')?.token).toBe('a2')
  })
})
