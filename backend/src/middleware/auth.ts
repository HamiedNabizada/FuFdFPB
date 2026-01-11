import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'xsd-review-tool-secret-change-in-production';

// Strenge Auth - User muss eingeloggt sein
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };

    (req as any).userId = decoded.userId;
    (req as any).userEmail = decoded.email;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
};

// Optionale Auth - User kann eingeloggt sein, muss aber nicht
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
      (req as any).userId = decoded.userId;
      (req as any).userEmail = decoded.email;
    }

    next();
  } catch (error) {
    // Token ungültig, aber das ist OK bei optionaler Auth
    next();
  }
};
