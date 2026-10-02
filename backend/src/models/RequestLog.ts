import mongoose, { Schema, Document } from 'mongoose'

export interface IRequestLog extends Document {
  ts: Date
  ip: string
  userId?: string
  method: string
  path: string      // normalized, no query string, ids collapsed to :id
  status: number
  ua?: string
  ms?: number
}

const RequestLogSchema = new Schema<IRequestLog>(
  {
    ts:     { type: Date, default: Date.now },
    ip:     { type: String },
    userId: { type: String },
    method: { type: String },
    path:   { type: String },
    status: { type: Number },
    ua:     { type: String },
    ms:     { type: Number },
  },
  { versionKey: false }
)

// Keep 7 days of logs, then Mongo deletes them automatically
RequestLogSchema.index({ ts: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 })
RequestLogSchema.index({ ip: 1, ts: -1 })
RequestLogSchema.index({ userId: 1, ts: -1 })

const _Model = mongoose.model<IRequestLog>('RequestLog', RequestLogSchema)
export default _Model
