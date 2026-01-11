import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// Alle Schemas abrufen (gruppiert nach Name mit Versionen)
router.get('/', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;

    const schemas = await prisma.schema.findMany({
      orderBy: [{ name: 'asc' }, { version: 'desc' }],
      include: {
        _count: { select: { comments: true } },
        uploader: { select: { name: true } }
      }
    });

    // Gruppieren nach Name
    const grouped = schemas.reduce((acc, schema) => {
      if (!acc[schema.name]) {
        acc[schema.name] = [];
      }
      acc[schema.name].push({
        id: schema.id,
        version: schema.version,
        commentCount: schema._count.comments,
        uploadedBy: schema.uploader?.name || 'Unbekannt',
        createdAt: schema.createdAt
      });
      return acc;
    }, {} as Record<string, any[]>);

    res.json({ schemas: grouped });
  } catch (error) {
    console.error('Get schemas error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Schemas' });
  }
});

// Einzelnes Schema abrufen
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { id } = req.params;

    const schema = await prisma.schema.findUnique({
      where: { id: parseInt(id) },
      include: {
        uploader: { select: { name: true } },
        comments: {
          include: {
            author: { select: { name: true } },
            replies: {
              include: { author: { select: { name: true } } },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!schema) {
      return res.status(404).json({ error: 'Schema nicht gefunden' });
    }

    res.json({ schema });
  } catch (error) {
    console.error('Get schema error:', error);
    res.status(500).json({ error: 'Fehler beim Laden des Schemas' });
  }
});

// Schema hochladen
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;
    const { name, version, content } = req.body;

    if (!name || !version || !content) {
      return res.status(400).json({ error: 'Name, Version und Inhalt erforderlich' });
    }

    // Prüfen ob Version bereits existiert
    const existing = await prisma.schema.findUnique({
      where: { name_version: { name, version } }
    });

    if (existing) {
      return res.status(400).json({ error: `Version ${version} existiert bereits für ${name}` });
    }

    const schema = await prisma.schema.create({
      data: {
        name,
        version,
        content,
        uploadedBy: userId
      }
    });

    res.status(201).json({ schema });
  } catch (error) {
    console.error('Upload schema error:', error);
    res.status(500).json({ error: 'Fehler beim Hochladen des Schemas' });
  }
});

// Schema löschen
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { id } = req.params;

    await prisma.schema.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete schema error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Schemas' });
  }
});

// Kommentar zu Schema hinzufügen
router.post('/:id/comments', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;
    const { id } = req.params;
    const { xpath, elementName, commentText, authorName } = req.body;

    if (!xpath || !commentText) {
      return res.status(400).json({ error: 'XPath und Kommentartext erforderlich' });
    }

    const comment = await prisma.comment.create({
      data: {
        schemaId: parseInt(id),
        xpath,
        elementName,
        commentText,
        authorId: userId || null,
        authorName: userId ? null : authorName
      },
      include: {
        author: { select: { name: true } },
        replies: true
      }
    });

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Fehler beim Speichern des Kommentars' });
  }
});

// Alle Versionen eines Schemas abrufen
router.get('/by-name/:name', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { name } = req.params;

    const versions = await prisma.schema.findMany({
      where: { name },
      orderBy: { version: 'desc' },
      include: {
        _count: { select: { comments: true } },
        uploader: { select: { name: true } }
      }
    });

    res.json({ versions });
  } catch (error) {
    console.error('Get versions error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Versionen' });
  }
});

export default router;
