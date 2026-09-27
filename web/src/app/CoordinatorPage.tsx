/** @archivo CoordinatorPage.tsx @descripcion Bandeja y acuerdo bilateral con datos reales del servidor. */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarCheck, RefreshCw, History, Handshake, Play } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from '../lib/api/resources';
import { canCommand, canStart, useCoordinator } from '../lib/api/coordinator';
import { CoordinatorCommandForm } from './CoordinatorForms';
import { coordinatorActions, coordinatorDate, coordinatorStates, quoteDate } from './coordinatorPresentation';
import type { CoordinatorAction, CoordinatorList, CoordinatorWorkflow } from '../../../shared/coordinator';
import './pricing.css';
import './coordinator.css';

const coverage = { included: 'Incluidos', excluded: 'Excluidos', unknown: 'Por confirmar' };
const units = { hour: 'Horas de trabajo', m2: 'Metros cuadrados', unit: 'Unidades', job: 'Trabajo completo' };

/** Remonta los datos y los borradores al cambiar de identidad o de trabajo. */
export function CoordinatorPage() {
  const { jobId = '' } = useParams(); const { user, role } = useAuth();
  return <CoordinatorDetail key={(user?.id ?? '') + ':' + role + ':' + jobId} jobId={jobId} />;
}

/** Detalle sin efectos que envien comandos ni aceptaciones implicitas. */
function CoordinatorDetail({ jobId }: { jobId: string }) {
  const coordinator = useCoordinator(jobId);
  const { view, busy, error, failedAttempt } = coordinator;
  const [acknowledged, setAcknowledged] = useState(false);
  const [selected, setSelected] = useState<CoordinatorAction | null>(null);
  const [saved, setSaved] = useState('');
  const now = Date.now();
  const workflow = view?.workflow;
  const blocked = busy || Boolean(failedAttempt);

  const actions = view?.advice.actions.filter(action => canCommand(view, action, now)) ?? [];
  return <DashboardLayout><div className="coordinator-page" aria-busy={busy}>
    <Link className="coordinator-back" to="/dashboard/coordination"><ArrowLeft size={17} />Bandeja de coordinacion</Link>
    <header className="coordinator-heading"><div><h1>Coordinacion del trabajo</h1><p>{view?.job.title ?? 'Detalle del acuerdo'}</p></div>
      <button className="ofi-btn-secondary coordinator-icon" title="Actualizar coordinacion" aria-label="Actualizar coordinacion" disabled={busy} onClick={() => { setSaved(''); void coordinator.reload(); }}><RefreshCw size={18} /></button></header>
    {busy && <p role="status">Consultando coordinacion...</p>}
    {error && <div className="coordinator-error" role="alert"><p>{error}</p>
      {!failedAttempt && <button className="ofi-btn-secondary" disabled={busy} onClick={() => { void coordinator.reload(); }}><RefreshCw size={17} />Reintentar consulta</button>}</div>}
    {failedAttempt && <section className="coordinator-pending" aria-label="Operacion sin confirmar">
      <h2>Operacion sin confirmar</h2><p>La operacion pudo haberse aplicado. El reintento conserva la misma solicitud. Consulta el estado antes de enviar una nueva.</p>
      <div className="coordinator-buttons">
        <button className="ofi-btn-primary" disabled={busy} onClick={() => { void coordinator.retry().then(ok => { if (ok) { setSelected(null); setSaved('Operacion confirmada por el servidor.'); } }); }}><RefreshCw size={17} />Reintentar operacion</button>
        <button className="ofi-btn-secondary" disabled={busy} onClick={() => { void coordinator.discardAndReload().then(ok => { if (ok) setSelected(null); }); }}>Actualizar y descartar reintento</button>
      </div>
    </section>}
    {saved && <p role="status">{saved}</p>}
    {view && <>
      <section className="coordinator-summary" aria-label="Resumen del trabajo"><div><h2>{view.job.category}</h2><p>{view.job.description}</p></div>
        <div><p>{[view.job.location.city, view.job.location.province].filter(Boolean).join(', ') || 'Ubicacion por confirmar'}</p>
          <strong>{workflow ? coordinatorStates[workflow.state] : 'Sin coordinacion iniciada'}</strong></div></section>
      <section className="coordinator-section" aria-label="Siguiente paso"><h2>Siguiente paso</h2><p>{view.advice.message}</p>
        {view.advice.waitingFor && <p>Esperando a: {view.advice.waitingFor === 'empresa' ? 'la empresa' : 'el profesional'}.</p>}
        <p>Las notificaciones son internas de OfiAI. No se envian emails ni WhatsApp y no se realizan cobros.</p>
        {(!workflow || workflow.state === 'CANCELLED') && (canStart(view) ? <form onSubmit={event => {
          event.preventDefault(); setSaved('');
          if (acknowledged) void coordinator.start(acknowledged).then(ok => { if (ok) setSaved('Coordinacion iniciada.'); });
        }}>
          <p>Puedes iniciar con una estimacion insuficiente para solicitar un presupuesto; no equivale a aceptar un precio.</p>
          <label className="coordinator-consent"><input type="checkbox" required checked={acknowledged} disabled={blocked} onChange={event => setAcknowledged(event.target.checked)} />
            <span>Reconozco que la estimacion es orientativa, no es una oferta ni autoriza una contratacion o un cobro.</span></label>
          <button className="ofi-btn-primary" disabled={blocked || !acknowledged}><Handshake size={17} />{workflow ? 'Reiniciar coordinacion' : 'Iniciar coordinacion'}</button>
        </form> : <p>{view.role === 'empresa' ? 'El trabajo debe estar publicado para iniciar otra coordinacion.' : 'La empresa debe iniciar la coordinacion.'}</p>)}
      </section>
      {workflow && <>
        <section className="coordinator-section" aria-label="Participantes"><h2>Acuerdo con {workflow.professionalName}</h2>
          <p>Tu rol: {view.role === 'empresa' ? 'Empresa' : 'Profesional'} · Revision {workflow.revision}</p>
          {workflow.pricingInsufficient && <p className="coordinator-warning">La estimacion tiene informacion insuficiente. Es posible solicitar un presupuesto, pero no hay un precio estimado confirmado.</p>}
          {workflow.completionRequested && <p>{workflow.state === 'COMPLETED' ? 'Finalizacion confirmada por la empresa.' : 'El profesional solicito confirmar la finalizacion.'}</p>}
        </section>
        <Agreement workflow={workflow} />
        <section className="coordinator-section" aria-label="Acciones disponibles"><h2>Acciones disponibles</h2>
          {!actions.length && <p>No hay acciones disponibles para tu rol en este momento.</p>}
          {view.role === 'profesional' && workflow.state === 'CONFIRMED' && workflow.schedule && Date.parse(workflow.schedule.startsAt) > now
            && <p><Play size={16} /> El inicio se habilita desde {coordinatorDate(workflow.schedule.startsAt)}.</p>}
          <div className="coordinator-buttons">{actions.map(action => {
            const definition = coordinatorActions[action]; const Icon = definition.icon;
            return <button key={action} className="ofi-btn-secondary" disabled={blocked} aria-pressed={selected === action}
              onClick={() => { setSelected(action); setSaved(''); }}><Icon size={17} />{definition.label}</button>;
          })}</div>
          {selected && actions.includes(selected) && <CoordinatorCommandForm key={workflow.id + ':' + workflow.revision + ':' + selected}
            action={selected} view={view} disabled={blocked} onClose={() => setSelected(null)}
            onSubmit={async input => { const ok = await coordinator.command(input); if (ok) setSaved('Operacion confirmada por el servidor.'); return ok; }} />}
        </section>
      </>}
      <section className="coordinator-section"><h2><History size={18} /> Historial</h2>
        {view.history.length ? <ol className="coordinator-history">{view.history.map(row => <li key={row.revision}>
          <strong>{row.action === 'started' ? 'Coordinacion iniciada' : row.action === 'invitation_delivered'
            ? 'Invitacion interna entregada' : coordinatorActions[row.action as CoordinatorAction]?.label ?? 'Actualizacion de coordinacion'}</strong>
          <p>{coordinatorStates[row.from]} / {coordinatorStates[row.to]}</p>
          <p>{row.actor === 'system' ? 'Sistema' : row.actor === 'empresa' ? 'Empresa' : 'Profesional'} · Revision {row.revision} · <time dateTime={row.at}>{coordinatorDate(row.at)}</time></p>
          {row.note && <p>{row.note}</p>}
        </li>)}</ol> : <p>Aun no hay movimientos.</p>}
      </section>
    </>}
  </div></DashboardLayout>;
}

/** Muestra todos los terminos vigentes, diferenciando propuesta y acuerdo confirmado. */
function Agreement({ workflow }: { workflow: CoordinatorWorkflow }) {
  const offer = workflow.offer; const quote = offer?.quote; const schedule = workflow.schedule;
  return <div className="coordinator-agreement">
    <section className="coordinator-section"><h2><Handshake size={18} /> Oferta y condiciones</h2>
      {quote && offer ? <>
        <p><strong>{offer.accepted ? 'Oferta aceptada' : 'Oferta pendiente de aceptacion'}</strong></p>
        <p>Propuesta por: {offer.proposedBy === 'empresa' ? 'Empresa' : 'Profesional'}</p>
        <h3>{quote.label}</h3><p>Importe total del alcance</p><p className="coordinator-amount">{quote.amount.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {quote.currency}</p>
        <dl><div><dt>Alcance</dt><dd>{quote.scope}</dd></div><div><dt>Unidad y cantidad</dt><dd>{units[quote.unit]}: {quote.quantity}</dd></div>
          <div><dt>Materiales</dt><dd>{coverage[quote.materials]}</dd></div><div><dt>Impuestos</dt><dd>{coverage[quote.taxes]}</dd></div>
          <div><dt>Validez</dt><dd>{quoteDate(quote.validUntil)}</dd></div></dl>
      </> : <p>Aun no hay una oferta. La estimacion no reemplaza un presupuesto.</p>}
    </section>
    <section className="coordinator-section"><h2><CalendarCheck size={18} /> Fecha acordada</h2>
      {schedule ? <><p><strong>{schedule.confirmed ? 'Fecha confirmada' : 'Fecha propuesta, sin confirmar'}</strong></p>
        <p>Propuesta por: {schedule.proposedBy === 'empresa' ? 'Empresa' : 'Profesional'}</p>
        <dl><div><dt>Inicio</dt><dd><time dateTime={schedule.startsAt}>{coordinatorDate(schedule.startsAt)}</time></dd></div>
          <div><dt>Fin</dt><dd><time dateTime={schedule.endsAt}>{coordinatorDate(schedule.endsAt)}</time></dd></div></dl></> : <p>Aun no hay fecha propuesta.</p>}
    </section>
  </div>;
}

/** Aisla tambien los cursores de la bandeja entre cuentas. */
export function CoordinationInboxPage() {
  const { user, role } = useAuth();
  return <CoordinationInbox key={(user?.id ?? '') + ':' + role} />;
}

/** Pagina por cursor del servidor; no accede directamente a Firestore. */
function CoordinationInbox() {
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const cursor = cursors[cursors.length - 1];
  const resource = useApiResource<CoordinatorList>('/coordinator' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
  return <DashboardLayout><div className="coordinator-page" aria-busy={resource.loading}>
    <header className="coordinator-heading"><div><h1>Coordinaciones</h1><p>Acuerdos y trabajos de tu cuenta</p></div>
      <button className="ofi-btn-secondary coordinator-icon" title="Actualizar bandeja" aria-label="Actualizar bandeja" disabled={resource.loading} onClick={resource.reload}><RefreshCw size={18} /></button></header>
    {resource.loading && <p role="status">Cargando coordinaciones...</p>}
    {resource.error && <div role="alert" className="coordinator-error"><p>{resource.error}</p><button className="ofi-btn-secondary" onClick={resource.reload}><RefreshCw size={17} />Reintentar consulta</button></div>}
    {!resource.loading && resource.data?.items.length === 0 && <p>No hay coordinaciones en esta pagina.</p>}
    <ul className="coordinator-inbox">{resource.data?.items.map(item => <li key={item.jobId}>
      <Link to={'/dashboard/coordination/' + encodeURIComponent(item.jobId)}><div><h2>{item.title}</h2>
        <p>{coordinatorStates[item.state]}</p><time dateTime={item.updatedAt}>{coordinatorDate(item.updatedAt)}</time></div><ArrowRight size={20} aria-hidden="true" /></Link>
    </li>)}</ul>
    <nav className="coordinator-pagination" aria-label="Paginas de coordinaciones">
      <button className="ofi-btn-secondary" disabled={resource.loading || cursors.length === 1} onClick={() => setCursors(previous => previous.slice(0, -1))}><ArrowLeft size={17} />Anterior</button>
      <span>Pagina {cursors.length}</span>
      <button className="ofi-btn-secondary" disabled={resource.loading || !resource.data?.nextCursor} onClick={() => {
        const next = resource.data?.nextCursor; if (next) setCursors(previous => [...previous, next]);
      }}>Siguiente<ArrowRight size={17} /></button>
    </nav>
  </div></DashboardLayout>;
}
