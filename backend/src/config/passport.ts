import passport from 'passport'
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import User from '../models/User'

export function configurePassport() {
  passport.serializeUser((user: Express.User, done: (err: any, id?: string) => void) => {
    done(null, (user as { id: string }).id)
  })

  passport.deserializeUser(async (id: string, done: (err: any, user?: Express.User | false | null) => void) => {
    try {
      const user = await User.findById(id)
      done(null, user)
    } catch (err) {
      done(err)
    }
  })

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Google OAuth skipped - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in .env')
    return
  }

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
  },
  (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
    (async () => {
      let user = await User.findOne({ googleId: profile.id })

      if (!user) {
        const email = profile.emails?.[0]?.value
        user = await User.findOne({ email })

        if (user) {
          user.googleId = profile.id
          if (!user.avatar) user.avatar = profile.photos?.[0]?.value || ''
          await user.save()
        } else {
          const count = await User.countDocuments()
          user = await User.create({
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails?.[0]?.value || '',
            avatar: profile.photos?.[0]?.value || '',
            role: count === 0 ? 'admin' : 'user',
            emailVerified: true,
          })
        }
      }

      return user
    })()
      .then(user => done(null, user))
      .catch(err => done(err))
  }))
}