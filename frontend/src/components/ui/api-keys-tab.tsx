'use client';

import { useEffect, useState } from 'react';
import { Copy, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiKeysApi, ApiKey } from '@/lib/api/api-keys';
import { Tooltip } from '@/components/ui/tooltip';

export function ApiKeysTab({ clientId }: { clientId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    apiKeysApi.list(clientId).then(setKeys).finally(() => setLoading(false));
  }, [clientId]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const k = await apiKeysApi.create(clientId, newName.trim());
      setKeys((prev) => [k, ...prev]);
      setNewName('');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(key: ApiKey) {
    const updated = await apiKeysApi.update(key.id, { is_active: !key.is_active });
    setKeys((prev) => prev.map((k) => (k.id === key.id ? updated : k)));
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta API Key?')) return;
    await apiKeysApi.delete(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Create new */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="Nome da chave (ex: Site Principal)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Gerar
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Nenhuma API Key cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`flex items-center gap-3 p-4 rounded-xl border ${k.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{k.name}</p>
                <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{k.key}</p>
              </div>

              <Tooltip text="Copiar chave">
                <button
                  onClick={() => handleCopy(k.key)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  {copied === k.key ? (
                    <span className="text-xs text-green-600 font-medium">Copiado!</span>
                  ) : (
                    <Copy size={15} />
                  )}
                </button>
              </Tooltip>

              <Tooltip text={k.is_active ? 'Desativar chave' : 'Ativar chave'}>
                <button
                  onClick={() => handleToggle(k)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  {k.is_active ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
                </button>
              </Tooltip>

              <Tooltip text="Excluir API Key">
                <button
                  onClick={() => handleDelete(k.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Use a chave na URL pública do site: <code className="bg-gray-100 px-1 rounded">?apiKey=...</code>
      </p>
    </div>
  );
}
