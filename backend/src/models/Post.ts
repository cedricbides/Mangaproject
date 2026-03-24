import mongoose, { Schema, Document } from 'mongoose'

export interface IPostReaction {
  userId: string
  emoji: string  // e.g. '❤️', '😂', '🔥', '😮', '👏'
}

export interface IPostComment {
  _id: mongoose.Types.ObjectId
  userId: string
  userName: string
  userAvatar: string
  body: string
  createdAt: Date
}

export interface IPost extends Document {
  userId: string
  userName: string
  userAvatar: string
  body: string
  imageUrl?: string
  linkUrl?: string
  linkTitle?: string
  linkDescription?: string
  linkImage?: string
  linkSource?: string
  reactions: IPostReaction[]
  comments: IPostComment[]
  createdAt: Date
  updatedAt: Date
}

const PostCommentSchema = new Schema<IPostComment>({
  userId:     { type: String, required: true },
  userName:   { type: String, required: true },
  userAvatar: { type: String, default: '' },
  body:       { type: String, required: true, maxlength: 1000 },
  createdAt:  { type: Date, default: Date.now },
}, { _id: true })

const PostSchema = new Schema<IPost>(
  {
    userId:          { type: String, required: true, index: true },
    userName:        { type: String, required: true },
    userAvatar:      { type: String, default: '' },
    body:            { type: String, default: '', maxlength: 2000 },
    imageUrl:        { type: String },
    linkUrl:         { type: String },
    linkTitle:       { type: String },
    linkDescription: { type: String },
    linkImage:       { type: String },
    linkSource:      { type: String },
    reactions:       [{
      userId: { type: String, required: true },
      emoji:  { type: String, required: true },
    }],
    comments: [PostCommentSchema],
  },
  { timestamps: true }
)

PostSchema.index({ createdAt: -1 })

const _Model = mongoose.model<IPost>('Post', PostSchema)
export default _Model