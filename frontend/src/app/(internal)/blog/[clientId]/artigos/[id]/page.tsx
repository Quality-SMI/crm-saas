'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { ArticleForm } from '@/components/ui/article-form';
import { blogApi, BlogArticle, CreateArticleBody } from '@/lib/api/blog';
import { Tooltip } from '@/components/ui/tooltip';

export default function EditArticlePage() {
  const { clientId, id } = useParams<{ clientId: string; id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    blogApi.getArticle(clientId, id).then(setArticle).finally(() => setLoading(false));
  }, [clientId, id]);

  async function handleSave(body: CreateArticleBody) {
    setIsLoading(true);
    setError('');
    try {
      const updated = await blogApi.updateArticle(clientId, id, body);
      setArticle(updated);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(' • ') : (raw ?? 'Erro ao salvar.'));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${article?.title}"? Esta ação não pode ser desfeita.`)) return;
    await blogApi.deleteArticle(clientId, id);
    router.push(`/blog/${clientId}/artigos`);
  }

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Carregando...</div>;
  if (!article) return <div className="text-sm text-gray-500 py-16 text-center">Artigo não encontrado.</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de artigos" position="right">
          <Link href={`/blog/${clientId}/artigos`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 truncate">{article.title}</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">/{article.slug}</p>
        </div>
        <Tooltip text="Excluir este artigo permanentemente">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
          >
            <Trash2 size={15} /> Excluir
          </button>
        </Tooltip>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      <ArticleForm clientId={clientId} article={article} onSave={handleSave} isLoading={isLoading} />
    </div>
  );
}
