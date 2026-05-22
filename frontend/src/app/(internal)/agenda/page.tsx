'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, ExternalLink,
  Search, Loader2, CheckCircle, XCircle,
} from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { appointmentsApi, Appointment, AppointmentStatus } from '@/lib/api/appointments';
import { leadsApi, Lead } from '@/lib/api/leads';
import { usersApi, AppUser } from '@/lib/api/users';
import { useAuthStore } from '@/stores/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type View = 'day' | 'week' | 'month';

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_H = 64; // px per hour in week/day view

const DAYS_PT   = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const DURATION_OPTIONS = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 60,  label: '1 hora' },
  { value: 90,  label: '1h 30min' },
  { value: 120, label: '2 horas' },
  { value: 180, label: '3 horas' },
];

const STATUS_COLORS: Record<AppointmentStatus, { pill: string; block: string }> = {
  PENDING:   { pill: 'bg-blue-100 text-blue-700',    block: 'bg-blue-500 border-blue-600' },
  DONE:      { pill: 'bg-green-100 text-green-700',  block: 'bg-emerald-500 border-emerald-600' },
  CANCELLED: { pill: 'bg-gray-100 text-gray-500',    block: 'bg-gray-400 border-gray-500' },
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente', DONE: 'Realizada', CANCELLED: 'Cancelada',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function weekDays(ref: Date): Date[] {
  const s = startOfWeek(ref);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

function monthGrid(ref: Date): Date[][] {
  const y = ref.getFullYear(), m = ref.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const lastDay  = new Date(y, m + 1, 0).getDate();
  const cells: Date[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push(new Date(y, m, -i));
  for (let d = 1; d <= lastDay; d++) cells.push(new Date(y, m, d));
  while (cells.length % 7 !== 0) {
    cells.push(new Date(y, m + 1, cells.length - firstDay - lastDay + 1));
  }
  const rows: Date[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function timeFmt(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function gcalUrl(appt: Appointment, leadName: string): string {
  const s = new Date(appt.scheduled_at);
  const e = new Date(s.getTime() + (appt.duration_minutes ?? 60) * 60000);
  const iso = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const params = new URLSearchParams({
    action:  'TEMPLATE',
    text:    `Reunião — ${leadName}`,
    dates:   `${iso(s)}/${iso(e)}`,
    details: appt.notes ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

// ── CurrentTimeLine ───────────────────────────────────────────────────────────

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const top = (now.getHours() + now.getMinutes() / 60) * HOUR_H;
  return (
    <div style={{ top }} className="absolute inset-x-0 flex items-center z-10 pointer-events-none">
      <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5 flex-shrink-0 shadow" />
      <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
    </div>
  );
}

// ── EventBlock ────────────────────────────────────────────────────────────────

function EventBlock({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const start  = new Date(appt.scheduled_at);
  const top    = (start.getHours() + start.getMinutes() / 60) * HOUR_H;
  const height = Math.max(((appt.duration_minutes ?? 60) / 60) * HOUR_H - 2, 22);
  const { block } = STATUS_COLORS[appt.status];

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ top, height, left: 2, right: 2 }}
      className={`absolute rounded-lg px-2 py-1 cursor-pointer select-none overflow-hidden text-white border-l-[3px] shadow hover:brightness-110 transition-all ${block}`}
    >
      <p className="text-xs font-semibold leading-snug truncate">
        {timeFmt(start)} — {appt.lead?.name ?? '—'}
      </p>
      {height > 44 && appt.notes && (
        <p className="text-xs opacity-80 truncate mt-0.5">{appt.notes}</p>
      )}
    </div>
  );
}

// ── TimeGrid (shared by week + day views) ────────────────────────────────────

function TimeGrid({
  days, appointments, onSlotClick, onEventClick,
}: {
  days: Date[];
  appointments: Appointment[];
  onSlotClick: (d: Date) => void;
  onEventClick: (a: Appointment) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H - 40;
  }, []);

  const apptByDay = useMemo(() => {
    const map: Record<number, Appointment[]> = {};
    appointments.forEach((a) => {
      const idx = days.findIndex((d) => sameDay(d, new Date(a.scheduled_at)));
      if (idx >= 0) {
        map[idx] = map[idx] ?? [];
        map[idx].push(a);
      }
    });
    return map;
  }, [appointments, days]);

  return (
    <>
      {/* Day headers */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        <div className="w-14 flex-shrink-0 border-r border-gray-100" />
        {days.map((day, i) => {
          const isToday = sameDay(day, new Date());
          return (
            <div key={i} className="flex-1 text-center py-2.5 border-l border-gray-100 first:border-l-0">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                {DAYS_PT[day.getDay()]}
              </p>
              <div className={`mx-auto mt-1 w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div style={{ height: 24 * HOUR_H }} className="flex">
          {/* Time labels */}
          <div className="w-14 flex-shrink-0 border-r border-gray-100 relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                style={{ top: h * HOUR_H - 9 }}
                className="absolute right-2 text-[11px] text-gray-400 tabular-nums select-none"
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Columns */}
          {days.map((day, i) => {
            const isToday = sameDay(day, new Date());
            return (
              <div
                key={i}
                className="flex-1 border-l border-gray-100 first:border-l-0 relative"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y    = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
                  const hour = Math.floor(y / HOUR_H);
                  const min  = Math.round(((y % HOUR_H) / HOUR_H) * 4) * 15;
                  const d    = new Date(day);
                  d.setHours(hour, min === 60 ? 0 : min, 0, 0);
                  if (min === 60) d.setHours(d.getHours() + 1);
                  onSlotClick(d);
                }}
              >
                {/* Hour lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ top: h * HOUR_H }} className="absolute inset-x-0 border-t border-gray-100" />
                ))}
                {/* Half-hour dashed */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ top: h * HOUR_H + HOUR_H / 2 }} className="absolute inset-x-0 border-t border-dashed border-gray-50" />
                ))}
                {/* Hover overlay */}
                <div className="absolute inset-0 hover:bg-blue-50/20 transition-colors cursor-pointer" />

                {isToday && <CurrentTimeLine />}

                {(apptByDay[i] ?? []).map((a) => (
                  <EventBlock key={a.id} appt={a} onClick={() => onEventClick(a)} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── MonthView ─────────────────────────────────────────────────────────────────

function MonthView({
  currentDate, appointments, onDayClick, onEventClick,
}: {
  currentDate: Date;
  appointments: Appointment[];
  onDayClick: (d: Date) => void;
  onEventClick: (a: Appointment) => void;
}) {
  const grid = monthGrid(currentDate);
  const todayD = new Date();

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-white flex-shrink-0">
        {DAYS_PT.map((d) => (
          <div key={d} className="text-center py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {grid.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7" style={{ minHeight: 120 }}>
            {row.map((day, ci) => {
              const isCurrent = day.getMonth() === currentDate.getMonth();
              const isToday   = sameDay(day, todayD);
              const dayAppts  = appointments.filter((a) => sameDay(new Date(a.scheduled_at), day));

              return (
                <div
                  key={ci}
                  onClick={() => onDayClick(day)}
                  className={`border-r border-b border-gray-100 p-1.5 cursor-pointer hover:bg-gray-50/80 transition-colors ${
                    !isCurrent ? 'bg-gray-50/40' : ''
                  }`}
                >
                  <div className={`w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 mx-auto ${
                    isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : isCurrent ? 'text-gray-800 font-medium' : 'text-gray-400'
                  }`}>
                    {day.getDate()}
                  </div>

                  {dayAppts.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(a); }}
                      className={`text-xs text-white rounded-md px-1.5 py-0.5 mb-0.5 truncate cursor-pointer hover:brightness-110 ${
                        STATUS_COLORS[a.status].block.split(' ')[0]
                      }`}
                    >
                      {timeFmt(new Date(a.scheduled_at))} {a.lead?.name ?? '—'}
                    </div>
                  ))}
                  {dayAppts.length > 3 && (
                    <p className="text-[11px] text-gray-400 px-1">+{dayAppts.length - 3} mais</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CreateModal ───────────────────────────────────────────────────────────────

function CreateModal({
  initialDate, users, onClose, onCreated,
}: {
  initialDate: Date;
  users: AppUser[];
  onClose: () => void;
  onCreated: (a: Appointment) => void;
}) {
  const { user: me } = useAuthStore();

  const [leadQuery,  setLeadQuery]  = useState('');
  const [leadList,   setLeadList]   = useState<Lead[]>([]);
  const [leadOpen,   setLeadOpen]   = useState(false);
  const [searching,  setSearching]  = useState(false);
  const [selLead,    setSelLead]    = useState<Lead | null>(null);

  const [date,     setDate]    = useState(initialDate.toISOString().slice(0, 10));
  const [time,     setTime]    = useState(`${String(initialDate.getHours()).padStart(2, '0')}:${String(initialDate.getMinutes()).padStart(2, '0')}`);
  const [duration, setDuration] = useState(60);
  const [assignee, setAssignee] = useState(me?.id ?? '');
  const [notes,    setNotes]   = useState('');

  const [saving,   setSaving]  = useState(false);
  const [created,  setCreated] = useState<Appointment | null>(null);

  useEffect(() => {
    if (leadQuery.length < 2) { setLeadList([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await leadsApi.list({ search: leadQuery, limit: 8 });
        setLeadList(r.data);
        setLeadOpen(true);
      } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [leadQuery]);

  const handleSave = async () => {
    if (!selLead) return;
    setSaving(true);
    try {
      const scheduled_at = new Date(`${date}T${time}:00`).toISOString();
      const res = await appointmentsApi.create({
        lead_id: selLead.id,
        scheduled_at,
        duration_minutes: duration,
        assigned_to_id: assignee || undefined,
        notes: notes || undefined,
      });
      setCreated(res.data);
      onCreated(res.data);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {created ? 'Agendamento criado' : 'Novo agendamento'}
          </h2>
          <Tooltip text="Fechar">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        {created ? (
          /* ─ Success screen ─ */
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-sm text-green-800">
              Reunião com <strong>{created.lead?.name}</strong> agendada para{' '}
              <strong>{new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(created.scheduled_at))}</strong>.
            </div>
            <a
              href={gcalUrl(created, created.lead?.name ?? '')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 w-full justify-center px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ExternalLink size={15} className="text-blue-500" />
              Adicionar ao Google Calendar
            </a>
            <Tooltip text="Fechar esta janela">
              <button onClick={onClose}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                Fechar
              </button>
            </Tooltip>
          </div>
        ) : (
          /* ─ Form ─ */
          <div className="p-6 space-y-4">
            {/* Lead search */}
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Lead *</label>
              {selLead ? (
                <div className="flex items-center justify-between px-3 py-2.5 border border-blue-300 rounded-xl bg-blue-50">
                  <div>
                    <p className="text-sm font-semibold text-blue-800">{selLead.name}</p>
                    {selLead.contact_name && <p className="text-xs text-blue-500">{selLead.contact_name}</p>}
                  </div>
                  <Tooltip text="Remover lead selecionado">
                    <button onClick={() => { setSelLead(null); setLeadQuery(''); }} className="text-blue-300 hover:text-blue-600 p-1">
                      <X size={14} />
                    </button>
                  </Tooltip>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                    placeholder="Buscar lead por nome..."
                    className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                </div>
              )}
              {leadOpen && leadList.length > 0 && !selLead && (
                <div className="absolute z-30 inset-x-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                  {leadList.map((l) => (
                    <button key={l.id}
                      onClick={() => { setSelLead(l); setLeadOpen(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0">
                      <p className="text-sm font-medium text-gray-900">{l.name}</p>
                      {l.contact_name && <p className="text-xs text-gray-400">{l.contact_name}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Data</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Hora</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Duration + Assignee */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Duração</label>
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {DURATION_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Responsável</label>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">Sem responsável</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações / Pauta</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Tópicos da reunião, local, contexto..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex gap-2 pt-1">
              <Tooltip text="Cancelar e fechar sem salvar" className="flex-1">
                <button onClick={onClose}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </Tooltip>
              <Tooltip text="Confirmar e criar o agendamento" className="flex-1">
                <button onClick={handleSave} disabled={!selLead || saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                  {saving ? 'Criando...' : 'Criar reunião'}
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EventDetailModal ──────────────────────────────────────────────────────────

function EventDetailModal({
  appt, onClose, onUpdated, onDeleted,
}: {
  appt: Appointment;
  onClose: () => void;
  onUpdated: (a: Appointment) => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const markDone = () => act(async () => {
    const r = await appointmentsApi.update(appt.id, { status: 'DONE' });
    onUpdated(r.data);
  });

  const cancel = () => act(async () => {
    if (!confirm('Cancelar este agendamento?')) return;
    const r = await appointmentsApi.update(appt.id, { status: 'CANCELLED' });
    onUpdated(r.data);
  });

  const del = async () => {
    if (!confirm('Excluir este agendamento permanentemente?')) return;
    await appointmentsApi.remove(appt.id);
    onDeleted(appt.id);
  };

  const start = new Date(appt.scheduled_at);
  const end   = new Date(start.getTime() + (appt.duration_minutes ?? 60) * 60_000);
  const { pill } = STATUS_COLORS[appt.status];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        {/* Header strip */}
        <div className={`h-2 rounded-t-2xl ${STATUS_COLORS[appt.status].block.split(' ')[0]}`} />

        <div className="flex items-start justify-between px-5 py-4">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-base font-bold text-gray-900 truncate">{appt.lead?.name ?? '—'}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${pill}`}>
              {STATUS_LABEL[appt.status]}
            </span>
          </div>
          <Tooltip text="Fechar">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
              <X size={16} />
            </button>
          </Tooltip>
        </div>

        <div className="px-5 pb-2 space-y-3">
          {/* Date + time */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0 text-xs font-bold">
              {start.getDate()}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 capitalize">
                {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(start)}
              </p>
              <p className="text-sm text-gray-500">
                {timeFmt(start)} — {timeFmt(end)}{' '}
                <span className="text-gray-400 text-xs">({appt.duration_minutes ?? 60} min)</span>
              </p>
            </div>
          </div>

          {appt.assigned_to && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                {appt.assigned_to.name[0]}
              </div>
              <p className="text-sm text-gray-700">{appt.assigned_to.name}</p>
            </div>
          )}

          {appt.notes && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-0.5 font-medium">Pauta / Observações</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{appt.notes}</p>
            </div>
          )}

          {/* Google Calendar */}
          <a
            href={gcalUrl(appt, appt.lead?.name ?? '')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={14} className="text-blue-500 flex-shrink-0" />
            Adicionar / ver no Google Calendar
          </a>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-3">
          {appt.status === 'PENDING' ? (
            <div className="flex gap-2">
              <Tooltip text="Marcar este agendamento como realizado" className="flex-1">
                <button onClick={markDone} disabled={busy}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  <CheckCircle size={15} /> Realizada
                </button>
              </Tooltip>
              <Tooltip text="Marcar este agendamento como cancelado" className="flex-1">
                <button onClick={cancel} disabled={busy}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50">
                  <XCircle size={15} /> Cancelar
                </button>
              </Tooltip>
              <Tooltip text="Excluir este agendamento permanentemente">
                <button onClick={del} disabled={busy}
                  className="w-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors">
                  <X size={15} />
                </button>
              </Tooltip>
            </div>
          ) : (
            <Tooltip text="Excluir permanentemente este agendamento">
              <button onClick={del}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-400 hover:text-red-600 hover:border-red-200 transition-colors">
                Excluir agendamento
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AgendaPage ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const [view,        setView]        = useState<View>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users,       setUsers]       = useState<AppUser[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [createFor,   setCreateFor]   = useState<Date | null>(null);
  const [detailAppt,  setDetailAppt]  = useState<Appointment | null>(null);

  // Date range for the API call
  const range = useMemo(() => {
    if (view === 'day') {
      const s = new Date(currentDate); s.setHours(0, 0, 0, 0);
      const e = new Date(currentDate); e.setHours(23, 59, 59, 999);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    if (view === 'week') {
      const s = startOfWeek(currentDate);
      const e = addDays(s, 7);
      return { from: s.toISOString(), to: e.toISOString() };
    }
    // month — include extra days visible in the 6×7 grid
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const s = new Date(y, m, 1);
    s.setDate(s.getDate() - s.getDay());
    const e = new Date(y, m + 1, 0, 23, 59, 59);
    return { from: s.toISOString(), to: e.toISOString() };
  }, [view, currentDate]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await appointmentsApi.list({ date_from: range.from, date_to: range.to, limit: 500 });
      setAppointments(r.data);
    } finally { setLoading(false); }
  }, [range]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  useEffect(() => {
    usersApi.list({ limit: 100 })
      .then((r) => setUsers(r.data.filter((u) => u.is_active && !u.client_id)));
  }, []);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === 'day')   d.setDate(d.getDate() + dir);
      else if (view === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  };

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      }).format(currentDate);
    }
    if (view === 'week') {
      const days  = weekDays(currentDate);
      const first = days[0], last = days[6];
      if (first.getMonth() === last.getMonth()) {
        return `${MONTHS_PT[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${MONTHS_PT[first.getMonth()].slice(0,3)} — ${MONTHS_PT[last.getMonth()].slice(0,3)} ${last.getFullYear()}`;
    }
    return `${MONTHS_PT[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [view, currentDate]);

  const handleCreated = (a: Appointment) => setAppointments((p) => [...p, a]);
  const handleUpdated = (a: Appointment) => {
    setAppointments((p) => p.map((x) => (x.id === a.id ? a : x)));
    setDetailAppt(a);
  };
  const handleDeleted = (id: string) => {
    setAppointments((p) => p.filter((x) => x.id !== id));
    setDetailAppt(null);
  };

  return (
    <div className="flex flex-col -mx-6 -my-6 overflow-hidden" style={{ height: 'calc(100vh - 0px)' }}>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
        <Tooltip text="Ir para o dia atual">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3.5 py-1.5 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Hoje
          </button>
        </Tooltip>

        <div className="flex items-center">
          <Tooltip text="Período anterior">
            <button onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
              <ChevronLeft size={18} />
            </button>
          </Tooltip>
          <Tooltip text="Próximo período">
            <button onClick={() => navigate(1)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors">
              <ChevronRight size={18} />
            </button>
          </Tooltip>
        </div>

        <h1 className="text-base font-semibold text-gray-900 capitalize min-w-0 truncate">
          {headerLabel}
        </h1>

        {loading && (
          <Loader2 size={16} className="text-blue-500 animate-spin flex-shrink-0" />
        )}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {/* View switcher */}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden text-xs font-medium">
            {([
              { v: 'day',   label: 'Dia',    tip: 'Ver agenda do dia' },
              { v: 'week',  label: 'Semana', tip: 'Ver agenda da semana' },
              { v: 'month', label: 'Mês',    tip: 'Ver agenda do mês' },
            ] as const).map(({ v, label, tip }) => (
              <Tooltip key={v} text={tip} position="bottom">
                <button onClick={() => setView(v)}
                  className={`px-3.5 py-1.5 transition-colors ${
                    view === v ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              </Tooltip>
            ))}
          </div>

          <Tooltip text="Criar novo agendamento">
            <button
              onClick={() => setCreateFor(new Date())}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
            >
              <Plus size={15} /> Agendar
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── Calendar body ──────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden bg-white">
        {view === 'week' && (
          <TimeGrid
            days={weekDays(currentDate)}
            appointments={appointments}
            onSlotClick={setCreateFor}
            onEventClick={setDetailAppt}
          />
        )}
        {view === 'day' && (
          <TimeGrid
            days={[currentDate]}
            appointments={appointments}
            onSlotClick={setCreateFor}
            onEventClick={setDetailAppt}
          />
        )}
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            appointments={appointments}
            onDayClick={(d) => setCreateFor(d)}
            onEventClick={setDetailAppt}
          />
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {createFor && (
        <CreateModal
          initialDate={createFor}
          users={users}
          onClose={() => setCreateFor(null)}
          onCreated={handleCreated}
        />
      )}
      {detailAppt && (
        <EventDetailModal
          appt={detailAppt}
          onClose={() => setDetailAppt(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
