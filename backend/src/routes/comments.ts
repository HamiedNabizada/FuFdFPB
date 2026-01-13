import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// Kommentare für ein Schema abrufen
router.get('/schema/:schemaId', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { schemaId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { schemaId: parseInt(schemaId) },
      include: {
        author: { select: { name: true } },
        replies: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});

// Kommentare für ein bestimmtes Element abrufen
router.get('/schema/:schemaId/element', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { schemaId } = req.params;
    const { xpath } = req.query;

    if (!xpath) {
      return res.status(400).json({ error: 'XPath erforderlich' });
    }

    const comments = await prisma.comment.findMany({
      where: {
        schemaId: parseInt(schemaId),
        xpath: xpath as string
      },
      include: {
        author: { select: { name: true } },
        replies: {
          include: { author: { select: { name: true } } },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ comments });
  } catch (error) {
    console.error('Get element comments error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});

// Kommentar erstellen
router.post('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;
    const { schemaId, xpath, elementName, commentText, authorName, category } = req.body;

    if (!schemaId || !xpath || !commentText) {
      return res.status(400).json({ error: 'SchemaId, XPath und Kommentartext erforderlich' });
    }

    // Wenn nicht eingeloggt, muss authorName angegeben werden
    if (!userId && !authorName) {
      return res.status(400).json({ error: 'Name erforderlich (oder einloggen)' });
    }

    // Kategorie validieren
    const validCategories = ['editorial', 'technical', 'question', 'discussion', 'error'];
    const commentCategory = validCategories.includes(category) ? category : 'technical';

    const comment = await prisma.comment.create({
      data: {
        schemaId: parseInt(schemaId),
        xpath,
        elementName,
        commentText,
        authorId: userId || null,
        authorName: authorName || null,
        category: commentCategory
      },
      include: {
        author: { select: { name: true } },
        replies: true
      }
    });

    res.status(201).json({ comment });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Kommentars' });
  }
});

// Kommentar als erledigt markieren
router.patch('/:id/resolve', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { id } = req.params;

    const comment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: { status: 'resolved' }
    });

    res.json({ comment });
  } catch (error) {
    console.error('Resolve comment error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
  }
});

// Kommentar-Status ändern (resolved/open)
router.patch('/:id/status', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Status muss "open" oder "resolved" sein' });
    }

    const comment = await prisma.comment.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.json({ comment });
  } catch (error) {
    console.error('Update comment status error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Status' });
  }
});

// Kommentar löschen
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { id } = req.params;

    await prisma.comment.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Kommentars' });
  }
});

// Antwort auf Kommentar erstellen (Singular-Route für Frontend)
router.post('/:id/reply', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;
    const { id } = req.params;
    const { replyText, authorName } = req.body;

    if (!replyText) {
      return res.status(400).json({ error: 'Antworttext erforderlich' });
    }

    if (!userId && !authorName) {
      return res.status(400).json({ error: 'Name erforderlich (oder einloggen)' });
    }

    const reply = await prisma.reply.create({
      data: {
        commentId: parseInt(id),
        replyText,
        authorId: userId || null,
        authorName: authorName || null
      },
      include: {
        author: { select: { name: true } }
      }
    });

    res.status(201).json({ reply });
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Antwort' });
  }
});

// Antwort auf Kommentar erstellen
router.post('/:id/replies', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;
    const { id } = req.params;
    const { replyText, authorName } = req.body;

    if (!replyText) {
      return res.status(400).json({ error: 'Antworttext erforderlich' });
    }

    if (!userId && !authorName) {
      return res.status(400).json({ error: 'Name erforderlich (oder einloggen)' });
    }

    const reply = await prisma.reply.create({
      data: {
        commentId: parseInt(id),
        replyText,
        authorId: userId || null,
        authorName: authorName || null
      },
      include: {
        author: { select: { name: true } }
      }
    });

    res.status(201).json({ reply });
  } catch (error) {
    console.error('Create reply error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Antwort' });
  }
});

// Kommentare nach Status abrufen (für Homepage)
router.get('/by-status/:status', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { status } = req.params;
    const { category } = req.query;

    if (!['open', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Status muss "open" oder "resolved" sein' });
    }

    const validCategories = ['editorial', 'technical', 'question', 'discussion', 'error'];
    const whereClause: any = { status: status as 'open' | 'resolved' };

    if (category && validCategories.includes(category as string)) {
      whereClause.category = category as string;
    }

    const comments = await prisma.comment.findMany({
      where: whereClause,
      select: {
        id: true,
        commentText: true,
        xpath: true,
        elementName: true,
        status: true,
        category: true,
        createdAt: true,
        authorName: true,
        author: { select: { name: true } },
        schema: { select: { id: true, name: true, version: true, groupId: true } },
        group: { select: { id: true, name: true, version: true } },
        replies: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit für Performance
    });

    res.json({ comments });
  } catch (error) {
    console.error('Get comments by status error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});

// Globale Kommentar-Statistik (für Homepage)
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;

    const [total, open, resolved] = await Promise.all([
      prisma.comment.count(),
      prisma.comment.count({ where: { status: 'open' } }),
      prisma.comment.count({ where: { status: 'resolved' } })
    ]);

    res.json({
      stats: {
        total,
        open,
        resolved,
        progress: total > 0 ? Math.round((resolved / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get global comment stats error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistik' });
  }
});

// Meine Kommentare (für eingeloggten User)
router.get('/my-comments', authMiddleware, async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const userId = (req as any).userId;

    const comments = await prisma.comment.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        commentText: true,
        elementName: true,
        xpath: true,
        status: true,
        category: true,
        createdAt: true,
        schema: { select: { id: true, name: true, version: true, groupId: true } },
        group: { select: { id: true, name: true, version: true } },
        replies: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ comments });
  } catch (error) {
    console.error('Get my comments error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Kommentare' });
  }
});

// Volltext-Suche über Kommentare
router.get('/search', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const query = (req.query.q as string || '').trim();

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Suchbegriff muss mindestens 2 Zeichen haben' });
    }

    const comments = await prisma.comment.findMany({
      where: {
        OR: [
          { commentText: { contains: query } },
          { elementName: { contains: query } },
        ],
      },
      select: {
        id: true,
        commentText: true,
        elementName: true,
        xpath: true,
        status: true,
        category: true,
        createdAt: true,
        authorName: true,
        author: { select: { name: true } },
        schema: { select: { id: true, name: true, version: true, groupId: true } },
        group: { select: { id: true, name: true, version: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ comments, query });
  } catch (error) {
    console.error('Search comments error:', error);
    res.status(500).json({ error: 'Fehler bei der Suche' });
  }
});

// Letzte Aktivitäten (neueste Kommentare und Antworten)
router.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

    // Neueste Kommentare
    const recentComments = await prisma.comment.findMany({
      select: {
        id: true,
        commentText: true,
        elementName: true,
        xpath: true,
        category: true,
        createdAt: true,
        authorName: true,
        author: { select: { name: true } },
        schema: { select: { id: true, name: true, version: true, groupId: true } },
        group: { select: { id: true, name: true, version: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Neueste Antworten
    const recentReplies = await prisma.reply.findMany({
      select: {
        id: true,
        replyText: true,
        createdAt: true,
        authorName: true,
        author: { select: { name: true } },
        comment: {
          select: {
            id: true,
            elementName: true,
            xpath: true,
            schema: { select: { id: true, name: true, version: true, groupId: true } },
            group: { select: { id: true, name: true, version: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Kombinieren und nach Datum sortieren
    const activities = [
      ...recentComments.map(c => ({
        type: 'comment' as const,
        id: c.id,
        text: c.commentText,
        elementName: c.elementName,
        xpath: c.xpath,
        category: c.category,
        authorName: c.author?.name || c.authorName || 'Anonym',
        createdAt: c.createdAt,
        schema: c.schema,
        group: c.group,
      })),
      ...recentReplies.map(r => ({
        type: 'reply' as const,
        id: r.id,
        text: r.replyText,
        elementName: r.comment.elementName,
        xpath: r.comment.xpath,
        category: null,
        authorName: r.author?.name || r.authorName || 'Anonym',
        createdAt: r.createdAt,
        schema: r.comment.schema,
        group: r.comment.group,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    res.json({ activities });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Aktivitäten' });
  }
});

// Kommentar-Statistik für ein Schema
router.get('/schema/:schemaId/stats', async (req: Request, res: Response) => {
  try {
    const prisma: PrismaClient = (req as any).prisma;
    const { schemaId } = req.params;

    const [total, open, resolved, byElement] = await Promise.all([
      prisma.comment.count({ where: { schemaId: parseInt(schemaId) } }),
      prisma.comment.count({ where: { schemaId: parseInt(schemaId), status: 'open' } }),
      prisma.comment.count({ where: { schemaId: parseInt(schemaId), status: 'resolved' } }),
      prisma.comment.groupBy({
        by: ['xpath', 'elementName'],
        where: { schemaId: parseInt(schemaId) },
        _count: true
      })
    ]);

    res.json({
      stats: {
        total,
        open,
        resolved,
        byElement: byElement.map(e => ({
          xpath: e.xpath,
          elementName: e.elementName,
          count: e._count
        }))
      }
    });
  } catch (error) {
    console.error('Get comment stats error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Statistik' });
  }
});

export default router;
