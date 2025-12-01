export interface MTeamStatus {
  seeders?: number | string
  leechers?: number | string
  snatches?: number | string
  timesCompleted?: number | string
  discount?: string | null
  discountEndTime?: string | null
  [key: string]: unknown
}

export interface Status {
  id: string
  createdDate: string
  lastModifiedDate: string
  pickType: string
  toppingLevel: string
  toppingEndTime: null
  discount: string
  discountEndTime: null
  timesCompleted: string
  comments: string
  lastAction: string
  lastSeederAction: string
  views: string
  hits: string
  support: string
  oppose: string
  status: string
  seeders: string
  leechers: string
  banned: boolean
  visible: boolean
  promotionRule: null
  mallSingleFree: null
}

export interface MTeamSearchItem {
  id: string
  createdDate: string
  lastModifiedDate: string
  name: string
  smallDescr: string
  imdb: string
  imdbRating: string
  douban: string
  doubanRating: string
  dmmCode: string
  author: null
  category: string
  source: null
  medium: null
  standard: string
  videoCodec: string
  audioCodec: string
  team: string
  processing: null
  countries: string[]
  numfiles: string
  size: string
  labels: string
  labelsNew: string[]
  msUp: string
  anonymous: boolean
  infoHash: null
  status: Status
  dmmInfo: null
  editedBy: null
  editDate: null
  collection: boolean
  inRss: boolean
  canVote: boolean
  imageList: string[]
  resetBox: null
}

export interface MTeamSearchPayload {
  keyword?: string
  categories?: Array<number | string>
  pageNumber: number
  pageSize: number
  mode?: string
  discount?: string
  visible?: number
}

export interface MTeamSearchResponseBody {
  message: string
  data: {
    data: MTeamSearchItem[]
    total: number
    pageNumber: number
    pageSize: number
    totalPages: number
  }
}

export interface MTeamDetailResponseBody {
  message?: string
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
  [key: string]: unknown
}
