import mongoose, { Schema, Document } from 'mongoose'

export interface IComment extends Document {
  chapterId: string
  mangaId: string
  userId: string
  userName: string
  userAvatar: string
  body: string
  likes: string[]
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

const CommentSchema = new Schema(
  {
    chapterId:   { type: String, required: true, index: true },
    mangaId:     { type: String, default: '' },
    userId:      { type: String, required: true },
    userName:    { type: String, required: true },
    userAvatar:  { type: String, default: '' },
    body:        { type: String, required: true, maxlength: 2000 },
    likes:       { type: [String], default: [] },
    parentId:    { type: String, default: null },
  },
  { timestamps: true }
)

CommentSchema.index({ chapterId: 1, createdAt: -1 })

const Comment = mongoose.model<IComment>('Comment', CommentSchema)
export default Comment