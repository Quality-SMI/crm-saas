'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { RichTextEditor } from './rich-text-editor';
import { blogApi, BlogArticle, BlogAuthor, BlogCategory, BlogTag, CreateArticleBody } from '@/lib/api/blog';
import { Tooltip } from '@/components/ui/tooltip';

interface Props {
  clientId: string;
  article?: BlogArticle;
  onSave: (body: CreateArticleBody) => Promise<void>;
  isLoading: boolean;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function ArticleForm({ clientId, article, onSave, isLoading }: Props) {
  const [title, setTitle] = useState(article?.title ?? '');
  const [slug, setSlug] = useState(article?.slug ?? '');
  const [description, setDescription] = useState(article?.description ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>(article?.status ?? 'DRAFT');
  const [authorId, setAuthorId] = useState(article?.author?.id ?? '');
  const [categoryId, setCategoryId] = useState(article?.category?.id ?? '');
  const [tagIds, setTagIds] = useState<string[]>(article?.tags?.map((t) => t.id) ?? []);
  const [html, setHtml] = useState(article?.content ?? '');
  const [rawContent, setRawContent] = useState<Record<string, unknown> | null>(article?.raw_content ?? null);
  const [error, setError] = useState('');

  const [authors, setAuthors] = useState<BlogAuthor[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [tags, setTags] = useState<BlogTag[]>([]);

  const [titleLen, setTitleLen] = useState(title.length);
  const [descLen, setDescLen] = useState(description.length);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    blogApi.listAuthors(clientId).then(setAuthors).catch(() => {});
    blogApi.listCategories(clientId).then(setCategories).catch(() => {});
    blogApi.listTags(clientId).then(setTags).catch(() => {});
  }, [clientId]);

  function handleTitleChange(v: string) {
    setTitle(v);
    setTitleLen(v.length);
    if (!article) setSlug(slugify(v));
  }

  function handleDescChange(v: string) {
    setDescription(v);
    setDescLen(v.length);
  }

  function toggleTag(id: string) {
    setTagIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Título é obrigatório'); return; }
    if (!slug.trim()) { setError('Slug é obrigatório'); return; }
    setError('');
    await onSave({
      title: title.trim(),
      slug: slug.trim(),
      description: description || undefined,
      content: html || undefined,
      raw_content: rawContent ?? undefined,
      status,
      author_id: authorId || undefined,
      category_id: categoryId || undefined,
      tag_ids: tagIds.length ? tagIds : undefined,
    });
  }

  const titleStatus = titleLen === 0 ? '' : titleLen <= 60 ? '✓ Bom' : '⚠ Longo';
  const descStatus = descLen === 0 ? '' : descLen <= 160 ? '✓ Bom' : '⚠ Longo';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* Title + Slug */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Título</label>
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Para a meta tag title"
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {titleLen > 0 && (
            <p className="text-xs text-gray-400 mt-1">{titleLen}/60 — <strong>{titleStatus}</strong></p>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Slug</label>
          <div className="flex gap-2 mt-1">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="url-do-artigo"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <Tooltip text="Gerar slug automaticamente a partir do título">
              <button type="button" onClick={() => setSlug(slugify(title))} className="px-3 py-2 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors">
                <Zap size={15} />
              </button>
            </Tooltip>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Descrição</label>
          <input
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder="Para a meta tag description"
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {descLen > 0 && (
            <p className="text-xs text-gray-400 mt-1">{descLen}/160 — <strong>{descStatus}</strong></p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Autor</label>
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sem autor</option>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="DRAFT">Rascunho</option>
            <option value="PUBLISHED">Publicado</option>
          </select>
        </div>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tags</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  tagIds.includes(t.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content editor */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Conteúdo</label>
          <Tooltip text={showContent ? 'Ocultar editor de conteúdo' : 'Expandir editor de conteúdo'}>
            <button
              type="button"
              onClick={() => setShowContent((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              {showContent ? <><EyeOff size={13} /> Ocultar</> : <><Eye size={13} /> Expandir</>}
            </button>
          </Tooltip>
        </div>
        {showContent && (
          <RichTextEditor
            content={rawContent ?? undefined}
            onChange={(h, j) => { setHtml(h); setRawContent(j); }}
          />
        )}
        {!showContent && (
          <button
            type="button"
            onClick={() => setShowContent(true)}
            className="w-full py-8 text-sm text-gray-400 hover:text-gray-600 border-2 border-dashed border-gray-200 rounded-lg transition-colors"
          >
            Clique para abrir o editor
          </button>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isLoading ? 'Salvando...' : status === 'PUBLISHED' ? 'Salvar e publicar' : 'Salvar rascunho'}
        </button>
      </div>
    </form>
  );
}
