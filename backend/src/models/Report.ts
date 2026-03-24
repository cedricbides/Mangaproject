import mongoose, { Schema, Document } from 'mongoose'

export interface IReport extends Document {
  targetType: 'comment' | 'review'
  targetId: string
  targetBody: string       // snapshot of the content at report time
  targetUserId: string
  targetUserName: string
  reportedBy: string       // userId
  reportedByName: string
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  resolvedAt?: Date
  createdAt: Date
}

const ReportSchema = new Schema<IReport>({
  targetType:      { type: String, enum: ['comment', 'review'], required: true },
  targetId:        { type: String, required: true, index: true },
  targetBody:      { type: String, default: '' },
  targetUserId:    { type: String, required: true },
  targetUserName:  { type: String, required: true },
  reportedBy:      { type: String, required: true },
  reportedByName:  { type: String, required: true },
  reason:          { type: String, required: true },
  status:          { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending', index: true },
  resolvedAt:      { type: Date },
}, { timestamps: true })

// Prevent duplicate reports from same user on same target
ReportSchema.index({ targetId: 1, reportedBy: 1 }, { unique: true })

const _Model = mongoose.model<IReport>('Report', ReportSchema)
export default _Model