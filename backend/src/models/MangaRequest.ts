import mongoose, { Schema, Document } from 'mongoose'

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'added'

export interface IMangaRequest extends Document {
  userId: string
  userName: string
  userAvatar?: string
  title: string
  alternativeTitles?: string
  mangadexUrl?: string
  notes?: string
  status: RequestStatus
  adminNote?: string
  upvotes: string[]       // userIds who upvoted
  warnedExpiry?: boolean
  createdAt: Date
  updatedAt: Date
}

const MangaRequestSchema = new Schema<IMangaRequest>(
  {
    userId:            { type: String, required: true },  
    userName:          { type: String, required: true },
    userAvatar:        { type: String, default: '' },
    title:             { type: String, required: true, maxlength: 200 },
    alternativeTitles: { type: String, maxlength: 300 },
    mangadexUrl:       { type: String, maxlength: 500 },
    notes:             { type: String, maxlength: 1000 },
    status:            { type: String, enum: ['pending', 'approved', 'rejected', 'added'], default: 'pending' },
    adminNote:         { type: String, maxlength: 500 },
    upvotes:           { type: [String], default: [] },
    warnedExpiry:      { type: Boolean, default: false },
  },
  { timestamps: true }
)

MangaRequestSchema.index({ status: 1, createdAt: 1 })

const _Model = (mongoose.models.MangaRequest as mongoose.Model<IMangaRequest>) || mongoose.model<IMangaRequest>('MangaRequest', MangaRequestSchema)
export default _Model