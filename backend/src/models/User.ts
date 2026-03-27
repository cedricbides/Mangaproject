import mongoose, { Schema, Document } from 'mongoose'
import bcrypt from 'bcryptjs'

export type ReadingStatus = 'reading' | 'completed' | 'plan_to_read' | 'on_hold' | 'dropped'

export interface IUser extends Document {
  googleId?: string
  name: string
  email: string
  avatar: string
  password?: string

  emailVerified: boolean
  emailVerificationToken?: string
  emailVerificationExpires?: Date

  passwordResetToken?: string
  passwordResetExpires?: Date

  role: 'user' | 'moderator' | 'admin' | 'superadmin'
  adminPermissions: string[]
  banned: boolean
  bannedReason?: string
  bannedAt?: Date
  bannerUrl: string
  bio: string
  postCount: number
  favorites: string[]
  following: string[]
  watchedManga: string[]
  pushSubscriptions: Array<{
    endpoint: string
    keys: { p256dh: string; auth: string }
  }>

  readingList: Array<{
    mangaId: string
    status: ReadingStatus
    updatedAt: Date
  }>
  readingHistory: Array<{
    mangaId: string
    chapterId: string
    page: number
    updatedAt: Date
    isLocal?: boolean
  }>

  theme: 'dark' | 'dim' | 'light'
  createdAt: Date
  comparePassword(candidate: string): Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatar: { type: String, default: '' },
    // Password is excluded from query results by default.
    // Use .select('+password') explicitly when needed.
    password: { type: String, select: false },

    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },

    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    role: {
      type: String,
      enum: ['user', 'moderator', 'admin', 'superadmin'],
      default: 'user',
    },
    adminPermissions: { type: [String], default: [] },
    banned: { type: Boolean, default: false },
    bannedReason: { type: String },
    bannedAt: { type: Date },
    bannerUrl: { type: String, default: '' },
    bio: { type: String, default: '' },
    theme: { type: String, enum: ['dark', 'dim', 'light'], default: 'dark' },
    postCount: { type: Number, default: 0 },
    favorites: [{ type: String }],
    following: [{ type: String }],
    watchedManga: [{ type: String }],
    pushSubscriptions: [{
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
      _id: false,
    }],

    readingList: [{
      mangaId: { type: String, required: true },
      status: {
        type: String,
        enum: ['reading', 'completed', 'plan_to_read', 'on_hold', 'dropped'],
        required: true,
      },
      updatedAt: { type: Date, default: Date.now },
    }],
    readingHistory: [{
      mangaId: String,
      chapterId: String,
      page: { type: Number, default: 0 },
      isLocal: { type: Boolean, default: false },
      updatedAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
)

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  if (!this.password) return false
  return bcrypt.compare(candidate, this.password)
}

UserSchema.index({ following: 1 })
UserSchema.index({ favorites: 1 })

const UserModel = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema)
export default UserModel