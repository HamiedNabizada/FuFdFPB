import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, MessageCircle, ChevronRight, FolderOpen, Files, Calendar, User } from 'lucide-react';
import type { User as UserType } from '../App';
import type { SchemaGroup } from '../types/schemaGroup';
import SchemaGroupUpload from '../components/SchemaGroupUpload';
import { TagBadges } from '../components/TagEditor';
import ReviewStats from '../components/ReviewStats';
import RecentActivity from '../components/RecentActivity';

interface SchemaVersion {
  id: number;
  version: string;
  commentCount: number;
  uploadedBy: string;
  createdAt: string;
}

interface HomePageProps {
  user: UserType | null;
}

type UploadMode = 'none' | 'single' | 'group';

export default function HomePage({ user }: HomePageProps) {
  const [schemas, setSchemas] = useState<Record<string, SchemaVersion[]>>({});
  const [groups, setGroups] = useState<SchemaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ name: '', version: '', content: '' });
  const [uploadMode, setUploadMode] = useState<UploadMode>('none');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [schemasRes, groupsRes] = await Promise.all([
        fetch('/api/schemas'),
        fetch('/api/schema-groups')
      ]);

      const schemasData = await schemasRes.json();
      const groupsData = await groupsRes.json();

      setSchemas(schemasData.schemas || {});
      setGroups(groupsData.groups || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const fileName = file.name.replace('.xsd', '');
      setUploadForm((prev) => ({
        ...prev,
        name: prev.name || fileName,
        content,
      }));
    };
    reader.readAsText(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.name || !uploadForm.version || !uploadForm.content) return;

    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/schemas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(uploadForm),
      });

      if (res.ok) {
        setUploadForm({ name: '', version: '', content: '' });
        setUploadMode('none');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Upload fehlgeschlagen');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const handleGroupUploadSuccess = () => {
    setUploadMode('none');
    fetchData();
  };

  const standaloneSchemas = Object.entries(schemas);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">XML Schema Bibliothek</h1>
          <p className="text-primary-500 mt-1">
            Schemas zur Diskussion und Abstimmung im Fachausschuss
          </p>
        </div>
        {user && uploadMode === 'none' && (
          <div className="flex gap-2">
            <button
              onClick={() => setUploadMode('group')}
              className="btn-primary"
            >
              <Files className="w-4 h-4" />
              Schema-Gruppe
            </button>
            <button
              onClick={() => setUploadMode('single')}
              className="btn-secondary"
            >
              <Upload className="w-4 h-4" />
              Einzelschema
            </button>
          </div>
        )}
      </div>

      {/* Review Stats */}
      <ReviewStats />

      {/* Recent Activity */}
      <div className="mb-8">
        <RecentActivity />
      </div>

      {/* Group Upload */}
      {uploadMode === 'group' && (
        <div className="mb-8">
          <SchemaGroupUpload
            onSuccess={handleGroupUploadSuccess}
            onCancel={() => setUploadMode('none')}
          />
        </div>
      )}

      {/* Single File Upload Form */}
      {uploadMode === 'single' && (
        <form onSubmit={handleUpload} className="card p-6 mb-8">
          <h2 className="text-lg font-semibold text-primary-900 mb-4">Einzelnes Schema hochladen</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">
                Schema-Name
              </label>
              <input
                type="text"
                placeholder="z.B. FPD_Schema"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1.5">
                Version
              </label>
              <input
                type="text"
                placeholder="z.B. 1.0"
                value={uploadForm.version}
                onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-primary-700 mb-1.5">
              XSD-Datei
            </label>
            <input
              type="file"
              accept=".xsd,.xml"
              onChange={handleFileSelect}
              className="input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                       file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700
                       hover:file:bg-primary-100"
            />
          </div>

          {uploadForm.content && (
            <div className="text-sm text-accent-600 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Datei geladen ({Math.round(uploadForm.content.length / 1024)} KB)
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading || !uploadForm.name || !uploadForm.version || !uploadForm.content}
              className="btn-primary"
            >
              {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('none')}
              className="btn-ghost"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Schema Groups */}
      {groups.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-primary-900">Schema-Gruppen</h2>
            <span className="badge-neutral">{groups.length}</span>
          </div>

          <div className="space-y-3">
            {groups.map((group) => (
              <Link
                key={group.id}
                to={`/group/${group.id}`}
                className="card-hover block"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-primary-900">{group.name}</h3>
                        <span className="badge-primary">v{group.version}</span>
                        <TagBadges tags={group.tags} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-primary-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {group.schemas.length} Dateien
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {group.uploadedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(group.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {(group.commentCount > 0 || group.schemas.some(s => s.commentCount > 0)) && (
                        <span className="flex items-center gap-1.5 text-sm text-primary-500">
                          <MessageCircle className="w-4 h-4" />
                          {group.commentCount + group.schemas.reduce((sum, s) => sum + s.commentCount, 0)}
                        </span>
                      )}
                      <ChevronRight className="w-5 h-5 text-primary-300" />
                    </div>
                  </div>

                  {/* Schema badges */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {group.schemas.map((schema) => (
                      <span
                        key={schema.id}
                        className={`text-xs px-2 py-0.5 rounded ${
                          schema.role === 'master'
                            ? 'bg-primary-100 text-primary-700 font-medium'
                            : schema.role === 'imported'
                            ? 'bg-accent-50 text-accent-700'
                            : schema.role === 'included'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {schema.filename}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Individual Schemas */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-primary-900">Einzelne Schemas</h2>
          <span className="badge-neutral">{standaloneSchemas.length}</span>
        </div>

        {standaloneSchemas.length === 0 ? (
          <div className="card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-primary-200" />
            <h3 className="text-lg font-medium text-primary-900 mb-2">Keine Schemas vorhanden</h3>
            <p className="text-primary-500">
              {user
                ? 'Laden Sie ein Schema hoch, um mit der Diskussion zu beginnen.'
                : 'Melden Sie sich an, um Schemas hochzuladen.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {standaloneSchemas.map(([name, versions]) => (
              <div key={name} className="card overflow-hidden">
                <div className="px-4 py-3 bg-primary-50 border-b border-primary-100">
                  <h3 className="font-semibold text-primary-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary-600" />
                    {name}
                  </h3>
                </div>
                <div className="divide-y divide-primary-50">
                  {versions.map((version) => (
                    <Link
                      key={version.id}
                      to={`/schema/${version.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-primary-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="badge-primary">v{version.version}</span>
                        <span className="text-sm text-primary-500 flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {version.uploadedBy}
                        </span>
                        <span className="text-sm text-primary-400">
                          {new Date(version.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {version.commentCount > 0 && (
                          <span className="flex items-center gap-1.5 text-sm text-primary-500">
                            <MessageCircle className="w-4 h-4" />
                            {version.commentCount}
                          </span>
                        )}
                        <ChevronRight className="w-5 h-5 text-primary-300" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
