import mongoose, { Schema, Document } from 'mongoose'

export interface IBannerSlide {
  type: 'mangadex' | 'local' | 'custom'
  mangaId?: string
  customTitle?: string
  customDescription?: string
  customCoverUrl?: string
  customBadge?: string
  ctaLabel?: string
  ctaUrl?: string
  order: number
  expiresAt?: Date | null   // null = permanent
}

export interface IFeaturedPick {
  type: 'mangadex' | 'local'
  mangaId: string
  title: string
  coverUrl?: string
  order: number
  expiresAt?: Date | null   // null = permanent
}

export interface IScheduledAnnouncement {
  message: string
  color: 'info' | 'warning' | 'success' | 'danger'
  startsAt: Date
  endsAt: Date
  enabled: boolean
}

export interface ISiteSettings extends Document {
  bannerSlides: IBannerSlide[]
  featuredPicks: IFeaturedPick[]
  genres: string[]
  maintenanceMode: boolean
  maintenanceMessage: string
  announcementBanner: string
  announcementBannerEnabled: boolean
  scheduledAnnouncements: IScheduledAnnouncement[]
  registrationOpen: boolean
  defaultLanguage: string
  seoSiteName: string
  seoDefaultDescription: string
  updatedAt: Date
}

const BannerSlideSchema = new Schema<IBannerSlide>({
  type:               { type: String, default: 'mangadex' },
  mangaId:            { type: String },
  customTitle:        { type: String },
  customDescription:  { type: String },
  customCoverUrl:     { type: String },
  customBadge:        { type: String },
  ctaLabel:           { type: String, default: 'Read Now' },
  ctaUrl:             { type: String },
  order:              { type: Number, default: 0 },
  expiresAt:          { type: Date, default: null },
}, { _id: true })

const FeaturedPickSchema = new Schema<IFeaturedPick>({
  type:     { type: String, default: 'mangadex' },
  mangaId:  { type: String, required: true },
  title:    { type: String, required: true },
  coverUrl: { type: String },
  order:    { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
}, { _id: true })

const ScheduledAnnouncementSchema = new Schema<IScheduledAnnouncement>({
  message:  { type: String, required: true },
  color:    { type: String, default: 'info' },
  startsAt: { type: Date, required: true },
  endsAt:   { type: Date, required: true },
  enabled:  { type: Boolean, default: true },
}, { _id: true })

const SiteSettingsSchema = new Schema<ISiteSettings>(
  {
    bannerSlides:   { type: [BannerSlideSchema], default: [] },
    featuredPicks:  { type: [FeaturedPickSchema], default: [] },
    genres: {
      type: [String],
      default: [
        'Action','Adventure','Comedy','Drama','Fantasy','Horror','Mystery',
        'Romance','Sci-Fi','Slice of Life','Sports','Thriller','Psychological',
        'Historical','Supernatural','Isekai','Mecha','Music','School Life',
      ],
    },
    maintenanceMode:           { type: Boolean, default: false },
    maintenanceMessage:        { type: String, default: 'We are down for maintenance. Check back soon.' },
    announcementBanner:        { type: String, default: '' },
    announcementBannerEnabled: { type: Boolean, default: false },
    scheduledAnnouncements:    { type: [ScheduledAnnouncementSchema], default: [] },
    registrationOpen:          { type: Boolean, default: true },
    defaultLanguage:           { type: String, default: 'en' },
    seoSiteName:               { type: String, default: 'MangaVerse' },
    seoDefaultDescription:     { type: String, default: 'Read manga online for free.' },
  },
  { timestamps: true }
)

const _Model = mongoose.model<ISiteSettings>('SiteSettings', SiteSettingsSchema)
export default _Model