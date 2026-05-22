'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, X, Search, Check } from 'lucide-react';
import { Tooltip } from './tooltip';
import { lookupApi, LookupItem } from '@/lib/api/lookup';
import { Client, ClientServiceItem } from '@/lib/api/clients';

// ─── Zod schema (base fields) ────────────────────────────────────────────────

const schema = z.object({
  company_name: z.string().min(1, 'Campo obrigatório'),
  legal_name: z.string().optional(),
  cnpj: z.string().optional(),
  domain: z.string().min(1, 'Campo obrigatório'),
  contact_name: z.string().optional(),
  status: z.enum(['ACTIVE', 'PAYING', 'CANCELLED', 'RENEWED', 'PAUSED', 'FINISHED']).optional(),
  segment_id: z.string().optional(),
  market_segment_id: z.string().optional(),
  business_model_id: z.string().optional(),
  company_size_id: z.string().optional(),
  tag_ids: z.array(z.string()).optional(),
  seller_id: z.string().optional(),
  technical_id: z.string().optional(),
  webhook_deploy: z.string().url('URL inválida').optional().or(z.literal('')),
  notes: z.string().optional(),
  email: z.union([z.string().email('Email inválido'), z.literal('')]).optional(),
  phones: z.array(z.object({
    phone: z.string().min(1, 'Campo obrigatório'),
    label: z.string().optional(),
    is_primary: z.boolean().optional(),
  })).optional(),
});

// ─── Service field values (local state, not in zod) ──────────────────────────

type ServiceValues = {
  contract_months?: number | '';
  management_fee?: number | '';
  media_budget?: number | '';
  monthly_value?: number | '';
  one_time_value?: number | '';
  renewal_count?: number | '';
  started_at?: string;
  // config extras
  contracted_pages?: number | '';
  keywords_qty?: number | '';
  monthly_articles?: number | '';
  monthly_press_releases?: number | '';
  is_new_website?: boolean;
  installments?: number | '';
  contracted_artworks?: number | '';
  contracted_content?: number | '';
};

type ServicePayload = {
  service_type_id: string;
  contract_months?: number;
  management_fee?: number;
  media_budget?: number;
  monthly_value?: number;
  one_time_value?: number;
  renewal_count?: number;
  started_at?: string;
  config?: Record<string, unknown>;
};

export type ClientFormData = z.infer<typeof schema> & {
  services?: ServicePayload[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCNPJ(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function parsePhone(value: string): { ddd: string; num: string } {
  const match = value.match(/^\((\d{2,3})\)\s*(.*)$/);
  if (match) return { ddd: match[1], num: match[2].replace(/\D/g, '') };
  const d = value.replace(/\D/g, '');
  return { ddd: d.slice(0, 2), num: d.slice(2) };
}

function formatNum(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 9);
  if (!d) return '';
  if (d.length <= 8) return d.replace(/^(\d{1,4})(\d{1,4})$/, '$1-$2');
  return d.replace(/^(\d{5})(\d{1,4})$/, '$1-$2');
}

function buildPhone(ddd: string, num: string): string {
  const d = ddd.replace(/\D/g, '').slice(0, 3);
  const n = num.replace(/\D/g, '').slice(0, 9);
  if (!d && !n) return '';
  return `(${d}) ${formatNum(n)}`.trim();
}

function PhoneEntry({ initialValue, onPhoneChange }: { initialValue: string; onPhoneChange: (v: string) => void }) {
  const parsed = parsePhone(initialValue);
  const dddRef = useRef<HTMLInputElement>(null);
  const numRef = useRef<HTMLInputElement>(null);

  const sync = () => {
    const d = (dddRef.current?.value ?? '').replace(/\D/g, '').slice(0, 3);
    const n = (numRef.current?.value ?? '').replace(/\D/g, '').slice(0, 9);
    onPhoneChange(buildPhone(d, n));
  };

  return (
    <div className="flex gap-1.5 w-full">
      <input
        ref={dddRef}
        type="text"
        inputMode="numeric"
        placeholder="DDD"
        maxLength={3}
        defaultValue={parsed.ddd}
        onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); }}
        onBlur={sync}
        className="w-16 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
      />
      <input
        ref={numRef}
        type="text"
        inputMode="tel"
        placeholder="99999-9999"
        defaultValue={formatNum(parsed.num)}
        onChange={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9); }}
        onBlur={(e) => {
          e.target.value = formatNum(e.target.value.replace(/\D/g, '').slice(0, 9));
          sync();
        }}
        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// DD/MM/AAAA mask → auto-formats as user types, returns YYYY-MM-DD for API
function formatDateMask(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return d
    .replace(/^(\d{2})(\d)/, '$1/$2')
    .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
}
function maskToISO(masked: string): string {
  const [dd, mm, yyyy] = masked.split('/');
  if (!dd || !mm || !yyyy || yyyy.length < 4) return '';
  return `${yyyy}-${mm}-${dd}`;
}
function isoToMask(iso: string): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function DateInput({ value, onChange, placeholder = 'DD/MM/AAAA' }: {
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(() => isoToMask(value));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = formatDateMask(e.target.value);
    setDisplay(masked);
    onChange(maskToISO(masked));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={10}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function CurrencyInput({ value, onChange }: {
  value: number | '' | undefined;
  onChange: (val: number | '') => void;
}) {
  const fmt = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const [display, setDisplay] = useState(() => {
    const n = value === '' || value == null ? 0 : Math.round(Number(value) * 100);
    return n > 0 ? fmt(n) : '';
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    const cents = parseInt(digits || '0', 10);
    setDisplay(cents > 0 ? fmt(cents) : '');
    onChange(cents > 0 ? cents / 100 : '');
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder="R$ 0,00"
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

function toNum(v: unknown) {
  if (v === '' || v == null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

const SERVICE_ICONS: Record<string, string> = {
  SEO: '🔍',
  BLOG: '📝',
  GOOGLE_ADS: '📢',
  META_ADS: '📱',
  WEBSITE: '🌐',
  PR: '📰',
  SOCIAL_MEDIA: '📸',
};

const SEO_MONTHS = [12, 24, 36, 50, 100];
const ADS_MONTHS = [6, 12, 24];

function fmtBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function ServiceTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="col-span-full mt-1 flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-blue-700">{fmtBRL(value)}</span>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface Props {
  defaultValues?: Partial<Client>;
  onSubmit: (data: ClientFormData) => Promise<void>;
  isLoading: boolean;
  submitLabel: string;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    />
  );
}

function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${className}`}
    >
      {children}
    </select>
  );
}

// ─── Tag selector ─────────────────────────────────────────────────────────────

interface TagSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
  allTags: LookupItem[];
  search: string;
  onSearch: (v: string) => void;
  dropOpen: boolean;
  onToggleDrop: (v: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function TagSelector({ value, onChange, allTags, search, onSearch, dropOpen, onToggleDrop, containerRef }: TagSelectorProps) {
  const selectedTags = allTags.filter((t) => value.includes(t.id));
  const unselectedTags = allTags.filter((t) => !value.includes(t.id));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} className="relative">
      <div
        className="min-h-[38px] w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 bg-white flex flex-wrap gap-1 cursor-text"
        onClick={() => onToggleDrop(true)}
      >
        {selectedTags.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
            {t.name}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(t.id); }} className="hover:text-blue-900">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={search}
          onChange={(e) => { onSearch(e.target.value); onToggleDrop(true); }}
          onFocus={() => onToggleDrop(true)}
          placeholder={value.length === 0 ? 'Buscar tags...' : ''}
          className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
        />
      </div>
      {dropOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {unselectedTags.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">
              {search ? 'Nenhuma tag encontrada' : 'Todas as tags já selecionadas'}
            </p>
          )}
          {unselectedTags.map((t) => (
            <button key={t.id} type="button" onClick={() => toggle(t.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
              <Search size={11} className="text-gray-400 shrink-0" />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Service fields per code ──────────────────────────────────────────────────

function ServiceFields({
  code,
  values,
  onChange,
}: {
  code: string | null;
  values: ServiceValues;
  onChange: (patch: Partial<ServiceValues>) => void;
}) {
  const set = (field: keyof ServiceValues, val: unknown) => onChange({ [field]: val });

  const numInput = (field: keyof ServiceValues, label: string, placeholder = '0') => (
    <Field label={label}>
      <Input
        type="number"
        placeholder={placeholder}
        value={values[field] as string ?? ''}
        onChange={(e) => set(field, e.target.value === '' ? '' : Number(e.target.value))}
      />
    </Field>
  );

  const brlInput = (field: keyof ServiceValues, label: string) => (
    <Field label={label}>
      <CurrencyInput
        value={values[field] as number | ''}
        onChange={(val) => set(field, val)}
      />
    </Field>
  );

  const dateInput = (label: string) => (
    <Field label={label}>
      <DateInput
        value={values.started_at ?? ''}
        onChange={(iso) => set('started_at', iso)}
      />
    </Field>
  );

  const monthsSelect = (options: number[]) => (
    <Field label="Duração (meses)">
      <Select
        value={values.contract_months ?? ''}
        onChange={(e) => set('contract_months', e.target.value === '' ? '' : Number(e.target.value))}
      >
        <option value="">Selecione...</option>
        {options.map((m) => <option key={m} value={m}>{m} meses</option>)}
      </Select>
    </Field>
  );

  if (code === 'SEO') {
    const monthly = typeof values.monthly_value === 'number' ? values.monthly_value : 0;
    const months = typeof values.contract_months === 'number' ? values.contract_months : 0;
    const total = monthly > 0 && months > 0 ? monthly * months : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {dateInput('Data de início')}
        {monthsSelect(SEO_MONTHS)}
        {brlInput('monthly_value', 'Valor mensal')}
        {numInput('renewal_count', 'Nº de renovações')}
        {numInput('contracted_pages', 'Páginas contratadas')}
        {numInput('keywords_qty', 'Palavras-chave')}
        {total != null && <ServiceTotal label="Valor total do contrato:" value={total} />}
      </div>
    );
  }

  if (code === 'BLOG') return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
      {numInput('monthly_articles', 'Artigos/mês')}
    </div>
  );

  if (code === 'GOOGLE_ADS' || code === 'META_ADS') {
    const fee = typeof values.management_fee === 'number' ? values.management_fee : 0;
    const budget = typeof values.media_budget === 'number' ? values.media_budget : 0;
    const months = typeof values.contract_months === 'number' ? values.contract_months : 0;
    const total = (fee > 0 || budget > 0) && months > 0 ? (fee + budget) * months : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {dateInput('Data de início')}
        {monthsSelect(ADS_MONTHS)}
        {brlInput('management_fee', 'Honorário de gestão')}
        {brlInput('media_budget', 'Verba de mídia')}
        {total != null && <ServiceTotal label="Valor total do contrato:" value={total} />}
      </div>
    );
  }

  if (code === 'WEBSITE') {
    const oneTime = typeof values.one_time_value === 'number' ? values.one_time_value : 0;
    const installments = typeof values.installments === 'number' ? values.installments : 0;
    const total = oneTime > 0 && installments > 0 ? oneTime * installments : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        <Field label="Site novo?">
          <div className="flex items-center h-[38px] gap-2">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-blue-600"
              checked={values.is_new_website ?? false}
              onChange={(e) => set('is_new_website', e.target.checked)}
            />
            <span className="text-sm text-gray-700">Sim, é um site novo</span>
          </div>
        </Field>
        {brlInput('one_time_value', 'Valor por parcela')}
        {numInput('installments', 'Parcelas')}
        {total != null && <ServiceTotal label="Valor total do projeto:" value={total} />}
      </div>
    );
  }

  if (code === 'PR') {
    const monthly = typeof values.monthly_value === 'number' ? values.monthly_value : 0;
    const months = typeof values.contract_months === 'number' ? values.contract_months : 0;
    const total = monthly > 0 && months > 0 ? monthly * months : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {dateInput('Data de início')}
        {monthsSelect(ADS_MONTHS)}
        {brlInput('monthly_value', 'Valor mensal')}
        {numInput('monthly_press_releases', 'Press releases/mês')}
        {total != null && <ServiceTotal label="Valor total do contrato:" value={total} />}
      </div>
    );
  }

  if (code === 'SOCIAL_MEDIA') {
    const monthly = typeof values.monthly_value === 'number' ? values.monthly_value : 0;
    const months = typeof values.contract_months === 'number' ? values.contract_months : 0;
    const total = monthly > 0 && months > 0 ? monthly * months : null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {dateInput('Data de início')}
        {monthsSelect(ADS_MONTHS)}
        {brlInput('monthly_value', 'Valor mensal')}
        {numInput('contracted_artworks', 'Artes contratadas')}
        {numInput('contracted_content', 'Conteúdos contratados')}
        {total != null && <ServiceTotal label="Valor total do contrato:" value={total} />}
      </div>
    );
  }

  return null;
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function ClientForm({ defaultValues, onSubmit, isLoading, submitLabel }: Props) {
  const [marketSegments, setMarketSegments] = useState<LookupItem[]>([]);
  const [businessModels, setBusinessModels] = useState<LookupItem[]>([]);
  const [companySizes, setCompanySizes] = useState<LookupItem[]>([]);
  const [serviceTypes, setServiceTypes] = useState<LookupItem[]>([]);
  const [tagResults, setTagResults] = useState<LookupItem[]>([]);
  const [tagSearch, setTagSearch] = useState('');
  const [tagDropOpen, setTagDropOpen] = useState(false);
  const tagRef = useRef<HTMLDivElement>(null);
  // Service state: keyed by service_type_id
  const [activeServices, setActiveServices] = useState<Record<string, ServiceValues>>(() => {
    if (!defaultValues?.services?.length) return {};
    return Object.fromEntries(
      defaultValues.services.map((s: ClientServiceItem) => [
        s.service_type_id,
        {
          contract_months: s.contract_months ?? '',
          management_fee: s.management_fee != null ? Number(s.management_fee) : '',
          media_budget: s.media_budget != null ? Number(s.media_budget) : '',
          monthly_value: s.monthly_value != null ? Number(s.monthly_value) : '',
          one_time_value: s.one_time_value != null ? Number(s.one_time_value) : '',
          renewal_count: s.renewal_count ?? '',
          started_at: s.started_at ?? '',
          contracted_pages: (s.config?.contracted_pages as number) ?? '',
          keywords_qty: (s.config?.keywords_qty as number) ?? '',
          monthly_articles: (s.config?.monthly_articles as number) ?? '',
          monthly_press_releases: (s.config?.monthly_press_releases as number) ?? '',
          is_new_website: (s.config?.is_new_website as boolean) ?? false,
          installments: (s.config?.installments as number) ?? '',
          contracted_artworks: (s.config?.contracted_artworks as number) ?? '',
          contracted_content: (s.config?.contracted_content as number) ?? '',
        } as ServiceValues,
      ]),
    );
  });

  const toggleService = (id: string) => {
    setActiveServices((prev) => {
      if (id in prev) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: {} };
    });
  };

  const patchService = (id: string, patch: Partial<ServiceValues>) => {
    setActiveServices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<ClientFormData, any, ClientFormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: defaultValues
      ? {
          company_name: defaultValues.company_name ?? '',
          legal_name: defaultValues.legal_name ?? '',
          cnpj: defaultValues.cnpj ?? '',
          domain: defaultValues.domain ?? '',
          contact_name: defaultValues.contact_name ?? '',
          status: (defaultValues.status as ClientFormData['status']) ?? 'ACTIVE',
          segment_id: defaultValues.segment_id ?? undefined,
          market_segment_id: defaultValues.market_segment_id ?? undefined,
          business_model_id: defaultValues.business_model_id ?? undefined,
          company_size_id: defaultValues.company_size_id ?? undefined,
          tag_ids: defaultValues.tags?.map((ct) => ct.tag.id) ?? [],
          seller_id: defaultValues.seller_id ?? undefined,
          webhook_deploy: defaultValues.webhook_deploy ?? '',
          notes: defaultValues.notes ?? '',
          email: defaultValues.emails?.[0]?.email ?? '',
          phones: defaultValues.phones?.map((p) => ({ phone: p.phone, label: p.label ?? '', is_primary: p.is_primary })) ?? [],
        }
      : { status: 'ACTIVE' as const, email: '', phones: [], tag_ids: [] },
  });

  const { fields: phoneFields, append: appendPhone, remove: removePhone } = useFieldArray({ control, name: 'phones' });

  useEffect(() => {
    lookupApi.marketSegments().then((data) => {
      setMarketSegments(data);
      if (defaultValues?.market_segment_id) setValue('market_segment_id', defaultValues.market_segment_id);
    }).catch(() => {});
    lookupApi.businessModels().then((data) => {
      setBusinessModels(data);
      if (defaultValues?.business_model_id) setValue('business_model_id', defaultValues.business_model_id);
    }).catch(() => {});
    lookupApi.companySizes().then((data) => {
      setCompanySizes(data);
      if (defaultValues?.company_size_id) setValue('company_size_id', defaultValues.company_size_id);
    }).catch(() => {});
    lookupApi.serviceTypes().then(setServiceTypes).catch(() => {});
    lookupApi.tags().then(setTagResults).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tagDropOpen) return;
    lookupApi.tags(tagSearch || undefined).then(setTagResults).catch(() => {});
  }, [tagSearch, tagDropOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const UUID_FIELDS = [
    'segment_id', 'market_segment_id', 'business_model_id', 'company_size_id',
    'seller_id', 'technical_id',
  ] as const;

  const handleFormSubmit = (data: ClientFormData) => {
    const cleaned = { ...data } as Record<string, unknown>;
    for (const field of UUID_FIELDS) {
      if (cleaned[field] === '') cleaned[field] = undefined;
    }

    if (cleaned.webhook_deploy === '') cleaned.webhook_deploy = undefined;
    if (cleaned.notes === '') cleaned.notes = undefined;

    const emailStr = (data as Record<string, unknown>).email as string | undefined;
    cleaned.emails = emailStr ? [{ email: emailStr, is_primary: true, label: '' }] : [];
    delete cleaned.email;

    (cleaned as ClientFormData).services = Object.entries(activeServices).map(([typeId, vals]) => ({
      service_type_id: typeId,
      contract_months: toNum(vals.contract_months),
      management_fee: toNum(vals.management_fee),
      media_budget: toNum(vals.media_budget),
      monthly_value: toNum(vals.monthly_value),
      one_time_value: toNum(vals.one_time_value),
      renewal_count: toNum(vals.renewal_count),
      started_at: vals.started_at || undefined,
      config: {
        contracted_pages: toNum(vals.contracted_pages),
        keywords_qty: toNum(vals.keywords_qty),
        monthly_articles: toNum(vals.monthly_articles),
        monthly_press_releases: toNum(vals.monthly_press_releases),
        is_new_website: vals.is_new_website,
        installments: toNum(vals.installments),
        contracted_artworks: toNum(vals.contracted_artworks),
        contracted_content: toNum(vals.contracted_content),
      },
    }));

    return onSubmit(cleaned as ClientFormData);
  };

  // Only canonical service types (with code) are shown as cards; legacy types are hidden
  const canonicalServices = serviceTypes.filter((s) => !!s.code).sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">

      {/* Dados básicos */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Dados básicos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Razão social *" error={errors.company_name?.message}>
            <Input {...register('company_name')} placeholder="Ex: Empresa ABC Ltda" />
          </Field>
          <Field label="Nome fantasia" error={errors.legal_name?.message}>
            <Input {...register('legal_name')} placeholder="Nome de exibição" />
          </Field>
          <Field label="CNPJ" error={errors.cnpj?.message}>
            <Input
              {...register('cnpj')}
              placeholder="00.000.000/0000-00"
              onChange={(e) => setValue('cnpj', formatCNPJ(e.target.value))}
            />
          </Field>
          <Field label="Domínio *" error={errors.domain?.message}>
            <Input {...register('domain')} placeholder="www.exemplo.com.br" />
          </Field>
          <Field label="Nome do contato" error={errors.contact_name?.message}>
            <Input {...register('contact_name')} placeholder="João da Silva" />
          </Field>
          <Field label="Status" error={errors.status?.message}>
            <Select {...register('status')}>
              <option value="ACTIVE">Ativo</option>
              <option value="PAYING">Pagando</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="RENEWED">Renovado</option>
              <option value="PAUSED">Pausado</option>
              <option value="FINISHED">Encerrado</option>
            </Select>
          </Field>
        </div>

        {/* Telefones + Email inline */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Telefones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-600">Telefones</span>
              <Tooltip text="Adicionar número de telefone">
                <button type="button"
                  onClick={() => appendPhone({ phone: '', label: '', is_primary: phoneFields.length === 0 })}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                  <Plus size={13} /> Adicionar
                </button>
              </Tooltip>
            </div>
            {phoneFields.length === 0 && <p className="text-xs text-gray-400">Nenhum telefone cadastrado</p>}
            <div className="space-y-2">
              {phoneFields.map((field, i) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <PhoneEntry
                      initialValue={phoneFields[i]?.phone ?? ''}
                      onPhoneChange={(v) => setValue(`phones.${i}.phone`, v, { shouldDirty: true })}
                    />
                    {errors.phones?.[i]?.phone && (
                      <p className="text-red-500 text-xs mt-1">{errors.phones[i]?.phone?.message}</p>
                    )}
                  </div>
                  <Tooltip text="Remover este telefone">
                    <button type="button" onClick={() => removePhone(i)} className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-0.5">
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>

          {/* Email único */}
          <div>
            <span className="text-xs font-medium text-gray-600 block mb-2">Email</span>
            <input
              {...register('email')}
              type="email"
              inputMode="email"
              placeholder="nome@empresa.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Classificação */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Classificação</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Segmento de mercado" error={errors.market_segment_id?.message}>
            <Select
              value={watch('market_segment_id') ?? ''}
              onChange={(e) => setValue('market_segment_id', e.target.value || undefined)}
            >
              <option value="">Selecione...</option>
              {marketSegments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Modelo de negócio" error={errors.business_model_id?.message}>
            <Select
              value={watch('business_model_id') ?? ''}
              onChange={(e) => setValue('business_model_id', e.target.value || undefined)}
            >
              <option value="">Selecione...</option>
              {businessModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Plano" error={errors.company_size_id?.message}>
            <Select
              value={watch('company_size_id') ?? ''}
              onChange={(e) => setValue('company_size_id', e.target.value || undefined)}
            >
              <option value="">Selecione...</option>
              {companySizes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Tags">
            <TagSelector
              value={watch('tag_ids') ?? []}
              onChange={(ids) => setValue('tag_ids', ids)}
              allTags={tagResults}
              search={tagSearch}
              onSearch={setTagSearch}
              dropOpen={tagDropOpen}
              onToggleDrop={setTagDropOpen}
              containerRef={tagRef}
            />
          </Field>
        </div>
      </section>

      {/* Serviços contratados */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Serviços contratados</h2>
        <p className="text-xs text-gray-400 mb-4">Selecione os serviços ativos para este cliente</p>

        {/* Service toggle cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {canonicalServices.map((svc) => {
            const active = svc.id in activeServices;
            const icon = SERVICE_ICONS[svc.code ?? ''] ?? '⚙️';
            return (
              <Tooltip key={svc.id} text={active ? `Desativar serviço: ${svc.name}` : `Ativar serviço: ${svc.name}`} position="bottom">
                <button
                  type="button"
                  onClick={() => toggleService(svc.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left w-full ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base leading-none">{icon}</span>
                  <span className="flex-1">{svc.name}</span>
                  {active && <Check size={14} className="shrink-0 text-blue-500" />}
                </button>
              </Tooltip>
            );
          })}
        </div>

        {/* Per-service field panels */}
        {canonicalServices.filter((s) => s.id in activeServices).map((svc) => (
          <div key={svc.id} className="mb-4 last:mb-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{SERVICE_ICONS[svc.code ?? ''] ?? '⚙️'}</span>
              <h3 className="text-sm font-medium text-gray-700">{svc.name}</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <ServiceFields
              code={svc.code ?? null}
              values={activeServices[svc.id] ?? {}}
              onChange={(patch) => patchService(svc.id, patch)}
            />
          </div>
        ))}

        {Object.keys(activeServices).length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">Nenhum serviço selecionado</p>
        )}
      </section>

      {/* Integração / Publicação */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Webhook de publicação</h2>
        <p className="text-xs text-gray-400 mb-4">URL chamada automaticamente quando um artigo ou página SEO é publicado. Dispara o rebuild do site do cliente.</p>
        <input
          {...register('webhook_deploy')}
          type="url"
          placeholder="https://api.cliente.com.br/deploy"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.webhook_deploy && (
          <p className="mt-1 text-xs text-red-500">{errors.webhook_deploy.message}</p>
        )}
      </section>

      {/* Observações */}
      <section className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Observações</h2>
        <textarea
          {...register('notes')}
          rows={3}
          placeholder="Notas internas sobre o cliente..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </section>

      <div className="flex justify-end">
        <Tooltip text="Salvar todas as alterações do cliente">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            {isLoading ? 'Salvando...' : submitLabel}
          </button>
        </Tooltip>
      </div>
    </form>
  );
}
