'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Plus, Trash2, UserCircle } from 'lucide-react';
import { blogApi, BlogAuthor } from '@/lib/api/blog';
import { clientsApi } from '@/lib/api/clients';
import { Tooltip } from '@/components/ui/tooltip';

export default function AuthorsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    blogApi.listAuthors(clientId).then(setAuthors);
    clientsApi.get(clientId).then((r) => setClientName(r.data.company_name));
  }, [clientId]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    const author = await blogApi.createAuthor(
      clientId,
      name.trim(),
      bio.trim() || undefined,
      avatarUrl.trim() || undefined,
      profileUrl.trim() || undefined,
    );
    setAuthors((prev) => [...prev, author]);
    setName(''); setBio(''); setAvatarUrl(''); setProfileUrl('');
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir autor?')) return;
    await blogApi.deleteAuthor(id);
    setAuthors((prev) => prev.filter((a) => a.id !== id));
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
          <h1 className="text-xl font-bold text-gray-900">Autores — {clientName}</h1>
          <div className="flex gap-3 mt-0.5">
            <Link href={`/blog/${clientId}/artigos`} className="text-sm text-gray-400 hover:text-gray-700">Artigos</Link>
            <Link href={`/blog/${clientId}/autores`} className="text-sm text-blue-600 font-medium">Autores</Link>
            <Link href={`/blog/${clientId}/categorias`} className="text-sm text-gray-400 hover:text-gray-700">Categorias</Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Novo autor</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome *"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Bio (opcional) — aparece na seção 'Sobre o autor' no blog"
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="URL da foto (opcional) — ex: https://exemplo.com/foto.jpg"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="URL do perfil (opcional) — ex: https://exemplo.com/sobre/joao"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={15} /> Criar autor
        </button>
      </div>

      <div className="space-y-2">
        {authors.map((a) => (
          <div key={a.id} className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl">
            {a.avatar_url ? (
              <img
                src={a.avatar_url}
                alt={a.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <UserCircle size={22} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{a.name}</p>
              {a.bio && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{a.bio}</p>}
              {a.profile_url && (
                <a
                  href={a.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline mt-0.5 inline-block"
                >
                  Ver perfil
                </a>
              )}
            </div>
            <Tooltip text="Excluir autor">
              <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                <Trash2 size={15} />
              </button>
            </Tooltip>
          </div>
        ))}
        {authors.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum autor cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
