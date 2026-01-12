// Schema-Gruppen Types

export interface SchemaGroup {
  id: number;
  name: string;
  version: string;
  description?: string;
  tags?: string[];
  uploadedBy: string;
  createdAt: string;
  commentCount: number;
  schemas: SchemaInGroup[];
}

export interface SchemaInGroup {
  id: number;
  name: string;
  filename: string;
  role: 'master' | 'imported' | 'included' | 'standalone';
  commentCount: number;
  content?: string;
  dependencies?: SchemaDependency[];
  dependedBy?: SchemaReference[];
}

export interface SchemaDependency {
  type: 'import' | 'include';
  targetId: number;
  targetName: string;
  targetFilename: string;
  namespace?: string;
  schemaLocation: string;
}

export interface SchemaReference {
  type: 'import' | 'include';
  sourceId: number;
  sourceName: string;
  sourceFilename: string;
}

export interface GroupComment {
  id: number;
  commentText: string;
  authorName: string;
  status: 'open' | 'resolved';
  category?: 'editorial' | 'technical' | 'question' | 'discussion' | 'error';
  createdAt: string;
  replies: GroupReply[];
}

export interface GroupReply {
  id: number;
  replyText: string;
  authorName: string;
  createdAt: string;
}

export interface SchemaGroupDetail extends SchemaGroup {
  tags?: string[];
  schemas: (SchemaInGroup & {
    content: string;
    dependencies: SchemaDependency[];
    dependedBy: SchemaReference[];
  })[];
  comments: GroupComment[];
}

// Upload Types
export interface FileUpload {
  filename: string;
  content: string;
  isMaster: boolean;
}

export interface CreateSchemaGroupRequest {
  name: string;
  version: string;
  description?: string;
  files: FileUpload[];
}
