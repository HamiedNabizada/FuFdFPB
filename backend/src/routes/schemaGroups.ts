import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { parseXsdDependencies, extractFilename, determineSchemaRole } from '../utils/xsd-dependency-parser';

const router = Router();

interface FileUpload {
  filename: string;
  content: string;
  isMaster?: boolean;
}

interface CreateGroupRequest {
  name: string;
  version: string;
  description?: string;
  files: FileUpload[];
}

// POST /api/schema-groups - Neue Gruppe mit mehreren Dateien erstellen
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req as any).prisma;
  const userId = (req as any).userId;
  const { name, version, description, files } = req.body as CreateGroupRequest;

  try {
    // Validierung
    if (!name || !version || !files || files.length === 0) {
      return res.status(400).json({ error: 'Name, Version und mindestens eine Datei erforderlich' });
    }

    // Prüfe ob Gruppe bereits existiert
    const existingGroup = await prisma.schemaGroup.findUnique({
      where: { name_version: { name, version } }
    });

    if (existingGroup) {
      return res.status(409).json({ error: 'Eine Gruppe mit diesem Namen und dieser Version existiert bereits' });
    }

    // Bestimme Rollen für jede Datei
    const filesWithRoles = files.map(file => ({
      ...file,
      role: file.isMaster ? 'master' : determineSchemaRole(file.filename, files)
    }));

    // Erstelle Gruppe und Schemas in einer Transaktion
    const result = await prisma.$transaction(async (tx) => {
      // 1. Gruppe erstellen
      const group = await tx.schemaGroup.create({
        data: {
          name,
          version,
          description,
          uploadedBy: userId
        }
      });

      // 2. Schemas erstellen
      const createdSchemas = [];
      for (const file of filesWithRoles) {
        // Schema-Name aus Dateiname (ohne .xsd Endung)
        const schemaName = file.filename.replace(/\.xsd$/i, '');

        const schema = await tx.schema.create({
          data: {
            name: schemaName,
            version,
            content: file.content,
            uploadedBy: userId,
            groupId: group.id,
            role: file.role,
            filename: file.filename
          }
        });
        createdSchemas.push(schema);
      }

      // 3. Abhängigkeiten erstellen
      for (const schema of createdSchemas) {
        const deps = parseXsdDependencies(schema.content);

        for (const dep of deps) {
          const targetFilename = extractFilename(dep.schemaLocation);
          const targetSchema = createdSchemas.find(s => s.filename === targetFilename);

          if (targetSchema) {
            await tx.schemaDependency.create({
              data: {
                sourceSchemaId: schema.id,
                targetSchemaId: targetSchema.id,
                dependencyType: dep.type,
                namespace: dep.namespace,
                schemaLocation: dep.schemaLocation
              }
            });
          }
        }
      }

      return { group, schemas: createdSchemas };
    });

    res.status(201).json({
      group: {
        id: result.group.id,
        name: result.group.name,
        version: result.group.version,
        description: result.group.description,
        schemas: result.schemas.map(s => ({
          id: s.id,
          name: s.name,
          filename: s.filename,
          role: s.role
        }))
      }
    });
  } catch (error: any) {
    console.error('Fehler beim Erstellen der Schema-Gruppe:', error);
    res.status(500).json({
      error: 'Interner Serverfehler',
      details: error?.message || String(error),
      code: error?.code
    });
  }
});

// GET /api/schema-groups - Alle Gruppen auflisten
router.get('/', async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req as any).prisma;

  try {
    const groups = await prisma.schemaGroup.findMany({
      include: {
        uploader: { select: { name: true } },
        schemas: {
          select: {
            id: true,
            name: true,
            filename: true,
            role: true,
            _count: { select: { comments: true } }
          }
        },
        _count: { select: { comments: true } }
      },
      orderBy: [{ name: 'asc' }, { version: 'desc' }]
    });

    res.json({
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        version: g.version,
        description: g.description,
        tags: g.tags ? g.tags.split(',') : [],
        uploadedBy: g.uploader?.name || 'Unbekannt',
        createdAt: g.createdAt,
        commentCount: g._count.comments,
        schemas: g.schemas.map(s => ({
          id: s.id,
          name: s.name,
          filename: s.filename,
          role: s.role,
          commentCount: s._count.comments
        }))
      }))
    });
  } catch (error) {
    console.error('Fehler beim Laden der Schema-Gruppen:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/schema-groups/:id - Einzelne Gruppe mit Details
router.get('/:id', async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req as any).prisma;
  const groupId = parseInt(req.params.id);

  try {
    const group = await prisma.schemaGroup.findUnique({
      where: { id: groupId },
      include: {
        uploader: { select: { name: true } },
        schemas: {
          include: {
            _count: { select: { comments: true } },
            dependsOn: {
              include: {
                targetSchema: { select: { id: true, name: true, filename: true } }
              }
            },
            dependedBy: {
              include: {
                sourceSchema: { select: { id: true, name: true, filename: true } }
              }
            }
          }
        },
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

    if (!group) {
      return res.status(404).json({ error: 'Gruppe nicht gefunden' });
    }

    res.json({
      group: {
        id: group.id,
        name: group.name,
        version: group.version,
        description: group.description,
        tags: group.tags ? group.tags.split(',') : [],
        uploadedBy: group.uploader?.name || 'Unbekannt',
        createdAt: group.createdAt,
        schemas: group.schemas.map(s => ({
          id: s.id,
          name: s.name,
          filename: s.filename,
          role: s.role,
          content: s.content,
          commentCount: s._count.comments,
          dependencies: s.dependsOn.map(d => ({
            type: d.dependencyType,
            targetId: d.targetSchema.id,
            targetName: d.targetSchema.name,
            targetFilename: d.targetSchema.filename,
            namespace: d.namespace,
            schemaLocation: d.schemaLocation
          })),
          dependedBy: s.dependedBy.map(d => ({
            type: d.dependencyType,
            sourceId: d.sourceSchema.id,
            sourceName: d.sourceSchema.name,
            sourceFilename: d.sourceSchema.filename
          }))
        })),
        comments: group.comments.map(c => ({
          id: c.id,
          commentText: c.commentText,
          authorName: c.author?.name || c.authorName || 'Anonym',
          status: c.status,
          createdAt: c.createdAt,
          replies: c.replies.map(r => ({
            id: r.id,
            replyText: r.replyText,
            authorName: r.author?.name || r.authorName || 'Anonym',
            createdAt: r.createdAt
          }))
        }))
      }
    });
  } catch (error) {
    console.error('Fehler beim Laden der Schema-Gruppe:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/schema-groups/:id/comments - Gruppen-Kommentar hinzufügen
router.post('/:id/comments', optionalAuthMiddleware, async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req as any).prisma;
  const groupId = parseInt(req.params.id);
  const userId = (req as any).userId;
  const { commentText, authorName } = req.body;

  try {
    if (!commentText) {
      return res.status(400).json({ error: 'Kommentartext erforderlich' });
    }

    const group = await prisma.schemaGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Gruppe nicht gefunden' });
    }

    const comment = await prisma.comment.create({
      data: {
        groupId,
        commentText,
        authorId: userId || null,
        authorName: userId ? null : (authorName || 'Anonym')
      },
      include: {
        author: { select: { name: true } }
      }
    });

    res.status(201).json({
      comment: {
        id: comment.id,
        commentText: comment.commentText,
        authorName: comment.author?.name || comment.authorName || 'Anonym',
        status: comment.status,
        createdAt: comment.createdAt
      }
    });
  } catch (error) {
    console.error('Fehler beim Erstellen des Gruppen-Kommentars:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/schema-groups/:id - Gruppe löschen
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req as any).prisma;
  const groupId = parseInt(req.params.id);

  try {
    const group = await prisma.schemaGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Gruppe nicht gefunden' });
    }

    await prisma.schemaGroup.delete({ where: { id: groupId } });

    res.json({ message: 'Gruppe erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen der Schema-Gruppe:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/schema-groups/:id/tags - Tags aktualisieren
router.patch('/:id/tags', authMiddleware, async (req: Request, res: Response) => {
  const prisma: PrismaClient = (req as any).prisma;
  const groupId = parseInt(req.params.id);
  const { tags } = req.body as { tags: string[] };

  try {
    const group = await prisma.schemaGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Gruppe nicht gefunden' });
    }

    // Tags als komma-getrennter String speichern (max 500 Zeichen)
    const tagsString = tags?.filter(t => t.trim()).join(',').substring(0, 500) || null;

    const updated = await prisma.schemaGroup.update({
      where: { id: groupId },
      data: { tags: tagsString }
    });

    res.json({
      message: 'Tags aktualisiert',
      tags: updated.tags ? updated.tags.split(',') : []
    });
  } catch (error) {
    console.error('Fehler beim Aktualisieren der Tags:', error);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

export default router;
