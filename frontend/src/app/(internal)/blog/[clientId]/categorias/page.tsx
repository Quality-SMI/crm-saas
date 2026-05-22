'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, Zap } from 'lucide-react';
import { blogApi, BlogCategory, BlogTag } from '@/lib/api/blog';
import { clientsApi } from '@/lib/api/clients';
import { Tooltip } from '@/components/ui/tooltip';

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

export default function CategoriesPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);
  const [clientName, setClientName] = useState('');

  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    blogApi.listCategories(clientId).then(setCategories);
    blogApi.listTags(clientId).then(setTags);
    clientsApi.get(clientId).then((r) => setClientName(r.data.company_name));
  }, [clientId]);

  async function handleCreateCat() {
    if (!catName.trim() || !catSlug.trim()) return;
    setSaving(true);
    const cat = await blogApi.createCategory(clientId, catName.trim(), catSlug.trim());
    setCategories((prev) => [...prev, cat]);
    setCatName(''); setCatSlug('');
    setSaving(false);
  }

  async function handleCreateTag() {
    if (!tagName.trim() || !tagSlug.trim()) return;
    setSaving(true);
    const tag = await blogApi.createTag(clientId, tagName.trim(), tagSlug.trim());
    setTags((prev) => [...prev, tag]);
    setTagName(''); setTagSlug('');
    setSaving(false);
  }

  async function deleteCategory(id: string) {
    if (!confirm('Excluir categoria?')) return;
    await blogApi.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function deleteTag(id: string) {
    if (!confirm('Excluir tag?')) return;
    await blogApi.deleteTag(id);
    setTags((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de artigos" position="right">
          <Link href={`/blog/${clientId}/artigos`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Taxonomias — {clientName}</h1>
          <div className="flex gap-3 mt-0.5">
            <Link href={`/blog/${clientId}/artigos`} className="text-sm text-gray-400 hover:text-gray-700">Artigos</Link>
            <Link href={`/blog/${clientId}/autores`} className="text-sm text-gray-400 hover:text-gray-700">Autores</Link>
            <Link href={`/blog/${clientId}/categorias`} className="text-sm text-blue-600 font-medium">Categorias</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Categories */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Categorias</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <input value={catName} onChange={(e) => { setCatName(e.target.value); setCatSlug(slugify(e.target.value)); }} placeholder="Nome" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder="slug" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Tooltip text="Gerar slug automaticamente">
                <button type="button" onClick={() => setCatSlug(slugify(catName))} className="px-2 text-gray-400 hover:text-blue-600 border border-gray-200 rounded-lg"><Zap size={14} /></button>
              </Tooltip>
            </div>
            <button onClick={handleCreateCat} disabled={saving || !catName.trim()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
              <Plus size={13} /> Criar
            </button>
          </div>
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl">
              <div className="flex-1"><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-gray-400 font-mono">{c.slug}</p></div>
              <Tooltip text="Excluir categoria">
                <button onClick={() => deleteCategory(c.id)} className="p-1 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={13} /></button>
              </Tooltip>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Tags</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <input value={tagName} onChange={(e) => { setTagName(e.target.value); setTagSlug(slugify(e.target.value)); }} placeholder="Nome" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <input value={tagSlug} onChange={(e) => setTagSlug(e.target.value)} placeholder="slug" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <Tooltip text="Gerar slug automaticamente">
                <button type="button" onClick={() => setTagSlug(slugify(tagName))} className="px-2 text-gray-400 hover:text-blue-600 border border-gray-200 rounded-lg"><Zap size={14} /></button>
              </Tooltip>
            </div>
            <button onClick={handleCreateTag} disabled={saving || !tagName.trim()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
              <Plus size={13} /> Criar
            </button>
          </div>
          {tags.map((t) => (
            <div key={t.id} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl">
              <div className="flex-1"><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-gray-400 font-mono">{t.slug}</p></div>
              <Tooltip text="Excluir tag">
                <button onClick={() => deleteTag(t.id)} className="p-1 text-gray-400 hover:text-red-600 rounded-lg"><Trash2 size={13} /></button>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
