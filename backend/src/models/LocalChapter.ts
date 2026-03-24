import mongoose, { Schema, Document } from 'mongoose'


export interface ILocalChapter extends Document {

  mangaId: mongoose.Types.ObjectId
  chapterNumber: string
  title?: string
  volume?: string

  pages: string[]
  language: string
  draft: boolean
  publishAt?: Date | null   // null/undefined = publish now; future date = scheduled
  externalUrl?: string
  pageViews: number[]       // per-page view count for heatmap
  totalViews: number

  createdAt: Date
}

const LocalChapterSchema = new Schema<ILocalChapter>(
  {
    mangaId: { type: Schema.Types.ObjectId, ref: 'LocalManga', required: true },
    chapterNumber: { type: String, required: true },
    title: { type: String },
    volume: { type: String },
    pages: [{ type: String }],
    language: { type: String, default: 'en' },

    draft:      { type: Boolean, default: false },
    publishAt:  { type: Date, default: null },
    externalUrl: { type: String },
    pageViews:  { type: [Number], default: [] },
    totalViews: { type: Number, default: 0 },

  },
  { timestamps: true }
)

LocalChapterSchema.index({ mangaId: 1, chapterNumber: 1 }, { unique: true })

LocalChapterSchema.index({ publishAt: 1 })

const _Model = mongoose.model<ILocalChapter>('LocalChapter', LocalChapterSchema)

export default _Model