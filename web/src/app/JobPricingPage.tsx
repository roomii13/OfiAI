/** @archivo JobPricingPage.tsx @descripcion Estimaciones trazables, alcance editable y comparacion de presupuestos. */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calculator, History, RefreshCw, Save, Plus, AlertCircle } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../lib/api/pricing';
import type { PricingInputs, PricingQuote, PricingView } from '../../../shared/pricing';
import './pricing.css';
const empty: PricingInputs = { currency: 'ARS', scope: '', unit: 'hour', quantity: 1, materials: 'unknown', materialsCost: null, taxes: 'unknown', requiredExperienceYears: null };
const coverage = { included: 'Incluidos', excluded: 'Excluidos', unknown: 'Por confirmar' };
const units = { hour: 'Horas de trabajo', m2: 'Metros cuadrados', unit: 'Unidades', job: 'Trabajo completo' };
/** Formato monetario explicito, sin conversion. */
function money(value: number, currency: string): string { return value.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' ' + currency; }
/** Evita compartir estado entre cuentas y trabajos. */
export function JobPricingPage() {
  const { jobId = '' } = useParams(); const { user } = useAuth();
  return <PricingPage key={(user?.id ?? '') + jobId} jobId={jobId} />;
}
/** Presentacion de resultados calculados exclusivamente por backend. */
function PricingPage({ jobId }: { jobId: string }) {
  const pricing = usePricing(jobId); const view = pricing.view; const result = view?.result;
  const [inputs, setInputs] = useState<PricingInputs>(empty);
  const [quoteTerms, setQuoteTerms] = useState<PricingInputs>(empty);
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [until, setUntil] = useState('');
  const [quoteId, setQuoteId] = useState(() => crypto.randomUUID());
  const [saved, setSaved] = useState('');
  useEffect(() => { if (view) { const next = view.inputs ?? { ...empty, currency: view.job.budget.currency ?? 'ARS', scope: view.job.estimatedScope ?? '' }; setInputs(next); setQuoteTerms(next); } }, [view]);
  /** Registra una copia declarada del presupuesto, nunca una oferta emitida automaticamente. */
  async function addQuote(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setSaved('');
    const { materialsCost: _cost, requiredExperienceYears: _experience, ...terms } = quoteTerms;
    const quote: PricingQuote = { ...terms, id: quoteId, label, amount: Number(amount), validUntil: until };
    if (await pricing.saveQuote(quote)) { setLabel(''); setAmount(''); setUntil(''); setQuoteId(crypto.randomUUID()); setSaved('Presupuesto guardado.'); }
  }
  return <DashboardLayout><main className="pricing-page">
    <Link className="pricing-back" to={'/dashboard/company/jobs/' + encodeURIComponent(jobId) + '/matches'}><ArrowLeft size={17} />Profesionales</Link>
    <Link className="ofi-btn-secondary" to={'/dashboard/coordination/' + encodeURIComponent(jobId)}>Ir a coordinacion</Link>
    <header className="pricing-header"><div><span className="pricing-kicker"><Calculator size={18} />OFIAI · PRICING</span><h1>Estimacion del trabajo</h1><p>{view?.job.title ?? 'Analizando la solicitud'}</p></div>
      <button title="Actualizar estimacion" aria-label="Actualizar estimacion" className="ofi-btn-secondary" disabled={pricing.busy} onClick={() => { void pricing.reload(); }}><RefreshCw size={18} /></button></header>
    {pricing.error && <div className="pricing-error" role="alert">{pricing.error}<button className="ofi-btn-secondary" disabled={pricing.busy} onClick={() => { void pricing.reload(); }}>Reintentar</button></div>}
    {pricing.busy && <p role="status" className="pricing-status">OfiAI esta analizando el alcance y las referencias de precio...</p>}
    {saved && <p role="status">{saved}</p>}
    {view && <>
      <section className="pricing-summary" aria-label="Resumen del trabajo"><div><strong>{view.job.category}</strong><p>{view.job.location.city ?? 'Ubicacion por confirmar'} · {view.job.urgency ?? 'Urgencia por confirmar'}</p></div><p>{view.job.estimatedScope ?? view.job.description}</p></section>
      <section className="pricing-estimate" aria-label="Estimacion actual">
        <div><span className="pricing-kicker">RANGO ORIENTATIVO</span><h2>{result?.range ? money(result.range.min, result.currency) + ' a ' + money(result.range.max, result.currency) : 'Faltan referencias comparables'}</h2>
          <p>{result?.range ? 'Referencia central: ' + money(result.range.central, result.currency) : 'Completa el alcance y agrega un presupuesto recibido, o utiliza tarifas horarias disponibles.'}</p>
          <p>Estimacion, no precio final. No implica contratacion ni cobro.</p></div>
        <div className="pricing-confidence"><strong>Confianza {result?.confidence ?? 0}%</strong><progress max="100" value={result?.confidence ?? 0} aria-label="Confianza de la estimacion" /><span>{result?.evidenceCount ?? 0} referencias · {result?.semanticUsed ? 'Analisis con IA' : 'Criterios deterministas'}</span></div>
      </section>
      {result && <><div className="pricing-columns"><section><h2>Factores del precio</h2><ul>{result.factors.map(text => <li key={text}>{text}</li>)}</ul>{result.analysis && <p>{result.analysis}</p>}</section>
        <section><h2>Por confirmar</h2><ul>{[...result.missingInformation, ...result.warnings, ...result.assumptions].map((text, i) => <li key={i}>{text}</li>)}</ul></section></div>
        <details className="pricing-section"><summary>Referencias utilizadas ({result.evidence.length})</summary><ul>{result.evidence.map((e, i) => <li key={e.id}>{i + 1}. {e.source === 'rate' ? 'Tarifa publicada' : e.source === 'history' ? 'Historico propio aceptado' : 'Presupuesto declarado'}: {money(e.amount, e.currency)} / {e.quantity} {e.unit}. Materiales {coverage[e.materials].toLowerCase()}, impuestos {coverage[e.taxes].toLowerCase()}.</li>)}</ul></details></>}
      <details className="pricing-section" open={!view.inputs}><summary>Alcance y condiciones</summary>
        <form onSubmit={event => { event.preventDefault(); setSaved(''); void pricing.saveInputs(inputs).then(ok => { if (ok) setSaved('Alcance guardado y estimacion actualizada.'); }); }}>
          <PricingFields value={inputs} onChange={setInputs} /><button className="ofi-btn-primary" disabled={pricing.busy}><Save size={17} />Guardar y estimar</button>
        </form>
      </details>
      <section className="pricing-section"><h2>Presupuestos recibidos</h2><p>Registros declarados por tu empresa. No se contactara a profesionales.</p>
        <div className="pricing-quotes">{(result?.comparisons ?? view.quotes.map(q => ({ ...q, comparable: false, flag: 'unverified', explanation: 'Pendiente de recalculo.', normalizedAmount: null, deviationPercent: null }))).map(q => <article key={q.id} className="pricing-quote">
          <h3>{q.label}</h3><strong>{money(q.amount, q.currency)}</strong><span>{q.flag === 'high' ? 'Importe alto atipico' : q.flag === 'low' ? 'Importe bajo atipico' : q.comparable ? 'Comparable' : 'No comparable'}</span><p>{q.explanation}</p>{q.deviationPercent !== null && <p>Desvio frente a otros presupuestos: {q.deviationPercent}%</p>}
        </article>)}</div>
        {view.quotes.length === 0 && !result?.comparisons.length && <p>No hay presupuestos registrados.</p>}
        <details><summary><Plus size={17} />Agregar presupuesto recibido</summary><form onSubmit={event => { void addQuote(event); }}>
          <div className="pricing-fields"><label>Referencia del presupuesto<input className="ofi-input" required minLength={2} maxLength={100} value={label} onChange={e => setLabel(e.target.value)} /></label>
          <label>Importe total<input className="ofi-input" required type="number" min=".01" max="1000000000" step=".01" value={amount} onChange={e => setAmount(e.target.value)} /></label>
          <label>Valido hasta<input className="ofi-input" required type="date" value={until} onChange={e => setUntil(e.target.value)} /></label></div>
          <PricingFields value={quoteTerms} onChange={setQuoteTerms} quote />
          <button className="ofi-btn-primary" disabled={pricing.busy}><Plus size={17} />Registrar presupuesto</button></form></details>
      </section>
      <PricingHistory view={view} />
      <footer className="pricing-next"><AlertCircle size={20} /><div><strong>{view.nextStep === 'coordinator_pending' ? 'Preparado para Coordinacion' : view.nextStep === 'professional_selection' ? 'Siguiente: seleccionar profesional' : 'Siguiente: completar la estimacion'}</strong><p>La seleccion y el precio no confirman una contratacion.</p></div><Link className="ofi-btn-secondary" to={'/dashboard/company/jobs/' + encodeURIComponent(jobId) + '/matches'}>Ver candidatos</Link></footer>
    </>}
  </main></DashboardLayout>;
}
/** Editor comun de terminos de alcance y presupuestos. */
export function PricingFields({ value, onChange, quote = false, requireCoverage = false }: { value: PricingInputs; onChange: (v: PricingInputs) => void; quote?: boolean; requireCoverage?: boolean }) {
  /** Actualiza un campo conservando todos los terminos del formulario. */
  function change<K extends keyof PricingInputs>(key: K, next: PricingInputs[K]): void { onChange({ ...value, [key]: next }); }
  return <div className="pricing-fields">
    <label className="pricing-wide">Alcance comparable<textarea className="ofi-input" required minLength={8} maxLength={400} value={value.scope} onChange={e => change('scope', e.target.value)} /></label>
    <label>Moneda<input className="ofi-input" required pattern="[A-Z]{3}" maxLength={3} value={value.currency} onChange={e => change('currency', e.target.value.toUpperCase())} /></label>
    <label>Unidad<select aria-label="Unidad" className="ofi-input" value={value.unit} onChange={e => onChange({ ...value, unit: e.target.value as PricingInputs['unit'], quantity: e.target.value === 'job' ? 1 : value.quantity })}>{Object.entries(units).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
    <label>Cantidad<input className="ofi-input" required type="number" min=".01" max="100000" step=".01" disabled={value.unit === 'job'} value={value.quantity} onChange={e => change('quantity', Number(e.target.value))} /></label>
    <label>Materiales<select required={requireCoverage} className="ofi-input" value={value.materials} onChange={e => onChange({ ...value, materials: e.target.value as PricingInputs['materials'], materialsCost: null })}>{Object.entries(coverage).map(([key, text]) => <option key={key} value={key} disabled={requireCoverage && key === 'unknown'}>{text}</option>)}</select></label>
    <label>Impuestos<select required={requireCoverage} className="ofi-input" value={value.taxes} onChange={e => change('taxes', e.target.value as PricingInputs['taxes'])}>{Object.entries(coverage).map(([key, text]) => <option key={key} value={key} disabled={requireCoverage && key === 'unknown'}>{text}</option>)}</select></label>
    {!quote && <><label>Materiales: costo conocido separado<input className="ofi-input" type="number" min="0" max="1000000000" step=".01" disabled={value.materials !== 'excluded'} value={value.materialsCost ?? ''} onChange={e => change('materialsCost', e.target.value === '' ? null : Number(e.target.value))} /></label>
    <label>Experiencia requerida (anos)<input className="ofi-input" type="number" min="0" max="60" step="1" value={value.requiredExperienceYears ?? ''} onChange={e => change('requiredExperienceYears', e.target.value === '' ? null : Number(e.target.value))} /></label></>}
  </div>;
}
/** Versiones previas claramente separadas del precio vigente. */
function PricingHistory({ view }: { view: PricingView }) {
  return <details className="pricing-section"><summary><History size={17} />Historial de estimaciones</summary><ol>{view.history.map(row => <li key={row.id}><time>{new Date(row.generatedAt).toLocaleString('es-AR')}</time> · {row.range ? money(row.range.min, row.currency) + ' a ' + money(row.range.max, row.currency) : 'Informacion insuficiente'} · Confianza {row.confidence}%</li>)}</ol></details>;
}
