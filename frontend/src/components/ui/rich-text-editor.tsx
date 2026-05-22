'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import { ResizableImage } from './resizable-image-extension';
import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Minus, Undo, Redo, Link as LinkIcon,
  ImageIcon, Video, X,
} from 'lucide-react';

interface Props {
  content?: Record<string, unknown> | null;
  onChange: (html: string, json: Record<string, unknown>) => void;
  placeholder?: string;
}

function ToolbarBtn({
  onClick, active, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}
    >
      {children}
    </button>
  );
}

type Modal = 'image' | 'video' | null;

export function RichTextEditor({ content, onChange, placeholder = 'Escreva o conteúdo do artigo...' }: Props) {
  const [modal, setModal] = useState<Modal>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      ResizableImage,
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: 'w-full aspect-video rounded-lg my-4' } }),
    ],
    content: content ?? undefined,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[400px] px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getJSON() as Record<string, unknown>);
    },
  });

  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  const setLink = () => {
    const url = window.prompt('URL do link:');
    if (!url) return;
    editor?.chain().focus().setLink({ href: url }).run();
  };

  const insertImageByUrl = () => {
    if (!imageUrl.trim()) return;
    editor?.chain().focus().setImage({ src: imageUrl.trim(), alt: imageAlt.trim() || undefined }).run();
    setImageUrl(''); setImageAlt(''); setModal(null);
  };

  const insertImageByFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor?.chain().focus().setImage({ src: reader.result }).run();
      }
      setModal(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertVideo = () => {
    if (!videoUrl.trim()) return;
    editor?.chain().focus().setYoutubeVideo({ src: videoUrl.trim() }).run();
    setVideoUrl(''); setModal(null);
  };

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Desfazer"><Undo size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Refazer"><Redo size={15} /></ToolbarBtn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1"><Heading1 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2"><Heading2 size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3"><Heading3 size={15} /></ToolbarBtn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito"><Bold size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico"><Italic size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado"><Strikethrough size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Código inline"><Code size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={setLink} active={editor.isActive('link')} title="Inserir link"><LinkIcon size={15} /></ToolbarBtn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista"><List size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação"><Quote size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linha horizontal"><Minus size={15} /></ToolbarBtn>

        <span className="w-px h-5 bg-gray-200 mx-1" />

        <ToolbarBtn onClick={() => setModal('image')} title="Inserir imagem"><ImageIcon size={15} /></ToolbarBtn>
        <ToolbarBtn onClick={() => setModal('video')} title="Inserir vídeo (YouTube/Vimeo)"><Video size={15} /></ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} className="bg-white" />

      {/* Image modal */}
      {modal === 'image' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Inserir imagem</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">URL da imagem</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && insertImageByUrl()}
                  placeholder="https://..."
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Texto alternativo (alt)</label>
                <input
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Descrição da imagem"
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={insertImageByUrl}
                  disabled={!imageUrl.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                >
                  Inserir por URL
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg"
                >
                  Upload
                </button>
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={insertImageByFile} />

              <p className="text-xs text-gray-400 text-center">Upload insere como base64 (temporário). Para produção, configure S3.</p>
            </div>
          </div>
        </div>
      )}

      {/* Video modal */}
      {modal === 'video' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Inserir vídeo</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">URL do vídeo</label>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && insertVideo()}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400">Suporta links do YouTube e Vimeo</p>
              <button
                onClick={insertVideo}
                disabled={!videoUrl.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
              >
                Inserir vídeo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
