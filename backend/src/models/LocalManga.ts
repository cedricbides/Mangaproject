import mongoose, { Schema, Document } from 'mongoose'

export interface ILocalManga extends Document {
  title: string
  altTitle?: string
  coverUrl?: string
  description?: string
  genres: string[]
  status: string
  author?: string
  artist?: string
  year?: number
  slug: string
  featured: boolean
  views: number

  saves: number
  seoTitle?: string
  seoDescription?: string
  seoKeywords?: string[]

  createdAt: Date
  updatedAt: Date
}

const LocalMangaSchema = new Schema<ILocalManga>(
  {
    title: { type: String, required: true },
    altTitle: { type: String },
    coverUrl: { type: String },
    description: { type: String },
    genres: [{ type: String }],
    status: { type: String, default: 'ongoing' },
    author: { type: String },
    artist: { type: String },
    year: { type: Number },
    slug: { type: String, required: true, unique: true },
    featured: { type: Boolean, default: false },
    views: { type: Number, default: 0 },

    saves: { type: Number, default: 0 },
    seoTitle:       { type: String },
    seoDescription: { type: String },
    seoKeywords:    [{ type: String }],

  },
  { timestamps: true }
)

LocalMangaSchema.index({ createdAt: -1 })


const _Model = mongoose.model<ILocalManga>('LocalManga', LocalMangaSchema)
export default _Model