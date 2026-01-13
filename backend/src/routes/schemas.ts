import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// Alle Standalone-Schemas abrufen (nur die ohne Gruppe - für Abwärtskompatibilität)
router.get('/', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;

    // Nur Schemas ohne Gruppe (standalone) - nach Migration sollte das leer sein
    const schemas = await prisma.schema.findMany({
      where: { groupId: null },
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

// Migration: Standalone-Schemas zu Gruppen migrieren
router.post('/migrate-to-groups', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;

    // Finde alle Standalone-Schemas (ohne Gruppe)
    const standaloneSchemas = await prisma.schema.findMany({
      where: { groupId: null }
    });

    if (standaloneSchemas.length === 0) {
      return res.json({ message: 'Keine Standalone-Schemas gefunden', migrated: 0 });
    }

    let migrated = 0;

    for (const schema of standaloneSchemas) {
      await prisma.$transaction(async (tx) => {
        // Prüfen ob Gruppe schon existiert
        const existingGroup = await tx.schemaGroup.findFirst({
          where: { name: schema.name, version: schema.version }
        });

        let groupId: number;

        if (existingGroup) {
          // Gruppe existiert schon - Schema zuordnen
          groupId = existingGroup.id;
        } else {
          // Neue Gruppe erstellen
          const newGroup = await tx.schemaGroup.create({
            data: {
              name: schema.name,
              version: schema.version,
              tags: schema.tags,
              uploadedBy: schema.uploadedBy,
              createdAt: schema.createdAt
            }
          });
          groupId = newGroup.id;
        }

        // Schema aktualisieren
        await tx.schema.update({
          where: { id: schema.id },
          data: {
            groupId: groupId,
            role: 'master',
            filename: `${schema.name}.xsd`
          }
        });

        migrated++;
      });
    }

    res.json({
      message: `${migrated} Schema(s) erfolgreich migriert`,
      migrated
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Fehler bei der Migration' });
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

// Schema hochladen (erstellt automatisch eine Gruppe)
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;
    const { name, version, content } = req.body;

    if (!name || !version || !content) {
      return res.status(400).json({ error: 'Name, Version und Inhalt erforderlich' });
    }

    // Prüfen ob Gruppe mit diesem Namen und Version bereits existiert
    const existingGroup = await prisma.schemaGroup.findFirst({
      where: { name, version }
    });

    if (existingGroup) {
      return res.status(400).json({ error: `Version ${version} existiert bereits für ${name}` });
    }

    // Erstelle Gruppe und Schema in einer Transaktion
    const result = await prisma.$transaction(async (tx) => {
      // 1. Gruppe erstellen
      const group = await tx.schemaGroup.create({
        data: {
          name,
          version,
          uploadedBy: userId
        }
      });

      // 2. Schema erstellen und mit Gruppe verknüpfen
      const schema = await tx.schema.create({
        data: {
          name,
          version,
          content,
          filename: `${name}.xsd`,
          role: 'master',
          groupId: group.id,
          uploadedBy: userId
        }
      });

      return { group, schema };
    });

    res.status(201).json({
      schema: result.schema,
      group: result.group
    });
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

// PATCH /api/schemas/:id/tags - Tags aktualisieren
router.patch('/:id/tags', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const schemaId = parseInt(req.params.id);
    const { tags } = req.body as { tags: string[] };

    const schema = await prisma.schema.findUnique({ where: { id: schemaId } });
    if (!schema) {
      return res.status(404).json({ error: 'Schema nicht gefunden' });
    }

    // Tags als komma-getrennter String speichern (max 500 Zeichen)
    const tagsString = tags?.filter(t => t.trim()).join(',').substring(0, 500) || null;

    const updated = await prisma.schema.update({
      where: { id: schemaId },
      data: { tags: tagsString }
    });

    res.json({
      message: 'Tags aktualisiert',
      tags: updated.tags ? updated.tags.split(',') : []
    });
  } catch (error) {
    console.error('Update tags error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Tags' });
  }
});

export default router;
