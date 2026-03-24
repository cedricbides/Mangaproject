import type { IUser } from '../../models/User'

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends IUser {}

    interface Request {
      user?: IUser
    }
  }
}

export {}