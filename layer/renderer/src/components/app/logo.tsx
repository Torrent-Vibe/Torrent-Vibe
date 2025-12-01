import type { ComponentProps, FC } from 'react'

import LogoRaw from './logo.png?inline'

export const Logo: FC<ComponentProps<'img'>> = (props) => {
  return <img src={LogoRaw} alt="Logo" {...props} />
}
