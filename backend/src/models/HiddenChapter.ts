import mongoose, { Schema, Document } from 'mongoose'

export interface IHiddenChapter extends Document {
  mangaDexId: string
  mangaTitle?: string
  chapterId: string
  chapterNumber?: string
  chapterTitle?: string
  hiddenBy: string
  createdAt: Date
}

const HiddenChapterSchema = new Schema(
  {
    mangaDexId:    { type: String, required: true, index: true },
    mangaTitle:    { type: String },
    chapterId:     { type: String, required: true, index: true },
    chapterNumber: { type: String },
    chapterTitle:  { type: String },
    hiddenBy:      { type: String },
  },
  { timestamps: true }
)

HiddenChapterSchema.index({ mangaDexId: 1, chapterId: 1 }, { unique: true })


const _Model = mongoose.model<IHiddenChapter>('HiddenChapter', HiddenChapterSchema)
export default _Model