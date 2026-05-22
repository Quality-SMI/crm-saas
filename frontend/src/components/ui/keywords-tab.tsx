'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Tag, X, Check, Pencil } from 'lucide-react';
import { keywordsApi, ClientKeyword, KeywordCategory } from '@/lib/api/keywords';
import { Tooltip } from './tooltip';

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-')
    .replace(/^-+|-+$/, '').slice(0, 60);
}

export function KeywordsTab({ clientId }: { clientId: string }) {
  const [keywords, setKeywords] = useState<ClientKeyword[]>([]);
  const [categories, setCategories] = useState<KeywordCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'single' | 'bulk'>('single');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [newCat, setNewCat] = useState('');
  const [showCatForm, setShowCatForm] = useState(false);

  const [form, setForm] = useState({ keyword: '', slug: '', category_id: '' });
  const [bulk, setBulk] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      keywordsApi.list(clientId),
      keywordsApi.listCategories(clientId),
    ]).then(([kw, cats]) => {
      if (kw.status === 'fulfilled') setKeywords(kw.value);
      if (cats.status === 'fulfilled') setCategories(cats.value);
    }).finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.keyword.trim()) return;
    setSubmitting(true);
    try {
      await keywordsApi.create(clientId, {
        keyword: form.keyword.trim(),
        slug: form.slug || slugify(form.keyword),
        category_id: form.category_id || undefined,
      });
      setForm({ keyword: '', slug: '', category_id: '' });
      setShowForm(false);
      load();
    } catch { /* swallow */ } finally { setSubmitting(false); }
  };

  const handleBulk = async () => {
    const kws = bulk.split(',').map((k) => k.trim()).filter(Boolean);
    if (!kws.length) return;
    setSubmitting(true);
    try {
      await keywordsApi.bulkCreate(clientId, { keywords: kws, category_id: form.category_id || undefined });
      setBulk('');
      setShowForm(false);
      load();
    } catch { /* swallow */ } finally { setSubmitting(false); }
  };

  const handleEdit = async (id: string) => {
    if (!editValue.trim()) return;
    await keywordsApi.update(id, { keyword: editValue.trim(), slug: slugify(editValue) });
    setEditingId(null);
    load();
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remover esta palavra-chave?')) return;
    await keywordsApi.remove(id);
    load();
  };

  const handleCreateCat = async () => {
    if (!newCat.trim()) return;
    await keywordsApi.createCategory(clientId, { name: newCat.trim() });
    setNewCat('');
    setShowCatForm(false);
    load();
  };

  const filtered = keywords.filter((k) => {
    const matchSearch = !search || k.keyword.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || k.category_id === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar palavra-chave..."
            className="w-full max-w-xs text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {categories.length > 0 && (
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}

        <Tooltip text="Gerenciar categorias">
          <button
            onClick={() => setShowCatForm((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Tag size={13} /> Categorias
          </button>
        </Tooltip>

        <button
          onClick={() => { setShowForm(true); setFormMode('single'); }}
          className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> Nova palavra-chave
        </button>
      </div>

      {/* Categories management */}
      {showCatForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Categorias</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 px-2.5 py-1 rounded-full text-gray-700">
                {c.name}
                <button onClick={() => keywordsApi.removeCategory(c.id).then(load)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCat()}
              placeholder="Nome da categoria..."
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={handleCreateCat} disabled={!newCat.trim()}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-800">Nova palavra-chave</p>
            <button onClick={() => setShowForm(false)}><X size={14} className="text-gray-400" /></button>
          </div>

          <div className="flex gap-2">
            {(['single', 'bulk'] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => setFormMode(m)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${formMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                {m === 'single' ? 'Cadastro único' : 'Cadastro em massa'}
              </button>
            ))}
          </div>

          {formMode === 'single' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Palavra-chave *</label>
                <input value={form.keyword}
                  onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value, slug: slugify(e.target.value) }))}
                  placeholder="ex: agência de SEO em SP"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Slug</label>
                <input value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="agencia-de-seo-em-sp"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sem categoria</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Palavras-chave separadas por vírgula *
              </label>
              <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)}
                placeholder="SEO em São Paulo, marketing digital, tráfego pago..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">
                {bulk ? bulk.split(',').filter((k) => k.trim()).length : 0} palavra(s)
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg">Cancelar</button>
            <button
              onClick={formMode === 'single' ? handleCreate : handleBulk}
              disabled={submitting || (formMode === 'single' ? !form.keyword.trim() : !bulk.trim())}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {submitting ? 'Salvando...' : 'Cadastrar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Tag size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{keywords.length === 0 ? 'Nenhuma palavra-chave cadastrada' : 'Nenhum resultado para o filtro'}</p>
          <p className="text-xs mt-1">{keywords.length === 0 && 'Adicione as palavras-chave que o cliente contratou'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 bg-gray-50">
            <span className="text-xs text-gray-500">{filtered.length} palavra(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Palavra-chave</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Slug</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Categoria</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Data</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((kw) => (
                  <tr key={kw.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      {editingId === kw.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(kw.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="text-sm border border-blue-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => handleEdit(kw.id)} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                        </div>
                      ) : (
                        <span className="text-gray-800 font-medium">{kw.keyword}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{kw.slug ?? '—'}</td>
                    <td className="px-4 py-3">
                      {kw.category
                        ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{kw.category.name}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(kw.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Tooltip text="Editar nome">
                          <button onClick={() => { setEditingId(kw.id); setEditValue(kw.keyword); }}
                            className="text-gray-300 hover:text-blue-500 transition-colors">
                            <Pencil size={13} />
                          </button>
                        </Tooltip>
                        <Tooltip text="Remover palavra-chave">
                          <button onClick={() => handleRemove(kw.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
