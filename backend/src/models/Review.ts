import mongoose, { Schema, Document } from 'mongoose'

export interface IReview extends Document {
  mangaId: string          // MangaDex ID or "local_<id>"
  userId: string
  userName: string
  userAvatar: string
  rating: number           // 1-10
  body: string             // review text (optional)

  flagged: boolean

  createdAt: Date
  updatedAt: Date
}

const ReviewSchema = new Schema<IReview>(
  {
    mangaId:     { type: String, required: true, index: true },
    userId:      { type: String, required: true },
    userName:    { type: String, required: true },
    userAvatar:  { type: String, default: '' },
    rating:      { type: Number, required: true, min: 1, max: 10 },
    body:        { type: String, default: '' },

    flagged:     { type: Boolean, default: false, index: true },

  },
  { timestamps: true }
)

// One review per user per manga
ReviewSchema.index({ mangaId: 1, userId: 1 }, { unique: true })


const _Model = mongoose.model<IReview>('Review', ReviewSchema)
export default _Model