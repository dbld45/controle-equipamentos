import type { User } from '../database/schema.js';

declare global {
  namespace Express {
    interface Request {
      user?: Pick<User, 'id' | 'name' | 'email' | 'role'>;
    }
  }
}
export {};
