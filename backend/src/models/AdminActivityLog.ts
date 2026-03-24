import mongoose, { Schema, Document } from 'mongoose'

export interface IAdminActivityLog extends Document {
  adminId: string
  adminUsername: string
  action: string          // e.g. 'manga.create', 'user.ban', 'chapter.delete'
  category: 'manga' | 'chapter' | 'user' | 'site' | 'moderation' | 'backup' | 'analytics'
  targetId?: string       // ID of the affected resource
  targetLabel?: string    // Human-readable name e.g. manga title or username
  details?: Record<string, any>
  ip?: string
  createdAt: Date
}

const AdminActivityLogSchema = new Schema<IAdminActivityLog>(
  {
    adminId:       { type: String, required: true, index: true },
    adminUsername: { type: String, required: true },
    action:        { type: String, required: true },
    category:      { type: String, required: true, index: true },
    targetId:      { type: String },
    targetLabel:   { type: String },
    details:       { type: Schema.Types.Mixed },
    ip:            { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

AdminActivityLogSchema.index({ createdAt: -1 })
AdminActivityLogSchema.index({ adminId: 1, createdAt: -1 })

const _Model = mongoose.model<IAdminActivityLog>('AdminActivityLog', AdminActivityLogSchema)
export default _Model