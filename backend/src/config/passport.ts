import passport from 'passport'
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20'
import User from '../models/User'

export function configurePassport() {
  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as { id: string }).id)
  })

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id)
      done(null, user)
    } catch (err) {
      done(err)
    }
  })

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[passport] Google OAuth skipped: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in .env')
    return
  }

  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile: Profile, done: VerifyCallback) => {
      try {
        // Try to find an existing account by Google ID first
        let user = await User.findOne({ googleId: profile.id })

        if (!user) {
          const email = profile.emails?.[0]?.value

          // If there's an existing email-based account, link the Google ID to it
          user = await User.findOne({ email })
          if (user) {
            user.googleId = profile.id
            if (!user.avatar) user.avatar = profile.photos?.[0]?.value || ''
            await user.save()
          } else {
            // New account: first user gets admin; everyone else gets user.
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

        done(null, user)
      } catch (err) {
        done(err as Error)
      }
    }
  ))
}