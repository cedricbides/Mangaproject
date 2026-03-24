import mongoose, { Schema, Document } from 'mongoose'

export interface IRating extends Document {
  mangaId: string
  userId: string
  score: number
  createdAt: Date
  updatedAt: Date
}

const RatingSchema = new Schema<IRating>(
  {
    mangaId: { type: String, required: true },
    userId:  { type: String, required: true },
    score:   { type: Number, required: true, min: 1, max: 10 },
  },
  { timestamps: true }
)

// One rating per user per manga
RatingSchema.index({ mangaId: 1, userId: 1 }, { unique: true })

export default mongoose.model<IRating>('Rating', RatingSchema)