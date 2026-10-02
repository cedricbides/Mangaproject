import mongoose, { Schema, Document } from 'mongoose'

export interface IMangaList extends Document {
  userId: string
  name: string
  description?: string
  isPublic: boolean
  mangaIds: string[]   // MangaDex manga IDs
  createdAt: Date
  updatedAt: Date
}

const MangaListSchema = new Schema<IMangaList>(
  {
    userId:      { type: String, required: true, index: true },
    name:        { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    isPublic:    { type: Boolean, default: true },
    mangaIds:    { type: [String], default: [] },
  },
  { timestamps: true }
)

export default mongoose.model<IMangaList>('MangaList', MangaListSchema)