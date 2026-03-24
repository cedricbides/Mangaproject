import mongoose, { Schema, Document } from 'mongoose'

type NotificationAudience = 'user' | 'admin'

type UserNotificationType =
  | 'new_chapter'
  | 'new_follower'
  | 'comment_reply'
  | 'request_approved'
  | 'request_denied'
  | 'system'

type AdminNotificationType =
  | 'new_report'
  | 'new_request'
  | 'new_user'
  | 'chapter_published'

type NotificationType = UserNotificationType | AdminNotificationType

export interface INotification extends Document {
  audience: NotificationAudience
  userId?: string
  type: NotificationType
  title: string
  body: string
  link?: string
  read: boolean
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    audience: { type: String, enum: ['user', 'admin'], required: true },
    userId:   { type: String, index: true },   // null = admin broadcast
    type:     { type: String, required: true },
    title:    { type: String, required: true },
    body:     { type: String, required: true },
    link:     { type: String },
    read:     { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Indexes for fast queries
NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index({ audience: 1, createdAt: -1 })
NotificationSchema.index({ audience: 1, read: 1 })

const _Model = mongoose.model<INotification>('Notification', NotificationSchema)
export default _Model