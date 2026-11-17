export type GalleryPhoto = {
  id: number
  url: string
  pathname: string
  caption: string
  is_hero: boolean
  sort_order: number
  created_at: string
}

export const MAX_HERO_PHOTOS = 4
