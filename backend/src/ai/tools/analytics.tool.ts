/** @archivo analytics.tool.ts @descripcion Calculos deterministas con moneda, procedencia y limites explicitos. */
import type { IntelligenceSnapshot, IntelligenceFact } from '../../../../shared/intelligence';
import type { intelligenceRepository } from '../../repositories/intelligence.repository';
import { evidenceTime } from '../../repositories/intelligence.repository';
type Source = Awaited<ReturnType<typeof intelligenceRepository.source>>;
/** No mezcla monedas ni convierte presupuestos aceptados en dinero cobrado. */
export function analyzeEvidence(data: Source,month: string,platform: boolean): IntelligenceSnapshot {
  const facts: IntelligenceFact[] = [];
  /** Agrega una medida junto con la procedencia necesaria para interpretarla. */
  function fact(id: string,label: string,value: number | string | null,unit: string,source: string,note: string | null = null,currency: string | null = null): void {
    facts.push({id,label,value,unit,source,note,currency});
  }
  const categories = new Map<string,{ name: string; jobs: number; completed: number }>();
  const cities = new Map<string,{ name: string; demand: number; supply: number | null }>();
  const professionals = new Map<string,number>();
  const delayed: IntelligenceSnapshot['delayed'] = [];
  data.jobs.forEach(job => {
    const key = job.categoria || 'Sin categoria';
    const category = categories.get(key) ?? { name: key,jobs: 0,completed: 0 }; category.jobs++;
    if (job.estado === 'completado') { category.completed++; if (job.profesionalAsignadoId) professionals.set(job.profesionalAsignadoId,(professionals.get(job.profesionalAsignadoId) ?? 0)+1); }
    categories.set(key,category);
    const city = job.ciudad || 'Sin ciudad'; const demand = cities.get(city) ?? {name: city,demand: 0,supply: platform ? 0 : null}; demand.demand++; cities.set(city,demand);
    const date = job.fechaFin ? evidenceTime(job.fechaFin) : job.preferredDate ? Date.parse(job.preferredDate) : NaN;
    if (!['completado','cancelado','borrador'].includes(job.estado) && Number.isFinite(date) && date < Date.now())
      delayed.push({jobId: job.id,title: job.titulo,reason: job.fechaFin ? 'La fecha de fin registrada ya paso.' : 'La fecha solicitada ya paso; no equivale a un plazo acordado.'});
  });
  data.supply.forEach(profile => { const city = cities.get(profile.city) ?? {name: profile.city,demand: 0,supply: 0}; city.supply = (city.supply ?? 0)+1; cities.set(profile.city,city); });
  const note = data.jobsPartial ? 'Muestra acotada a 500 trabajos; no representa el total.' : null;
  fact('jobs_total','Trabajos registrados',data.total,'count','jobs.count');
  fact('jobs_completed','Trabajos completados',data.jobs.filter(job => job.estado === 'completado').length,'count','jobs.estado',note);
  fact('jobs_delayed','Trabajos con fecha superada',delayed.length,'count','jobs.fechaFin/preferredDate',note);
  fact('category_profitability','Categoria mas rentable',null,'money','unavailable','Faltan costos y cobros reales por trabajo.');
  fact('delay_probability','Probabilidad de demora',null,'ratio','unavailable','No hay un modelo calibrado. Se muestran alertas por fechas registradas.');
  fact('gmv','GMV cobrado',null,'money','unavailable','Los acuerdos y presupuestos no acreditan pagos de trabajos.');
  if (platform) {
    data.revenue.forEach(row => fact('revenue_'+row.currency,'Ingresos netos confirmados',row.netMinor/100,'money','billing_revenue',
      'Antes de gastos e impuestos. Mes de cobro: '+month,row.currency));
    const mrr = new Map<string,number>(); const seen = new Set<string>();
    data.subscriptions.forEach(sub => {
      if (sub.plan === 'gratuito' || evidenceTime(sub.fechaVencimiento) <= Date.now() || !Number.isFinite(evidenceTime(sub.fechaVencimiento))) return;
      if (seen.has(sub.usuarioId)) return; seen.add(sub.usuarioId);
      mrr.set(sub.moneda,(mrr.get(sub.moneda) ?? 0)+sub.precioMensual);
    });
    mrr.forEach((value,currency) => {
      fact('mrr_'+currency,'MRR contractual',value,'money','subscriptions',data.subscriptionPartial ? 'Muestra de hasta 500 contratos activos.' : 'Contratos pagos vigentes; no es caja recibida.',currency);
      fact('arr_'+currency,'ARR proyectado',value*12,'money','subscriptions','MRR multiplicado por 12; no es ingreso garantizado.',currency);
    });
    fact('dau','Usuarios activos observados: ultimas 24 h',new Set(data.events.filter(event => event.at >= Date.now()-86400000).map(event => event.uid)).size,'count','analytics_events',data.eventsPartial ? 'Eventos truncados; cobertura incompleta.' : 'Solo eventos de actividad instrumentados, algunos declarados por cliente.');
    fact('mau','Usuarios activos observados: ultimos 30 dias',new Set(data.events.map(event => event.uid)).size,'count','analytics_events',data.eventsPartial ? 'Eventos truncados; cobertura incompleta.' : 'Solo eventos de actividad instrumentados, algunos declarados por cliente.');
    ['retention','activation','churn','cac','ltv','roi','conversion'].forEach(id => fact(id,id.toUpperCase(),null,'ratio','unavailable','Requiere cohortes o atribucion completa; no se estima con datos parciales.'));
  } else {
    const money = new Map<string,number>();
    data.payments?.filter(payment => payment.paidAt.startsWith(month)).forEach(payment => money.set(payment.currency,
      (money.get(payment.currency) ?? 0)+payment.amountMinor-payment.refundedMinor));
    money.forEach((minor,currency) => fact('spend_'+currency,'Gasto en suscripciones',minor/100,'money','billing_payments',
      'Pagos propios del mes, hasta 50 recibos recientes. No incluye pagos de trabajos.',currency));
    if (!money.size) fact('spend','Gasto registrado en suscripciones',null,'money','billing_payments','No se encontraron recibos del mes en la ventana consultada.');
  }
  return { scope: platform ? 'platform' : 'account',generatedAt: new Date().toISOString(),month,
    partial: data.jobsPartial || data.supplyPartial || data.subscriptionPartial || data.eventsPartial,
    facts,categories: [...categories.values()].sort((a,b)=>b.jobs-a.jobs),cities: [...cities.values()].sort((a,b)=>b.demand-a.demand),
    delayed: delayed.slice(0,30),professionals: [...professionals].map(([id,completed])=>({id,completed})).sort((a,b)=>b.completed-a.completed).slice(0,20) };
}
