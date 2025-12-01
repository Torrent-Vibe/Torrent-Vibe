const discountLabelMap: Record<string, I18nKeysForSettings> = {
  FREE: 'discover.filters.mteam.discount.free',
  PERCENT_50: 'discover.filters.mteam.discount.percent50',
  PERCENT_30: 'discover.filters.mteam.discount.percent30',
  _2X: 'discover.filters.mteam.discount.double',
  _2X_FREE: 'discover.filters.mteam.discount.doubleFree',
  _2X_PERCENT_50: 'discover.filters.mteam.discount.doubleHalf',
}

export const formatDiscountLabel = (
  discount: string | null | undefined,
  t: (key: string, options?: any) => string,
) => {
  if (!discount) return '—'
  const key = discountLabelMap[discount]
  return key ? t(key) : discount.replaceAll('_', ' ')
}
