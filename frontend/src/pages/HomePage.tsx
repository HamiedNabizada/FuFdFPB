import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileCode, MessageCircle, ChevronRight, FolderOpen, Files } from 'lucide-react';
import type { User } from '../App';
import type { SchemaGroup } from '../types/schemaGroup';
import SchemaGroupUpload from '../components/SchemaGroupUpload';

interface SchemaVersion {
  id: number;
  version: string;
  commentCount: number;
  uploadedBy: string;
  createdAt: string;
}

interface HomePageProps {
  user: User | null;
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

  // Filtere Einzelschemas (ohne Gruppenzugehörigkeit)
  const standaloneSchemas = Object.entries(schemas);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-gray-500">Laden...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">XML Schemas</h1>
          <p className="text-gray-600 mt-1">
            Schemas zur Diskussion im Fachausschuss
          </p>
        </div>
        {user && uploadMode === 'none' && (
          <div className="flex gap-2">
            <button
              onClick={() => setUploadMode('group')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Files className="w-4 h-4" />
              Schema-Gruppe
            </button>
            <button
              onClick={() => setUploadMode('single')}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              <Upload className="w-4 h-4" />
              Einzelnes Schema
            </button>
          </div>
        )}
      </div>

      {/* Group Upload */}
      {uploadMode === 'group' && (
        <SchemaGroupUpload
          onSuccess={handleGroupUploadSuccess}
          onCancel={() => setUploadMode('none')}
        />
      )}

      {/* Single File Upload Form */}
      {uploadMode === 'single' && (
        <form onSubmit={handleUpload} className="bg-white border rounded-lg p-6 mb-8 space-y-4">
          <h2 className="font-semibold text-gray-900">Einzelnes Schema hochladen</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Schema-Name
              </label>
              <input
                type="text"
                placeholder="z.B. FPD_Schema"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version
              </label>
              <input
                type="text"
                placeholder="z.B. 1.0"
                value={uploadForm.version}
                onChange={(e) => setUploadForm({ ...uploadForm, version: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              XSD-Datei
            </label>
            <input
              type="file"
              accept=".xsd,.xml"
              onChange={handleFileSelect}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          {uploadForm.content && (
            <div className="text-sm text-green-600">
              Datei geladen ({Math.round(uploadForm.content.length / 1024)} KB)
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={uploading || !uploadForm.name || !uploadForm.version || !uploadForm.content}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Wird hochgeladen...' : 'Hochladen'}
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('none')}
              className="text-gray-600 px-4 py-2 hover:text-gray-800"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Schema Groups */}
      {groups.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            Schema-Gruppen
          </h2>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="bg-white border rounded-lg overflow-hidden">
                <Link
                  to={`/group/${group.id}`}
                  className="block px-4 py-3 bg-gray-50 border-b hover:bg-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-blue-600" />
                        {group.name}
                        <span className="text-sm font-mono bg-gray-200 px-2 py-0.5 rounded">
                          v{group.version}
                        </span>
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {group.schemas.length} Dateien · von {group.uploadedBy} · {new Date(group.createdAt).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {(group.commentCount > 0 || group.schemas.some(s => s.commentCount > 0)) && (
                        <span className="flex items-center gap-1 text-sm text-gray-600">
                          <MessageCircle className="w-4 h-4" />
                          {group.commentCount + group.schemas.reduce((sum, s) => sum + s.commentCount, 0)}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </Link>
                <div className="px-4 py-2 flex flex-wrap gap-2">
                  {group.schemas.map((schema) => (
                    <span
                      key={schema.id}
                      className={`text-xs px-2 py-1 rounded-full ${
                        schema.role === 'master'
                          ? 'bg-blue-100 text-blue-700'
                          : schema.role === 'imported'
                          ? 'bg-green-100 text-green-700'
                          : schema.role === 'included'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {schema.filename}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Schemas */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileCode className="w-5 h-5 text-blue-600" />
          Einzelne Schemas
        </h2>

        {standaloneSchemas.length === 0 ? (
          <div className="text-center py-12 bg-white border rounded-lg">
            <FileCode className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Keine einzelnen Schemas vorhanden</h3>
            <p className="text-gray-600">
              {user
                ? 'Laden Sie ein Schema hoch, um mit der Diskussion zu beginnen.'
                : 'Melden Sie sich an, um Schemas hochzuladen.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {standaloneSchemas.map(([name, versions]) => (
              <div key={name} className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-blue-600" />
                    {name}
                  </h3>
                </div>
                <div className="divide-y">
                  {versions.map((version) => (
                    <Link
                      key={version.id}
                      to={`/schema/${version.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                          v{version.version}
                        </span>
                        <span className="text-sm text-gray-600">
                          von {version.uploadedBy}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(version.createdAt).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {version.commentCount > 0 && (
                          <span className="flex items-center gap-1 text-sm text-gray-600">
                            <MessageCircle className="w-4 h-4" />
                            {version.commentCount}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
