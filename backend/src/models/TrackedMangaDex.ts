import mongoose, { Schema, Document } from 'mongoose'

export interface ITrackedMangaDex extends Document {
  mangaDexId: string
  title: string
  coverUrl: string
  status: string
  author: string
  year?: number
  pinnedAt: Date

  views: number

}

const TrackedMangaDexSchema = new Schema<ITrackedMangaDex>(
  {
    mangaDexId: { type: String, required: true, unique: true },
    title:      { type: String, required: true },
    coverUrl:   { type: String, default: '' },
    status:     { type: String, default: 'ongoing' },
    author:     { type: String, default: '' },
    year:       { type: Number },
    pinnedAt:   { type: Date, default: Date.now },

    views:      { type: Number, default: 0 },

  },
  { timestamps: true }
)


const _Model = mongoose.model<ITrackedMangaDex>('TrackedMangaDex', TrackedMangaDexSchema)
export default _Model