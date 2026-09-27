/**
 * @archivo JobMatchesPage.tsx
 * @descripcion Recomendaciones reales, filtros locales y seleccion previa a coordinacion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Check, CheckCircle2, Clock3, Loader2, MapPin, RefreshCw, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useMatching } from '../lib/api/matching';
import type { ProfessionalMatch } from '../../../shared/matching';
import './matching.css';

const stages = ['Analizando tu solicitud', 'Buscando profesionales compatibles', 'Comparando experiencia y habilidades', 'Evaluando proximidad', 'Generando recomendaciones'];
const urgency: Record<string, string> = { low: 'Baja', medium: 'Normal', normal: 'Normal', high: 'Alta', emergency: 'Emergencia' };

/** Evita interpretar como cotizacion un precio minimo u horario de perfil. */
function money(amount: number | null, currency: string | null): string {
  return amount === null ? 'A consultar' : amount.toLocaleString('es-AR') + ' ' + (currency ?? 'Moneda por confirmar');
}

/** Aisla la pantalla y sus solicitudes cuando cambia el usuario o el Job. */
export function JobMatchesPage() {
  const { jobId = '' } = useParams();
  const { user } = useAuth();
  return <MatchingView key={(user?.id ?? '') + ':' + jobId} jobId={jobId} />;
}

/** Presenta candidatos del backend; filtros y orden no generan llamadas de IA. */
function MatchingView({ jobId }: { jobId: string }) {
  const matching = useMatching(jobId);
  const result = matching.result;
  const [profile, setProfile] = useState<ProfessionalMatch | null>(null);
  const [sort, setSort] = useState('recommended');
  const [category, setCategory] = useState('');
  const [distance, setDistance] = useState('');
  const [experience, setExperience] = useState('');
  const [rating, setRating] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [available, setAvailable] = useState(false);
  const categories = [...new Set(result?.matches.flatMap(row => row.professional.categories) ?? [])].sort();
  const currencies = [...new Set(result?.matches.map(row => row.professional.currency).filter((value): value is string => Boolean(value)) ?? [])].sort();
  const matches = useMemo(() => {
    const rows = (result?.matches ?? []).filter(row => {
      const pro = row.professional;
      return (!category || pro.categories.includes(category))
        && (!distance || row.distanceKm !== null && row.distanceKm <= Number(distance))
        && (!experience || pro.experienceYears !== null && pro.experienceYears >= Number(experience))
        && (!rating || pro.rating !== null && pro.rating >= Number(rating))
        && (!available || pro.available === true)
        && (!price || pro.minimumPrice !== null && pro.minimumPrice <= Number(price) && pro.currency === currency);
    });
    return rows.sort((a, b) => {
      if (sort === 'near') return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || b.matchScore - a.matchScore;
      if (sort === 'rating') return (b.professional.rating ?? -1) - (a.professional.rating ?? -1) || b.matchScore - a.matchScore;
      if (sort === 'experience') return (b.professional.experienceYears ?? -1) - (a.professional.experienceYears ?? -1) || b.matchScore - a.matchScore;
      return (sort === 'recommended' ? Number(b.recommended) - Number(a.recommended) : 0) || b.matchScore - a.matchScore;
    });
  }, [result, sort, category, distance, experience, rating, price, currency, available]);
  /** Restablece solo los filtros; mantiene la corrida del servidor. */
  function clear(): void { setCategory(''); setDistance(''); setExperience(''); setRating(''); setPrice(''); setCurrency(''); setAvailable(false); }
  const active = Boolean(category || distance || experience || rating || price || available);
  const job = result?.job;
  return <DashboardLayout>
    <div className="matching-page">
      <Link to="/jobs" className="matching-back"><ArrowLeft size={16} />Mis trabajos</Link>
      <Link className="ofi-btn-secondary" to={'/dashboard/company/jobs/' + encodeURIComponent(jobId) + '/pricing'}>Ver estimacion de precio</Link>
      <Link className="ofi-btn-secondary" to={'/dashboard/coordination/' + encodeURIComponent(jobId)}>Ir a coordinacion</Link>
      <header className="matching-header">
        <div><div className="matching-eyebrow"><Sparkles size={16} />OFIAI · MATCHING</div><h1>Profesionales recomendados</h1>
          <p>{result?.message ?? 'Buscando las personas adecuadas para tu solicitud.'}</p></div>
        <button className="ofi-btn-secondary" aria-label="Actualizar recomendaciones" title="Actualizar recomendaciones" disabled={matching.busy || Boolean(matching.action)} onClick={matching.reload}><RefreshCw size={18} /></button>
      </header>
      {job && <section className="matching-job" aria-label="Resumen del trabajo">
        <div><span className="matching-label">TU SOLICITUD</span><h2>{job.title}</h2><p>{job.category} · {[job.location.city, job.location.province, job.location.country].filter(Boolean).join(', ') || 'Ubicacion por confirmar'}</p></div>
        <dl><div><dt>Urgencia</dt><dd>{urgency[job.urgency ?? ''] ?? 'Por confirmar'}</dd></div>
          <div><dt>Fecha</dt><dd>{job.preferredDate ?? 'A coordinar'}</dd></div>
          <div><dt>Presupuesto</dt><dd>{job.budget.min !== null || job.budget.max !== null
            ? money(job.budget.min, job.budget.currency) + ' / ' + money(job.budget.max, job.budget.currency) : 'A cotizar'}</dd></div></dl>
      </section>}
      {matching.error && <div className="matching-error" role="alert"><p>{matching.error}</p><button className="ofi-btn-secondary" onClick={matching.reload} disabled={matching.busy}>Reintentar</button></div>}
      {matching.busy && <section className="matching-loading" role="status" aria-live="polite">
        <Loader2 className="animate-spin" size={24} /><h2>OfiAI esta buscando profesionales...</h2>
        <ol>{stages.map((stage, index) => <li key={stage}>{(result?.completedStages ?? 0) > index ? <CheckCircle2 size={18} /> : <span className="matching-step">{index + 1}</span>}{stage}</li>)}</ol>
        {matching.slow && <p>Esto esta tomando un poco mas de tiempo. Seguimos trabajando...</p>}
      </section>}
      {!matching.busy && result && ['completed', 'fallback'].includes(result.status) && <>
        <div className="matching-result-note">
          <span><Sparkles size={16} />{result.semanticMatchingUsed ? 'Compatibilidad + analisis semantico' : 'Criterios de compatibilidad'}</span>
          <span>{result.totalCandidates} compatibles · {result.matches.length} recomendaciones{result.generatedAt ? ' · ' + new Date(result.generatedAt).toLocaleString('es-AR') : ''}</span>
        </div>
        {result.searchLimited && <p className="matching-warning">Se revisaron los primeros {result.scannedCandidates} perfiles del catalogo. La busqueda no incluye todo el catalogo.</p>}
        {result.selectedProfessionalId && <div className="matching-selected" role="status"><CheckCircle2 size={20} /><div><strong>Profesional seleccionado</strong><p>Seleccion guardada para la proxima etapa. Todavia no se realizo una contratacion.</p></div></div>}
        {result.matches.length > 0 ? <>
          <details className="matching-filters"><summary><SlidersHorizontal size={17} />Filtrar candidatos{active ? ' · Filtros activos' : ''}</summary>
            <div className="matching-filter-grid">
              <label>Categoria<select className="ofi-input" value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Distancia maxima (km)<input className="ofi-input" type="number" min="0" value={distance} onChange={event => setDistance(event.target.value)} /></label>
              <label>Experiencia minima (anos)<input className="ofi-input" type="number" min="0" value={experience} onChange={event => setExperience(event.target.value)} /></label>
              <label>Valoracion minima<select className="ofi-input" value={rating} onChange={event => setRating(event.target.value)}><option value="">Cualquiera</option><option value="3">3 o mas</option><option value="4">4 o mas</option><option value="4.5">4.5 o mas</option></select></label>
              <label>Moneda<select className="ofi-input" value={currency} onChange={event => { setCurrency(event.target.value); setPrice(''); }}><option value="">Seleccionar</option>{currencies.map(value => <option key={value}>{value}</option>)}</select></label>
              <label>Precio minimo del perfil hasta<input className="ofi-input" type="number" min="0" value={price} disabled={!currency} onChange={event => setPrice(event.target.value)} /></label>
              <label className="matching-checkbox"><input type="checkbox" checked={available} onChange={event => setAvailable(event.target.checked)} />Disponibilidad confirmada</label>
              <button className="ofi-btn-secondary" onClick={clear}>Limpiar filtros</button>
            </div>
          </details>
          <div className="matching-list-header"><h2>{matches.length} candidatos</h2><label><span>Ordenar</span><select aria-label="Ordenar" className="ofi-input" value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Recomendados</option><option value="score">Mayor compatibilidad</option><option value="near">Mas cercanos</option><option value="rating">Mejor valoracion</option><option value="experience">Mas experiencia</option></select></label></div>
          <div className="matching-list">{matches.map(row => <Candidate key={row.professionalId} match={row} disabled={Boolean(matching.action)}
            onProfile={() => { void matching.profile(row.professionalId).then(value => { if (value) setProfile(value); }); }}
            onSelect={() => { void matching.select(row.professionalId); }} />)}</div>
          {matches.length === 0 && <div className="matching-empty"><h2>No hay candidatos con estos filtros</h2><button className="ofi-btn-secondary" onClick={clear}>Limpiar filtros</button></div>}
        </> : <div className="matching-empty"><Sparkles size={32} /><h2>Todavia no encontramos profesionales que cumplan todos los requisitos.</h2><p>Podemos ampliar la busqueda.</p><button className="ofi-btn-secondary" disabled title="Disponible en una proxima etapa">Ampliar radio de busqueda · Proximamente</button><Link to="/jobs">Volver a mis trabajos</Link></div>}
      </>}
      {profile && <Profile match={result?.matches.find(row => row.professionalId === profile.professionalId) ?? profile}
        onClose={() => setProfile(null)} onSelect={() => { void matching.select(profile.professionalId); }} disabled={Boolean(matching.action)} error={matching.error} />}
    </div>
  </DashboardLayout>;
}

/** Usa la foto publica proporcionada o iniciales, sin fabricar retratos. */
function Avatar({ match }: { match: ProfessionalMatch }) {
  const [failed, setFailed] = useState(false);
  const pro = match.professional;
  return pro.profileImage && !failed ? <img className="matching-avatar" src={pro.profileImage} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="matching-avatar" aria-hidden="true">{pro.firstName[0]}{pro.lastName[0]}</span>;
}

/** Presenta evidencia y datos desconocidos sin fabricar experiencia o reputacion. */
function Candidate({ match, onProfile, onSelect, disabled }: { match: ProfessionalMatch; onProfile: () => void; onSelect: () => void; disabled: boolean }) {
  const pro = match.professional;
  return <article className={'matching-candidate' + (match.state === 'selected' ? ' is-selected' : '')}>
    <div className="matching-candidate-top"><Avatar match={match} /><div className="matching-identity"><h3>{pro.firstName} {pro.lastName}{pro.verified && <BadgeCheck size={18} aria-label="Perfil verificado" />}</h3><p>{pro.categories.join(' · ')}</p></div>
      <div className="matching-score"><strong>{Math.round(match.matchScore)}%</strong><span>de compatibilidad</span><small>Recomendacion OfiAI</small></div></div>
    <ul className="matching-facts"><li><Star size={16} />{pro.rating === null ? 'Sin valoraciones' : pro.rating.toFixed(1) + ' / 5'}</li><li><Clock3 size={16} />{pro.experienceYears === null ? 'Experiencia no informada' : pro.experienceYears + ' anos de experiencia'}</li><li><MapPin size={16} />{pro.location.city ?? 'Ciudad no informada'}{match.distanceKm === null ? '' : ' · ' + match.distanceKm.toFixed(1) + ' km'}</li><li>{pro.completedJobs === null ? 'Historial no informado' : pro.completedJobs + ' trabajos completados'}</li></ul>
    <div className="matching-explanation"><h4>Por que OfiAI lo recomienda</h4><p>{match.reason || 'Coincidencia con los requisitos de la solicitud.'}</p><ul>{match.strengths.map(item => <li key={item}><Check size={15} />{item}</li>)}</ul>
      {match.concerns.length > 0 && <details><summary>Aspectos por confirmar ({match.concerns.length})</summary><ul>{match.concerns.map(item => <li key={item}>{item}</li>)}</ul></details>}</div>
    <footer><span>{pro.available === true ? 'Disponible' : pro.available === false ? 'No disponible' : 'Disponibilidad por confirmar'}<small>Desde {money(pro.minimumPrice, pro.currency)}</small></span>
      <div><button className="ofi-btn-secondary" disabled={disabled} onClick={onProfile}>Ver perfil</button><button className="ofi-btn-primary" disabled={disabled || match.state === 'selected'} onClick={onSelect}><Check size={16} />{match.state === 'selected' ? 'Seleccionado' : 'Seleccionar profesional'}</button></div></footer>
  </article>;
}

/** Dialogo accesible con datos publicos y compatibilidad del Job actual. */
function Profile({ match, onClose, onSelect, disabled, error }: { match: ProfessionalMatch; onClose: () => void; onSelect: () => void; disabled: boolean; error: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const pro = match.professional;
  return <dialog ref={dialog} className="matching-profile" aria-labelledby="matching-profile-title" onCancel={onClose} onClose={onClose}>
    <header><h2 id="matching-profile-title">Perfil profesional</h2><button className="ofi-btn-secondary" onClick={onClose} aria-label="Cerrar perfil" title="Cerrar perfil"><X size={18} /></button></header>
    {error && <p role="alert" className="matching-error">{error}</p>}
    <Avatar match={match} /><h3>{pro.firstName} {pro.lastName}</h3><p>{pro.description ?? 'Sin descripcion publicada.'}</p>
    <dl>{Object.entries({ Categorias: pro.categories.join(', '), Habilidades: pro.skills.join(', '),
      Experiencia: pro.experienceYears === null ? 'No informada' : pro.experienceYears + ' anos',
      Valoracion: pro.rating === null ? 'Sin valoraciones' : pro.rating + ' / 5',
      'Trabajos completados': pro.completedJobs ?? 'No informado',
      'Ubicacion aproximada': [pro.location.city, pro.location.province, pro.location.country].filter(Boolean).join(', '),
      Disponibilidad: pro.available === null ? 'Por confirmar' : pro.available ? 'Disponible' : 'No disponible',
      Dias: pro.availabilityDays.join(', '), Verificacion: pro.verified ? 'Verificado' : 'Sin verificar',
      'Precio minimo publicado': money(pro.minimumPrice, pro.currency), 'Tarifa por hora': money(pro.hourlyRate, pro.currency),
      'Compatibilidad con tu solicitud': Math.round(match.matchScore) + '%', }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'No informado'}</dd></div>)}</dl>
    <p>{match.reason}</p><button className="ofi-btn-primary" onClick={onSelect} disabled={disabled || match.state === 'selected'}><Check size={16} />{match.state === 'selected' ? 'Seleccionado' : 'Seleccionar profesional'}</button>
  </dialog>;
}
