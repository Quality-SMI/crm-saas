'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ArticleForm } from '@/components/ui/article-form';
import { blogApi, CreateArticleBody } from '@/lib/api/blog';
import { Tooltip } from '@/components/ui/tooltip';

export default function NewArticlePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(body: CreateArticleBody) {
    setIsLoading(true);
    setError('');
    try {
      const article = await blogApi.createArticle(clientId, body);
      router.push(`/blog/${clientId}/artigos/${article.id}`);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(raw) ? raw.join(' • ') : (raw ?? 'Erro ao criar artigo.'));
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de artigos" position="right">
          <Link href={`/blog/${clientId}/artigos`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Novo artigo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Preencha os dados e escreva o conteúdo</p>
        </div>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      <ArticleForm clientId={clientId} onSave={handleSave} isLoading={isLoading} />
    </div>
  );
}
