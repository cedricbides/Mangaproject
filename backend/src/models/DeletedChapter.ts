import mongoose, { Schema, Document } from 'mongoose'

export interface IDeletedChapter extends Document {
  mangaDexId: string
  mangaTitle?: string
  chapterId: string
  chapterNumber?: string
  chapterTitle?: string
  deletedBy: string
  createdAt: Date
}

const DeletedChapterSchema = new Schema(
  {
    mangaDexId:    { type: String, required: true, index: true },
    mangaTitle:    { type: String },
    chapterId:     { type: String, required: true, index: true },
    chapterNumber: { type: String },
    chapterTitle:  { type: String },
    deletedBy:     { type: String },
  },
  { timestamps: true }
)

DeletedChapterSchema.index({ mangaDexId: 1, chapterId: 1 }, { unique: true })


const _Model = mongoose.model<IDeletedChapter>('DeletedChapter', DeletedChapterSchema)
export default _Model