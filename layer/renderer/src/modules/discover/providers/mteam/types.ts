export interface MTeamStatus {
  [key: string]: unknown
  discount?: string | null
  discountEndTime?: string | null
  leechers?: number | string
  seeders?: number | string
  snatches?: number | string
  timesCompleted?: number | string
}

export interface Status {
  banned: boolean
  comments: string
  createdDate: string
  discount: string
  discountEndTime: null
  hits: string
  id: string
  lastAction: string
  lastModifiedDate: string
  lastSeederAction: string
  leechers: string
  mallSingleFree: null
  oppose: string
  pickType: string
  promotionRule: null
  seeders: string
  status: string
  support: string
  timesCompleted: string
  toppingEndTime: null
  toppingLevel: string
  views: string
  visible: boolean
}

export interface MTeamSearchItem {
  anonymous: boolean
  audioCodec: string
  author: null
  canVote: boolean
  category: string
  collection: boolean
  countries: string[]
  createdDate: string
  dmmCode: string
  dmmInfo: null
  douban: string
  doubanRating: string
  editDate: null
  editedBy: null
  id: string
  imageList: string[]
  imdb: string
  imdbRating: string
  infoHash: null
  inRss: boolean
  labels: string
  labelsNew: string[]
  lastModifiedDate: string
  medium: null
  msUp: string
  name: string
  numfiles: string
  processing: null
  resetBox: null
  size: string
  smallDescr: string
  source: null
  standard: string
  status: Status
  team: string
  videoCodec: string
}

export interface MTeamSearchPayload {
  categories?: Array<number | string>
  discount?: string
  keyword?: string
  mode?: string
  pageNumber: number
  pageSize: number
  visible?: number
}

export interface MTeamSearchResponseBody {
  data: {
    data: MTeamSearchItem[]
    total: number
    pageNumber: number
    pageSize: number
    totalPages: number
  }
  message: string
}

export interface MTeamDetailResponseBody {
  [key: string]: unknown
  data?: {
    id: number | string
    title?: string
    name?: string
    size?: number | string
    createDate?: number | string
    createdDate?: number | string
    status?: MTeamStatus
    smallDescr?: string
    imageList?: string[]
    labelsNew?: string[]
    imdb?: string
    imdbRating?: number | string | null
    douban?: string
    doubanRating?: number | string | null
    originFileName?: string
    descr?: string
    mediainfo?: string
    description?: string
    fileList?: Array<{ name: string; size: number | string }>
    screenshotUrls?: string[]
    [key: string]: unknown
  }
  message?: string
}
