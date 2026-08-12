import type { Coordinates } from '../lib/eclipse'

export type Place = Coordinates & {
  id: string
  name: string
  description: string
}
