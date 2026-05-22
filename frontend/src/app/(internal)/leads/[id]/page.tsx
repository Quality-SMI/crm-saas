'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Trash2, Plus, Phone, Mail, MessageSquare, Video, PhoneCall, Clock } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  leadsApi,
  Lead,
  LeadStage,
  LeadOrigin,
  InteractionType,
  STAGE_LABELS,
  STAGE_COLORS,
  ORIGIN_LABELS,
  INTERACTION_LABELS,
} from '@/lib/api/leads';
import { usersApi, AppUser } from '@/lib/api/users';
import {
  appointmentsApi,
  Appointment,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/api/appointments';
import { CalendarDays, CheckCircle, XCircle } from 'lucide-react';

const STAGES: LeadStage[] = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const ORIGINS: LeadOrigin[] = ['WEBSITE', 'REFERRAL', 'COLD_CALL', 'SOCIAL_MEDIA', 'EVENT', 'OTHER'];
const INTERACTION_TYPES: InteractionType[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE'];

const BR_STATES = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' }, { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' }, { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' }, { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' }, { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' }, { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
];

const INTERACTION_ICONS: Record<InteractionType, React.ReactNode> = {
  CALL:          <PhoneCall size={13} />,
  EMAIL:         <Mail size={13} />,
  MEETING:       <Video size={13} />,
  NOTE:          <MessageSquare size={13} />,
  STATUS_CHANGE: <Phone size={13} />,
};

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  contact_name: z.string().optional(),
  contact_email: z.string().email('Email inválido').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  website: z.string().optional(),
  stage: z.enum(['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const),
  origin: z.enum(['WEBSITE', 'REFERRAL', 'COLD_CALL', 'SOCIAL_MEDIA', 'EVENT', 'OTHER'] as const).optional().or(z.literal('')),
  estimated_value: z.string().optional(),
  street: z.string().optional(),
  state: z.string().optional().or(z.literal('')),
  notes: z.string().optional(),
  lost_reason: z.string().optional(),
  owner_id: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lead, setLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  // appointment form
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [apptAssignee, setApptAssignee] = useState('');
  const [apptNotes, setApptNotes] = useState('');
  const [savingAppt, setSavingAppt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [interactionText, setInteractionText] = useState('');
  const [interactionType, setInteractionType] = useState<InteractionType>('NOTE');
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [showInteractionForm, setShowInteractionForm] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
  });

  const currentStage = watch('stage');

  const loadAppointments = useCallback(async () => {
    const res = await appointmentsApi.list({ lead_id: id, limit: 50 });
    setAppointments(res.data);
  }, [id]);

  useEffect(() => {
    Promise.all([
      leadsApi.get(id),
      usersApi.list({ limit: 100 }),
      appointmentsApi.list({ lead_id: id, limit: 50 }),
    ]).then(([leadRes, usersRes, apptRes]) => {
      setLead(leadRes.data);
      setUsers(usersRes.data.filter((u) => u.is_active && !u.client_id));
      setAppointments(apptRes.data);
      reset({
        name: leadRes.data.name,
        contact_name: leadRes.data.contact_name ?? '',
        contact_email: leadRes.data.contact_email ?? '',
        contact_phone: leadRes.data.contact_phone ?? '',
        website: leadRes.data.website ?? '',
        stage: leadRes.data.stage,
        origin: leadRes.data.origin ?? '',
        estimated_value: leadRes.data.estimated_value ?? '',
        street: leadRes.data.street ?? '',
        state: leadRes.data.state ?? '',
        notes: leadRes.data.notes ?? '',
        lost_reason: leadRes.data.lost_reason ?? '',
        owner_id: leadRes.data.owner_id ?? '',
      });
    }).finally(() => setLoading(false));
  }, [id, reset]);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await leadsApi.update(id, {
        name: data.name,
        contact_name: data.contact_name || undefined,
        contact_email: data.contact_email || undefined,
        contact_phone: data.contact_phone || undefined,
        website: data.website || undefined,
        stage: data.stage,
        origin: (data.origin || undefined) as LeadOrigin | undefined,
        estimated_value: data.estimated_value ? Number(data.estimated_value) : undefined,
        street: data.street || undefined,
        state: data.state || undefined,
        notes: data.notes || undefined,
        lost_reason: data.lost_reason || undefined,
        owner_id: data.owner_id || undefined,
      });
      setLead(res.data);
      setSuccess('Lead atualizado com sucesso');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao atualizar.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddInteraction = async () => {
    if (!interactionText.trim()) return;
    setAddingInteraction(true);
    try {
      await leadsApi.addInteraction(id, interactionType, interactionText.trim());
      const res = await leadsApi.get(id);
      setLead(res.data);
      setInteractionText('');
      setShowInteractionForm(false);
    } catch {
      setError('Erro ao registrar interação.');
    } finally {
      setAddingInteraction(false);
    }
  };

  const handleSaveAppointment = async () => {
    if (!apptDate || !apptTime) return;
    setSavingAppt(true);
    try {
      const scheduled_at = new Date(`${apptDate}T${apptTime}:00`).toISOString();
      await appointmentsApi.create({
        lead_id: id,
        scheduled_at,
        assigned_to_id: apptAssignee || undefined,
        notes: apptNotes || undefined,
      });
      await loadAppointments();
      setShowApptForm(false);
      setApptDate(''); setApptTime(''); setApptAssignee(''); setApptNotes('');
    } catch {
      setError('Erro ao criar agendamento.');
    } finally {
      setSavingAppt(false);
    }
  };

  const handleDelete = async () => {
    if (!lead || !confirm(`Excluir lead "${lead.name}"?`)) return;
    try {
      await leadsApi.delete(id);
      router.push('/leads');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Erro ao excluir.'));
    }
  };

  if (loading) return <div className="text-sm text-gray-400 py-16 text-center">Carregando...</div>;
  if (!lead) return <div className="text-sm text-gray-500 py-16 text-center">Lead não encontrado.</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Tooltip text="Voltar para a lista de leads" position="right">
          <Link href="/leads" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ChevronLeft size={18} />
          </Link>
        </Tooltip>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{lead.name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[lead.stage]}`}>
              {STAGE_LABELS[lead.stage]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            Criado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(lead.created_at))}
          </p>
        </div>
        <Tooltip text="Excluir este lead do sistema">
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors">
            <Trash2 size={15} /> Excluir
          </button>
        </Tooltip>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{success}</div>}

      <div className="grid grid-cols-1 gap-4">
        {/* Edit form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Dados do lead</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Empresa / Nome</label>
            <input {...register('name')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contato</label>
              <input {...register('contact_name')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
              <input {...register('contact_phone')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <input {...register('contact_email')} type="email"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {errors.contact_email && <p className="text-red-500 text-xs mt-1">{errors.contact_email.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
            <input {...register('website')} placeholder="https://www.site.com.br"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
              <select {...register('state')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Selecionar...</option>
                {BR_STATES.map(({ uf, name }) => (
                  <option key={uf} value={uf}>{uf} — {name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rua / Endereço</label>
              <input {...register('street')} placeholder="Rua das Flores, 123"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
              <select {...register('stage')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Origem</label>
              <select {...register('origin')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Selecionar...</option>
                {ORIGINS.map((o) => <option key={o} value={o}>{ORIGIN_LABELS[o]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Responsável</label>
            <select {...register('owner_id')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Sem responsável</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {currentStage === 'LOST' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo da perda</label>
              <input {...register('lost_reason')} placeholder="Por que o lead foi perdido?"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
            <textarea {...register('notes')} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="pt-2 flex justify-end">
            <Tooltip text="Salvar as alterações do lead">
              <button type="submit" disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors">
                {isLoading ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </Tooltip>
          </div>
        </form>

        {/* Interactions */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Histórico de interações</h2>
            <Tooltip text="Registrar nova interação com o lead">
              <button
                onClick={() => setShowInteractionForm(!showInteractionForm)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={13} /> Registrar
              </button>
            </Tooltip>
          </div>

          {showInteractionForm && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex gap-2">
                {INTERACTION_TYPES.map((t) => (
                  <Tooltip key={t} text={`Tipo: ${INTERACTION_LABELS[t]}`}>
                    <button
                      onClick={() => setInteractionType(t)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        interactionType === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {INTERACTION_ICONS[t]}
                      {INTERACTION_LABELS[t]}
                    </button>
                  </Tooltip>
                ))}
              </div>
              <textarea
                value={interactionText}
                onChange={(e) => setInteractionText(e.target.value)}
                placeholder="Descreva a interação..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex justify-end gap-2">
                <Tooltip text="Cancelar sem salvar">
                  <button onClick={() => setShowInteractionForm(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                </Tooltip>
                <Tooltip text="Salvar a interação registrada">
                  <button
                    onClick={handleAddInteraction}
                    disabled={addingInteraction || !interactionText.trim()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    {addingInteraction ? '...' : 'Salvar'}
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          {lead.interactions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Nenhuma interação registrada</p>
          ) : (
            <div className="space-y-3">
              {lead.interactions.map((interaction) => (
                <div key={interaction.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    {INTERACTION_ICONS[interaction.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">
                        {INTERACTION_LABELS[interaction.type]}
                      </span>
                      {interaction.user && (
                        <span className="text-xs text-gray-400">por {interaction.user.name}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{interaction.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(interaction.created_at))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agendamentos */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Agendamentos</h2>
            <Tooltip text="Criar um agendamento vinculado a este lead">
              <button
                onClick={() => setShowApptForm(!showApptForm)}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={13} /> Agendar reunião
              </button>
            </Tooltip>
          </div>

          {showApptForm && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Data</label>
                  <input
                    type="date"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Horário</label>
                  <input
                    type="time"
                    value={apptTime}
                    onChange={(e) => setApptTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Responsável pela reunião</label>
                <select
                  value={apptAssignee}
                  onChange={(e) => setApptAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Selecionar...</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <textarea
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                placeholder="Observações do agendamento..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex justify-end gap-2">
                <Tooltip text="Cancelar sem salvar">
                  <button onClick={() => setShowApptForm(false)}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                    Cancelar
                  </button>
                </Tooltip>
                <Tooltip text="Confirmar e criar o agendamento">
                  <button
                    onClick={handleSaveAppointment}
                    disabled={savingAppt || !apptDate || !apptTime}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    {savingAppt ? '...' : 'Agendar'}
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          {appointments.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Nenhum agendamento</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Clock size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-gray-700">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(a.scheduled_at))}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </div>
                    {a.assigned_to && (
                      <p className="text-xs text-gray-500">Responsável: <span className="text-gray-700">{a.assigned_to.name}</span></p>
                    )}
                    {a.notes && <p className="text-xs text-gray-500 mt-0.5">{a.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
