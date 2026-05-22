'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, FileText, Eye, EyeOff, Trash2, ChevronLeft } from 'lucide-react';
import { blogApi, BlogArticle } from '@/lib/api/blog';
import { clientsApi, Client } from '@/lib/api/clients';
import { Tooltip } from '@/components/ui/tooltip';

const STATUS_LABEL = {
  DRAFT:     { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
  PUBLISHED: { label: 'Publicado', color: 'bg-green-100 text-green-700' },
};

export default function ArticlesListPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      clientsApi.get(clientId).then((r) => setClient(r.data)),
      blogApi.listArticles(clientId).then(setArticles),
    ]).finally(() => setLoading(false));
  }, [clientId]);

  async function handleDelete(article: BlogArticle) {
    if (!confirm(`Excluir "${article.title}"?`)) return;
    await blogApi.deleteArticle(clientId, article.id);
    setArticles((prev) => prev.filter((a) => a.id !== article.id));
  }

  async function handleToggleStatus(article: BlogArticle) {
    const newStatus = article.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const updated = await blogApi.updateArticle(clientId, article.id, { status: newStatus });
    setArticles((prev) => prev.map((a) => (a.id === article.id ? updated : a)));
  }

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de blogs" position="right">
          <Link href="/blog" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{client?.company_name ?? '...'}</h1>
          <div className="flex gap-3 mt-0.5">
            <Link href={`/blog/${clientId}/artigos`} className="text-sm text-blue-600 font-medium">Artigos</Link>
            <Link href={`/blog/${clientId}/autores`} className="text-sm text-gray-400 hover:text-gray-700">Autores</Link>
            <Link href={`/blog/${clientId}/categorias`} className="text-sm text-gray-400 hover:text-gray-700">Categorias</Link>
          </div>
        </div>
        <Tooltip text="Criar um novo artigo para este cliente">
          <Link
            href={`/blog/${clientId}/artigos/novo`}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={15} /> Novo artigo
          </Link>
        </Tooltip>
      </div>

      {articles.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          Nenhum artigo ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => {
            const st = STATUS_LABEL[a.status];
            return (
              <div key={a.id} className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    <Link
                      href={`/blog/${clientId}/artigos/${a.id}`}
                      className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate transition-colors"
                    >
                      {a.title}
                    </Link>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.category?.name && <span className="mr-2">{a.category.name}</span>}
                    {a.author?.name && <span>por {a.author.name}</span>}
                    {' · '}
                    <span className="font-mono">/{a.slug}</span>
                  </p>
                </div>

                <Tooltip text={a.status === 'PUBLISHED' ? 'Voltar para rascunho' : 'Publicar artigo'}>
                  <button
                    onClick={() => handleToggleStatus(a)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    {a.status === 'PUBLISHED' ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </Tooltip>

                <Tooltip text="Editar artigo">
                  <Link
                    href={`/blog/${clientId}/artigos/${a.id}`}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <FileText size={15} />
                  </Link>
                </Tooltip>

                <Tooltip text="Excluir artigo">
                  <button
                    onClick={() => handleDelete(a)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
