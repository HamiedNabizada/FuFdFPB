import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'xsd-review-tool-secret-change-in-production';

// Registrierung
router.post('/register', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, Name und Passwort erforderlich' });
    }

    // Prüfen ob User existiert
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'E-Mail bereits registriert' });
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, 10);

    // User erstellen
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    // Token erstellen
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }

    // User finden
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Passwort prüfen
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    // Token erstellen
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// Alle User abrufen (für Mentions/Autocomplete)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;

    const users = await prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der User' });
  }
});

// Aktuellen User abrufen
router.get('/me', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, createdAt: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User nicht gefunden' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ error: 'Ungültiger Token' });
  }
});

export default router;
