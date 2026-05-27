import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addWeeks, addDays, parseISO, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Loader2, Repeat2, Trash2, AlertTriangle } from 'lucide-react';

const EMPTY = {
  client_id: '', client_name: '', professional_id: '', professional_name: '',
  service_id: '', service_name: '', date: format(new Date(), 'yyyy-MM-dd'),
  time: '09:00', end_time: '', duration_minutes: 60, price: 0,
  status: 'agendado', notes: '', payment_status: 'pendente', recurring_group_id: '',
};

const RECURRENCE_OPTIONS = [
  { value: 'weekly',       label: 'Toda semana' },
  { value: 'biweekly',     label: 'Quinzenal (semana sim, não)' },
  { value: 'triweekly',    label: 'A cada 3 semanas' },
  { value: 'monthly',      label: 'Mensal' },
  { value: 'every4weeks',  label: 'A cada 4 semanas' },
  { value: 'every6weeks',  label: 'A cada 6 semanas' },
  { value: 'every8weeks',  label: 'A cada 8 semanas' },
  { value: 'every12weeks', label: 'A cada 12 semanas' },
];

function generateDates(startDate, frequency, untilDate) {
  const dates = [];
  let cur = new Date(startDate + 'T12:00:00');
  const until = new Date(untilDate + 'T23:59:59');

  const stepFn = {
    weekly:       d => addWeeks(d, 1),
    biweekly:     d => addWeeks(d, 2),
    triweekly:    d => addWeeks(d, 3),
    monthly:      d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; },
    every4weeks:  d => addWeeks(d, 4),
    every6weeks:  d => addWeeks(d, 6),
    every8weeks:  d => addWeeks(d, 8),
    every12weeks: d => addWeeks(d, 12),
  }[frequency];

  if (!stepFn) return dates;

  // Skip first (it's the base appointment)
  cur = stepFn(cur);

  while (cur <= until) {
    dates.push(format(cur, 'yyyy-MM-dd'));
    cur = stepFn(cur);
    if (dates.length > 100) break; // safety
  }
  return dates;
}

export default function AppointmentModal({ open, onClose, onSave, onDelete, appointment, prefill, allAppointments = [] }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Recurrence
  const [recurring, setRecurring] = useState(false);
  const [recFrequency, setRecFrequency] = useState('weekly');
  const [recUntil, setRecUntil] = useState('');
  const previewDates = recurring && recUntil && form.date
    ? generateDates(form.date, recFrequency, recUntil)
    : [];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list(),
  });
  const { data: professionals = [] } = useQuery({
    queryKey: ['professionals'],
    queryFn: () => base44.entities.Professional.list(),
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list(),
  });

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setForm({ ...EMPTY, ...appointment });
      setRecurring(false);
    } else {
      setForm({
        ...EMPTY,
        date: prefill?.date || format(new Date(), 'yyyy-MM-dd'),
        time: prefill?.time || '09:00',
        professional_id: prefill?.professional_id || '',
        professional_name: prefill?.professional_name || '',
      });
      setRecurring(false);
    }
    setDeleteConfirm(false);
    setRecUntil('');
  }, [open, appointment, prefill]);

  const calcEndTime = (time, duration) => {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + duration;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  const handleClientChange = (id) => {
    const c = clients.find(x => x.id === id);
    setForm(f => ({ ...f, client_id: id, client_name: c?.full_name || '' }));
  };

  const handleProfChange = (id) => {
    const p = professionals.find(x => x.id === id);
    setForm(f => ({ ...f, professional_id: id, professional_name: p?.full_name || '' }));
  };

  const handleServiceChange = (id) => {
    const s = services.find(x => x.id === id);
    if (!s) return;
    setForm(f => ({
      ...f, service_id: id, service_name: s.name,
      duration_minutes: s.duration_minutes, price: s.price,
      end_time: calcEndTime(f.time, s.duration_minutes),
    }));
  };

  const handleTimeChange = (time) => {
    setForm(f => ({
      ...f, time,
      end_time: f.duration_minutes ? calcEndTime(time, f.duration_minutes) : f.end_time,
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    const groupId = recurring && previewDates.length > 0
      ? `rec_${Date.now()}`
      : '';
    const payload = { ...form, recurring_group_id: groupId };
    await onSave(payload, recurring ? { enabled: true, dates: previewDates } : null);
    setSaving(false);
    onClose();
  };

  const handleDelete = async (deleteAll = false) => {
    setSaving(true);
    await onDelete(appointment.id, deleteAll, appointment.recurring_group_id);
    setSaving(false);
    setDeleteConfirm(false);
    onClose();
  };

  const isNew = !appointment;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">
            {isNew ? 'Novo Agendamento' : 'Editar Agendamento'}
          </DialogTitle>
        </DialogHeader>

        {/* Delete confirm overlay */}
        {deleteConfirm && appointment && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Confirmar exclusão
            </div>
            <p className="text-sm text-red-600">
              {appointment.recurring_group_id
                ? 'Este agendamento faz parte de uma série recorrente.'
                : 'Tem certeza que deseja excluir este agendamento?'}
            </p>
            {appointment.recurring_group_id ? (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => handleDelete(false)}>
                  Excluir apenas este
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleDelete(true)}>
                  Excluir este e os futuros
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => handleDelete(false)}>
                  Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(false)}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Cliente */}
          <div>
            <Label>Cliente *</Label>
            <Select value={form.client_id} onValueChange={handleClientChange}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Profissional */}
            <div>
              <Label>Profissional *</Label>
              <Select value={form.professional_id} onValueChange={handleProfChange}>
                <SelectTrigger><SelectValue placeholder="Profissional" /></SelectTrigger>
                <SelectContent>
                  {professionals.filter(p => p.status === 'ativo').map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Serviço */}
            <div>
              <Label>Serviço *</Label>
              <Select value={form.service_id} onValueChange={handleServiceChange}>
                <SelectTrigger><SelectValue placeholder="Serviço" /></SelectTrigger>
                <SelectContent>
                  {services.filter(s => s.active).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — R${s.price}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data */}
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>

            {/* Horário */}
            <div>
              <Label>Horário *</Label>
              <Input type="time" value={form.time} onChange={e => handleTimeChange(e.target.value)} />
            </div>

            {/* Duração */}
            <div>
              <Label>Duração (min)</Label>
              <Input
                type="number"
                value={form.duration_minutes}
                onChange={e => {
                  const d = Number(e.target.value);
                  setForm(f => ({ ...f, duration_minutes: d, end_time: calcEndTime(f.time, d) }));
                }}
              />
            </div>

            {/* Valor */}
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="falta">Falta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pagamento */}
            <div>
              <Label>Pagamento</Label>
              <Select value={form.payment_status} onValueChange={v => setForm(f => ({ ...f, payment_status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas sobre o agendamento..." rows={2} />
          </div>

          {/* Recorrência — só para novos */}
          {isNew && (
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 space-y-3">
              <button
                type="button"
                onClick={() => setRecurring(r => !r)}
                className="flex items-center gap-2 text-sm font-semibold w-full"
              >
                <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${recurring ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${recurring ? 'translate-x-4' : ''}`} />
                </div>
                <Repeat2 className="w-4 h-4 text-primary" />
                Fixar cliente (recorrência)
              </button>

              {recurring && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Frequência</Label>
                      <Select value={recFrequency} onValueChange={setRecFrequency}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECURRENCE_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Repetir até</Label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={recUntil}
                        min={form.date}
                        onChange={e => setRecUntil(e.target.value)}
                      />
                    </div>
                  </div>

                  {previewDates.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">
                        {previewDates.length} agendamento(s) adicionais serão criados:
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {previewDates.map(d => (
                          <span
                            key={d}
                            className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium"
                          >
                            {format(parseISO(d), "dd/MM", { locale: ptBR })}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {recurring && !recUntil && (
                    <p className="text-xs text-amber-600">Selecione a data final da recorrência</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2">
          <div>
            {!isNew && !deleteConfirm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirm(true)}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.client_id || !form.service_id || !form.professional_id || (recurring && !recUntil)}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isNew
                ? recurring && previewDates.length > 0
                  ? `Agendar (${previewDates.length + 1} datas)`
                  : 'Agendar'
                : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
