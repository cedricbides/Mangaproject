import mongoose, { Schema, Document } from 'mongoose'

export interface IVisitorSession extends Document {
  sessionId: string
  userId?: string
  username?: string
  page: string            // current page path e.g. '/manga/one-piece'
  pageTitle?: string
  ip?: string
  userAgent?: string
  referrer?: string
  country?: string
  lastSeen: Date
  createdAt: Date
}

const VisitorSessionSchema = new Schema<IVisitorSession>(
  {
    sessionId:  { type: String, required: true, unique: true },
    userId:     { type: String },
    username:   { type: String },
    page:       { type: String, required: true },
    pageTitle:  { type: String },
    ip:         { type: String },
    userAgent:  { type: String },
    referrer:   { type: String },
    country:    { type: String },
    lastSeen:   { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

// Expire sessions after 5 minutes of inactivity (TTL index on lastSeen)
VisitorSessionSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 300 })
VisitorSessionSchema.index({ createdAt: -1 })

const _Model = mongoose.model<IVisitorSession>('VisitorSession', VisitorSessionSchema)
export default _Model