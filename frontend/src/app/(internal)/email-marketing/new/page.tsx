'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import {
  ArrowLeft, Send, Save, Clock, Users,
  Bold, Italic, List, ListOrdered, Link as LinkIcon,
  Minus, FlaskConical, PenLine, Sparkles, ImageIcon, X,
  Paperclip, FileText, Trash2,
} from 'lucide-react';
import {
  emailMarketingApi,
  AudienceType,
  EmailTemplate,
  AudiencePreview,
  EmailCampaign,
  EmailAttachment,
} from '@/lib/api/email-marketing';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  newsletter:    { label: 'Newsletter',    color: 'text-blue-700',   bg: 'bg-blue-50',   dot: 'bg-blue-400' },
  apresentacao:  { label: 'Apresentação',  color: 'text-purple-700', bg: 'bg-purple-50', dot: 'bg-purple-400' },
  transacional:  { label: 'Transacional',  color: 'text-emerald-700',bg: 'bg-emerald-50',dot: 'bg-emerald-400' },
  reengajamento: { label: 'Reengajamento', color: 'text-orange-700', bg: 'bg-orange-50', dot: 'bg-orange-400' },
  relatorio:     { label: 'Relatório',     color: 'text-gray-700',   bg: 'bg-gray-50',   dot: 'bg-gray-400' },
  promocao:      { label: 'Promoção',      color: 'text-rose-700',   bg: 'bg-rose-50',   dot: 'bg-rose-400' },
  custom:        { label: 'Personalizado', color: 'text-gray-600',   bg: 'bg-gray-50',   dot: 'bg-gray-300' },
};

const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: 'manual',            label: '🧪 Destinatários manuais (teste)' },
  { value: 'all_clients',       label: 'Todos os clientes' },
  { value: 'active_clients',    label: 'Clientes ativos' },
  { value: 'all_leads',         label: 'Todos os leads' },
  { value: 'new_leads',         label: 'Leads novos' },
  { value: 'qualified_leads',   label: 'Leads qualificados' },
  { value: 'proposal_leads',    label: 'Leads em proposta' },
  { value: 'negotiation_leads', label: 'Leads em negociação' },
  { value: 'won_leads',         label: 'Leads ganhos' },
  { value: 'lost_leads',        label: 'Leads perdidos' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function TBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`p-1.5 rounded transition-colors ${active ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}>
      {children}
    </button>
  );
}

// ─── Step 1: Template picker ───────────────────────────────────────────────────

function TemplatePicker({
  templates,
  onPick,
}: {
  templates: EmailTemplate[];
  onPick: (t: EmailTemplate | null) => void;
}) {
  const router = useRouter();
  const categories = Array.from(new Set(templates.map((t) => t.category)));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/email-marketing')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Nova campanha</h1>
          <p className="text-sm text-gray-400">Escolha um template ou comece em branco</p>
        </div>
      </div>

      {/* Blank option */}
      <button
        onClick={() => onPick(null)}
        className="w-full flex items-center gap-4 px-5 py-4 bg-white border-2 border-dashed border-gray-200 rounded-xl hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shrink-0">
          <PenLine size={18} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700 group-hover:text-emerald-700">Começar em branco</p>
          <p className="text-xs text-gray-400">Editor livre — crie do zero</p>
        </div>
      </button>

      {/* Templates by category */}
      {categories.map((cat) => {
        const meta = CATEGORY_META[cat] ?? CATEGORY_META['custom'];
        const items = templates.filter((t) => t.category === cat);
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{meta.label}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((t) => (
                <button key={t.id} type="button"
                  onClick={() => onPick(t)}
                  className="text-left bg-white border border-gray-100 rounded-xl p-4 hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/20 transition-all group"
                >
                  {/* Mini preview */}
                  <div className={`${meta.bg} rounded-lg px-3 py-2.5 mb-3 min-h-[64px] overflow-hidden`}>
                    <p className="text-[10px] font-bold text-gray-700 truncate leading-tight">{t.subject}</p>
                    {t.preview_text && (
                      <p className="text-[9px] text-gray-400 truncate mt-0.5 leading-tight">{t.preview_text}</p>
                    )}
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1 bg-gray-200/60 rounded-full w-full" />
                      <div className="h-1 bg-gray-200/60 rounded-full w-4/5" />
                      <div className="h-1 bg-gray-200/60 rounded-full w-3/5" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{t.name}</p>
                  <p className="text-xs text-gray-400 truncate mt-0.5">{t.subject}</p>
                  <span className={`mt-2 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} border border-current/10`}>
                    {meta.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 2: Campaign editor ───────────────────────────────────────────────────

function CampaignEditor({
  initialTemplate,
  campaignId,
  isTemplateMode,
}: {
  initialTemplate: EmailTemplate | null;
  campaignId: string | null;
  isTemplateMode: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [subject, setSubject] = useState(initialTemplate?.subject ?? '');
  const [previewText, setPreviewText] = useState(initialTemplate?.preview_text ?? '');
  const [fromName, setFromName] = useState('Quality SMI — Sistema de Marketing para Internet');
  const [fromEmail, setFromEmail] = useState('noreply@marketing.qualitysmi.com.br');
  const [replyTo, setReplyTo] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>('all_clients');
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview[] | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [showAudience, setShowAudience] = useState(false);
  const [manualEmails, setManualEmails] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [templateCategory, setTemplateCategory] = useState('geral');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(!!campaignId);
  const [existingCampaign, setExistingCampaign] = useState<EmailCampaign | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [sendLimit, setSendLimit] = useState(1000);
  const [sendOffset, setSendOffset] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');
  const [imgLink, setImgLink] = useState('');
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const attachFileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Escreva o conteúdo do email...' }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-blue-600 underline' } }),
      Image.configure({ HTMLAttributes: { class: 'max-w-full h-auto rounded my-2', style: 'max-width:100%' } }),
    ],
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none min-h-[360px] px-4 py-3 focus:outline-none' },
    },
    onCreate: () => setEditorReady(true),
  });

  // Load initial template content once editor is ready
  useEffect(() => {
    if (!editorReady || !editor || initialTemplate) return;
  }, [editorReady]);

  useEffect(() => {
    if (!editorReady || !editor || !initialTemplate) return;
    editor.commands.setContent(initialTemplate.html_body);
  }, [editorReady, editor, initialTemplate]);

  // Load existing campaign for editing
  useEffect(() => {
    if (!campaignId || !editorReady || !editor) return;
    setLoading(true);
    emailMarketingApi.getCampaign(campaignId)
      .then((c) => {
        setExistingCampaign(c);
        setName(c.name);
        setSubject(c.subject);
        setPreviewText(c.preview_text ?? '');
        setFromName(c.from_name);
        setFromEmail(c.from_email || 'noreply@marketing.qualitysmi.com.br');
        setReplyTo(c.reply_to ?? '');
        setAudienceType(c.audience_type as AudienceType);
        if (c.scheduled_at) { setScheduleEnabled(true); setScheduledAt(c.scheduled_at.slice(0, 16)); }
        if (c.html_body) editor.commands.setContent(c.html_body);
        if (c.attachments?.length) setAttachments(c.attachments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId, editorReady, editor]);

  // Parse manual emails
  const parseManualEmails = useCallback((raw: string) =>
    raw.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e.includes('@')),
  []);

  // Audience preview
  const loadAudience = useCallback(async (type: AudienceType, rawManual?: string) => {
    setAudienceLoading(true);
    setAudiencePreview(null);
    try {
      const filters = type === 'manual' ? { emails: parseManualEmails(rawManual ?? '') } : undefined;
      const data = await emailMarketingApi.previewAudience(type, filters);
      setAudiencePreview(data);
    } catch { /* noop */ } finally {
      setAudienceLoading(false);
    }
  }, [parseManualEmails]);

  useEffect(() => { loadAudience(audienceType, manualEmails); }, [audienceType, loadAudience]);

  useEffect(() => {
    if (audienceType !== 'manual') return;
    const t = setTimeout(() => loadAudience('manual', manualEmails), 600);
    return () => clearTimeout(t);
  }, [manualEmails, audienceType, loadAudience]);

  const insertImage = () => {
    if (!imgUrl.trim() || !editor) return;
    if (imgLink.trim()) {
      editor.chain().focus().insertContent(
        `<a href="${imgLink.trim()}" target="_blank" rel="noopener noreferrer"><img src="${imgUrl.trim()}" alt="${imgAlt.trim()}" style="max-width:100%;height:auto;" /></a>`
      ).run();
    } else {
      editor.chain().focus().setImage({ src: imgUrl.trim(), alt: imgAlt.trim() || undefined }).run();
    }
    setImgUrl(''); setImgAlt(''); setImgLink(''); setShowImageModal(false);
  };

  const insertImageByFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result }).run();
      }
      setShowImageModal(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAttachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} excede 5 MB.`); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments((prev) => [...prev, { name: file.name, content: base64, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const getHtml = () => editor?.getHTML() ?? '';

  const validate = () => {
    if (!name.trim()) { alert('Informe o nome'); return false; }
    if (!subject.trim()) { alert('Informe o assunto'); return false; }
    if (!isTemplateMode && !fromEmail.trim()) { alert('Informe o email de envio'); return false; }
    const html = getHtml();
    if (!html || html === '<p></p>') { alert('O corpo do email está vazio'); return false; }
    return true;
  };

  const manualFilters = () => audienceType === 'manual' ? { emails: parseManualEmails(manualEmails) } : {};

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isTemplateMode) {
        await emailMarketingApi.createTemplate({
          name, subject, preview_text: previewText || null,
          html_body: getHtml(), category: templateCategory,
        });
      } else if (existingCampaign) {
        await emailMarketingApi.updateCampaign(existingCampaign.id, {
          name, subject, preview_text: previewText || null, html_body: getHtml(),
          from_name: fromName, from_email: fromEmail, reply_to: replyTo || null,
          audience_type: audienceType, audience_filters: manualFilters(),
          scheduled_at: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          attachments,
        });
      } else {
        await emailMarketingApi.createCampaign({
          name, subject, preview_text: previewText || null, html_body: getHtml(),
          from_name: fromName, from_email: fromEmail, reply_to: replyTo || null,
          audience_type: audienceType, audience_filters: manualFilters(),
          scheduled_at: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          attachments,
        });
      }
      router.push('/email-marketing');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro ao salvar';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = () => {
    if (!validate()) return;
    setShowSendModal(true);
  };

  const confirmSend = async () => {
    setSending(true);
    try {
      const filters = manualFilters();
      let id = existingCampaign?.id ?? '';
      if (!id) {
        const c = await emailMarketingApi.createCampaign({
          name, subject, preview_text: previewText || null, html_body: getHtml(),
          from_name: fromName, from_email: fromEmail, reply_to: replyTo || null,
          audience_type: audienceType, audience_filters: filters,
          attachments,
        });
        id = c.id;
      } else {
        await emailMarketingApi.updateCampaign(id, {
          name, subject, preview_text: previewText || null, html_body: getHtml(),
          from_name: fromName, from_email: fromEmail, reply_to: replyTo || null,
          audience_type: audienceType, audience_filters: filters,
          attachments,
        });
      }
      const sendOpts = limitEnabled ? { limit: sendLimit, offset: sendOffset || undefined } : undefined;
      await emailMarketingApi.sendCampaign(id, sendOpts);
      router.push('/email-marketing');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro ao enviar campanha';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSending(false);
      setShowSendModal(false);
    }
  };

  const totalAudienceCount = audienceType === 'manual'
    ? parseManualEmails(manualEmails).length
    : (audiencePreview?.length ?? 0);

  if (loading) return <div className="text-center py-20 text-sm text-gray-400">Carregando campanha…</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/email-marketing')}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">
          {isTemplateMode ? 'Novo template' : existingCampaign ? 'Editar campanha' : 'Nova campanha'}
        </h1>
        {initialTemplate && (
          <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full">{initialTemplate.name}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left — Fields + Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Basic fields */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {isTemplateMode ? 'Nome do template' : 'Nome da campanha'}
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder={isTemplateMode ? 'Ex: Boas-vindas' : 'Ex: Newsletter Maio 2026'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Assunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Linha de assunto que os destinatários verão"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Pré-visualização <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input value={previewText} onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Aparece após o assunto em alguns clientes de email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            {isTemplateMode && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Categoria</label>
                <input value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)}
                  placeholder="Ex: newsletter, transacional, boas-vindas"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            )}
          </div>

          {/* Sender */}
          {!isTemplateMode && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-gray-500">Remetente</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nome</label>
                  <input value={fromName} onChange={(e) => setFromName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Email</label>
                  <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} type="email"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Responder para <span className="font-normal text-gray-300">(opcional)</span>
                </label>
                <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email"
                  placeholder="reply@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          )}

          {/* Editor */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="border-b border-gray-100 px-3 py-2 flex items-center gap-0.5 flex-wrap bg-gray-50">
              <TBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Negrito">
                <Bold size={14} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Itálico">
                <Italic size={14} />
              </TBtn>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <TBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="H1">
                <span className="text-xs font-bold leading-none">H1</span>
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="H2">
                <span className="text-xs font-bold leading-none">H2</span>
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="H3">
                <span className="text-xs font-bold leading-none">H3</span>
              </TBtn>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <TBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Lista">
                <List size={14} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Lista numerada">
                <ListOrdered size={14} />
              </TBtn>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <TBtn
                onClick={() => {
                  const url = prompt('URL do link:');
                  if (url) editor?.chain().focus().setLink({ href: url }).run();
                }}
                active={editor?.isActive('link')} title="Link"
              >
                <LinkIcon size={14} />
              </TBtn>
              <TBtn onClick={() => editor?.chain().focus().setHorizontalRule().run()} title="Linha horizontal">
                <Minus size={14} />
              </TBtn>
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <TBtn onClick={() => setShowImageModal(true)} title="Inserir imagem">
                <ImageIcon size={14} />
              </TBtn>
            </div>
            <EditorContent editor={editor} />
          </div>

          {/* Image modal */}
          {showImageModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImageModal(false)}>
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">Inserir imagem</h3>
                  <button type="button" onClick={() => setShowImageModal(false)} className="text-gray-400 hover:text-gray-700"><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 font-medium">URL da imagem <span className="text-red-400">*</span></label>
                    <input
                      value={imgUrl}
                      onChange={(e) => setImgUrl(e.target.value)}
                      placeholder="https://exemplo.com/imagem.jpg"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Texto alternativo (alt)</label>
                    <input
                      value={imgAlt}
                      onChange={(e) => setImgAlt(e.target.value)}
                      placeholder="Descrição da imagem"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium">Link ao clicar <span className="text-gray-400">(opcional)</span></label>
                    <input
                      value={imgLink}
                      onChange={(e) => setImgLink(e.target.value)}
                      placeholder="https://seusite.com.br"
                      className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">Se preenchido, a imagem vira um link clicável no email.</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={insertImage}
                      disabled={!imgUrl.trim()}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
                    >
                      Inserir por URL
                    </button>
                    <button
                      type="button"
                      onClick={() => imgFileRef.current?.click()}
                      className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 rounded-lg"
                    >
                      Upload
                    </button>
                  </div>
                  <input ref={imgFileRef} type="file" accept="image/*" hidden onChange={insertImageByFile} />
                  <p className="text-xs text-gray-400 text-center">Upload converte para base64. Use URL para emails (imagens hospedadas carregam melhor).</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Settings */}
        <div className="space-y-4">
          {!isTemplateMode && (
            <>
              {/* Audience */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Users size={13} /> Audiência
                </p>
                <select value={audienceType} onChange={(e) => setAudienceType(e.target.value as AudienceType)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {audienceType === 'manual' && (
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-amber-700 font-medium mb-1.5">
                      <FlaskConical size={12} /> Emails de teste (um por linha ou vírgula)
                    </label>
                    <textarea
                      value={manualEmails}
                      onChange={(e) => setManualEmails(e.target.value)}
                      placeholder={'email1@exemplo.com\nemail2@exemplo.com'}
                      rows={4}
                      className="w-full border border-amber-200 bg-amber-50 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    />
                    <p className="text-[10px] text-amber-600 mt-1">Substitui a audiência normal — use só para testes.</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setShowAudience((v) => !v)}
                    className="text-xs text-emerald-600 hover:underline">
                    {showAudience ? 'Ocultar lista' : 'Ver destinatários'}
                  </button>
                  <span className="text-xs text-gray-400">
                    {audienceLoading ? '…' : `${audiencePreview?.length ?? 0} contatos`}
                  </span>
                </div>

                {showAudience && audiencePreview && (
                  <div className="max-h-48 overflow-y-auto space-y-1 border-t border-gray-100 pt-2">
                    {audiencePreview.slice(0, 50).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.type === 'client' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                        <span className="truncate">{a.name ?? a.email}</span>
                        <span className="text-gray-300 text-[10px] ml-auto flex-shrink-0">
                          {a.type === 'client' ? 'cliente' : 'lead'}
                        </span>
                      </div>
                    ))}
                    {audiencePreview.length > 50 && (
                      <p className="text-xs text-gray-400 pt-1">+ {audiencePreview.length - 50} mais</p>
                    )}
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Clock size={13} /> Agendamento
                </p>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="rounded accent-emerald-600" />
                  Agendar envio
                </label>
                {scheduleEnabled && (
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                )}
              </div>
            </>
          )}

          {/* Subject preview */}
          {subject && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Pré-visualização</p>
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-[10px] text-gray-400">Quality SMI</span>
                </div>
                <p className="text-xs font-medium text-gray-700 truncate">{subject}</p>
                {previewText && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{previewText}</p>}
              </div>
            </div>
          )}

          {/* Attachments */}
          {!isTemplateMode && (
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                <Paperclip size={13} /> Anexos
              </p>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                      <FileText size={12} className="text-gray-400 shrink-0" />
                      <span className="flex-1 truncate text-gray-700">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => attachFileRef.current?.click()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              >
                <Paperclip size={12} /> Adicionar arquivo
              </button>
              <input ref={attachFileRef} type="file" multiple hidden onChange={handleAttachFile} />
              <p className="text-[10px] text-gray-400">Máx. 5 MB por arquivo. PDF, Word, imagens, etc.</p>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
            <button onClick={handleSave} disabled={saving || sending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
              <Save size={14} />
              {saving ? 'Salvando…' : isTemplateMode ? 'Salvar template' : existingCampaign ? 'Salvar alterações' : 'Salvar rascunho'}
            </button>
            {!isTemplateMode && (
              <button onClick={handleSendNow} disabled={saving || sending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50">
                <Send size={14} />
                {sending ? 'Enviando…' : 'Enviar agora'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Send modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-bold text-gray-900 mb-1">Confirmar envio</h2>
            <p className="text-sm text-gray-500 mb-4">
              Audiência selecionada:{' '}
              <strong className="text-gray-800">{totalAudienceCount.toLocaleString('pt-BR')} destinatário{totalAudienceCount !== 1 ? 's' : ''}</strong>
            </p>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer mb-1">
              <input type="checkbox" checked={limitEnabled} onChange={(e) => setLimitEnabled(e.target.checked)}
                className="rounded accent-emerald-600" />
              Limitar quantidade enviada
            </label>
            <p className="text-xs text-gray-400 mb-4 ml-6">Útil para envios em lotes de grandes listas</p>

            {limitEnabled && (
              <div className="space-y-3 mb-4 bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Enviar para no máximo</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={sendLimit} onChange={(e) => setSendLimit(Math.max(1, Number(e.target.value)))}
                        min={1} className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <span className="text-xs text-gray-400">destinatários</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Pular os primeiros</label>
                    <div className="flex items-center gap-2">
                      <input type="number" value={sendOffset} onChange={(e) => setSendOffset(Math.max(0, Number(e.target.value)))}
                        min={0} className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      <span className="text-xs text-gray-400">da lista</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-100">
                  Envio para os destinatários{' '}
                  <strong>#{(sendOffset + 1).toLocaleString('pt-BR')}</strong>{' '}
                  a{' '}
                  <strong>#{Math.min(sendOffset + sendLimit, totalAudienceCount).toLocaleString('pt-BR')}</strong>
                  {' '}de {totalAudienceCount.toLocaleString('pt-BR')} no total
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowSendModal(false)} disabled={sending}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Cancelar
              </button>
              <button onClick={confirmSend} disabled={sending}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Send size={13} />
                {sending ? 'Enviando…' : limitEnabled ? `Enviar ${Math.min(sendLimit, Math.max(0, totalAudienceCount - sendOffset)).toLocaleString('pt-BR')}` : 'Enviar tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function NewCampaignInner() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('id');
  const isTemplateMode = searchParams.get('template') === '1';
  const templateIdParam = searchParams.get('templateId');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [step, setStep] = useState<'pick' | 'editor'>(
    campaignId || isTemplateMode ? 'editor' : 'pick',
  );
  const [pickedTemplate, setPickedTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    emailMarketingApi.listTemplates()
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setTemplatesLoading(false));
  }, []);

  // If templateId param given, find and auto-pick
  useEffect(() => {
    if (!templateIdParam || !templates.length) return;
    const t = templates.find((tpl) => tpl.id === templateIdParam) ?? null;
    setPickedTemplate(t);
    setStep('editor');
  }, [templateIdParam, templates]);

  const handlePick = (t: EmailTemplate | null) => {
    setPickedTemplate(t);
    setStep('editor');
  };

  if (templatesLoading && step === 'pick') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <Sparkles size={28} className="mx-auto text-emerald-400 animate-pulse" />
          <p className="text-sm text-gray-400">Carregando templates…</p>
        </div>
      </div>
    );
  }

  if (step === 'pick') {
    return <TemplatePicker templates={templates} onPick={handlePick} />;
  }

  return (
    <CampaignEditor
      initialTemplate={pickedTemplate}
      campaignId={campaignId}
      isTemplateMode={isTemplateMode}
    />
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-sm text-gray-400">Carregando…</div>}>
      <NewCampaignInner />
    </Suspense>
  );
}
