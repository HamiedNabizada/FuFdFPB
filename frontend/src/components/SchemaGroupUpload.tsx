import { useState, useCallback } from 'react';
import { Upload, X, FileCode, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { FileUpload, CreateSchemaGroupRequest } from '../types/schemaGroup';

interface UploadedFile extends FileUpload {
  size: number;
  dependencies: string[];
}

interface SchemaGroupUploadProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Extrahiert Abhängigkeiten aus XSD-Content
function extractDependencies(content: string): string[] {
  const deps: string[] = [];

  // Regex für xs:import und xs:include
  const importRegex = /<(?:xs|xsd):(?:import|include)\s+[^>]*schemaLocation\s*=\s*["']([^"']+)["']/gi;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const schemaLocation = match[1];
    // Extrahiere Dateinamen
    const filename = schemaLocation.split('/').pop() || schemaLocation;
    deps.push(filename);
  }

  return deps;
}

// Bestimmt die Rolle einer Datei
function determineRole(file: UploadedFile, allFiles: UploadedFile[]): 'master' | 'imported' | 'included' | 'standalone' {
  const isReferenced = allFiles.some(f =>
    f.filename !== file.filename && f.dependencies.includes(file.filename)
  );
  const hasReferences = file.dependencies.length > 0;

  if (hasReferences && !isReferenced) return 'master';
  if (isReferenced) return 'imported';
  if (allFiles.length === 1) return 'standalone';
  return 'standalone';
}

export default function SchemaGroupUpload({ onSuccess, onCancel }: SchemaGroupUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [version, setVersion] = useState('1.0');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.xsd') && !file.name.toLowerCase().endsWith('.xml')) {
        continue;
      }

      const content = await file.text();
      const dependencies = extractDependencies(content);

      newFiles.push({
        filename: file.name,
        content,
        size: file.size,
        isMaster: false,
        dependencies
      });
    }

    if (newFiles.length > 0) {
      setFiles(prev => {
        const updated = [...prev, ...newFiles];
        // Auto-detect master
        const withRoles = updated.map(f => ({
          ...f,
          isMaster: determineRole(f, updated) === 'master'
        }));
        return withRoles;
      });

      // Auto-fill group name from first file if empty
      if (!groupName && newFiles.length > 0) {
        const firstName = newFiles[0].filename.replace(/\.xsd$/i, '');
        setGroupName(firstName);
      }
    }
  }, [groupName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const removeFile = (filename: string) => {
    setFiles(prev => prev.filter(f => f.filename !== filename));
  };

  const toggleMaster = (filename: string) => {
    setFiles(prev => prev.map(f => ({
      ...f,
      isMaster: f.filename === filename ? !f.isMaster : false
    })));
  };

  const handleSubmit = async () => {
    if (!groupName || !version || files.length === 0) {
      setError('Name, Version und mindestens eine Datei erforderlich');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const payload: CreateSchemaGroupRequest = {
        name: groupName,
        version,
        description: description || undefined,
        files: files.map(f => ({
          filename: f.filename,
          content: f.content,
          isMaster: f.isMaster
        }))
      };

      const response = await fetch('/api/schema-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload fehlgeschlagen');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getRoleLabel = (file: UploadedFile) => {
    if (file.isMaster) return 'Master';
    const role = determineRole(file, files);
    switch (role) {
      case 'master': return 'Master';
      case 'imported': return 'Import';
      case 'included': return 'Include';
      default: return '';
    }
  };

  const getRoleBadgeColor = (file: UploadedFile) => {
    if (file.isMaster) return 'bg-blue-100 text-blue-800';
    const role = determineRole(file, files);
    switch (role) {
      case 'master': return 'bg-blue-100 text-blue-800';
      case 'imported': return 'bg-green-100 text-green-800';
      case 'included': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Schema-Gruppe hochladen</h2>
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center mb-4 transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="mx-auto mb-2 text-gray-400" size={40} />
        <p className="text-gray-600 mb-2">XSD-Dateien hierher ziehen</p>
        <p className="text-gray-400 text-sm mb-4">oder</p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept=".xsd,.xml"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />
          <span className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            Dateien auswählen
          </span>
        </label>
      </div>

      {/* Dateiliste */}
      {files.length > 0 && (
        <div className="mb-4">
          <h3 className="font-medium mb-2">Ausgewählte Dateien ({files.length})</h3>
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.filename} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <FileCode className="text-blue-600" size={20} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{file.filename}</span>
                    {getRoleLabel(file) && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(file)}`}>
                        {getRoleLabel(file)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                    {file.dependencies.length > 0 && (
                      <span className="ml-2">
                        → {file.dependencies.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleMaster(file.filename)}
                  className={`text-xs px-2 py-1 rounded ${
                    file.isMaster
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title="Als Master markieren"
                >
                  Master
                </button>
                <button
                  onClick={() => removeFile(file.filename)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formularfelder */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gruppenname *
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="z.B. FPD_Complete_Schema"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Version *
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="z.B. 1.0"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Beschreibung (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Beschreibung der Schema-Gruppe..."
          rows={2}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Aktionen */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSubmit}
          disabled={uploading || files.length === 0 || !groupName || !version}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Hochladen...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              Gruppe erstellen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
