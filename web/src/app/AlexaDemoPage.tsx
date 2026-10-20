/** Simulación conversacional Alexa+ para mostrar el flujo supervisado de OfiAI. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, Mic2, Send, Sparkles, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import './alexa-demo.css';

type ChatMessage = { id: number; role: 'user' | 'assistant'; text: string; card?: 'request' | 'matches' | 'price' | 'coordination' };

const examples = [
  'Necesito reparar una instalación eléctrica en Santa Rosa',
  'Buscá profesionales para ese trabajo',
  '¿Cuánto podría costar?',
];

const opening: ChatMessage = {
  id: 1, role: 'assistant',
  text: 'Hola, soy OfiAI. Puedo ayudarte a describir un trabajo, explorar profesionales y entender una estimación. ¿Qué necesitás resolver?',
};

/** Conversación simulada con datos ficticios; no publica trabajos ni contacta personas. */
export function AlexaDemoPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([opening]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const sequence = useRef(1);

  useEffect(() => { list.current?.scrollTo?.({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy]);

  function replyTo(text: string): ChatMessage {
    const normalized = text.toLocaleLowerCase('es');
    if (/precio|cost|presupuesto|estimaci/.test(normalized)) return {
      id: ++sequence.current, role: 'assistant', card: 'price',
      text: 'Como referencia inicial, una reparación eléctrica de este tipo podría requerir una visita de diagnóstico. El importe depende del alcance, los materiales y las condiciones del lugar; la cifra final debe confirmarla un profesional.',
    };
    if (/profesional|buscar|buscá|busca|electricista|opcion|opción/.test(normalized)) return {
      id: ++sequence.current, role: 'assistant', card: 'matches',
      text: 'Encontré opciones de ejemplo para mostrar cómo OfiAI presenta recomendaciones. En el producto, Matching consulta perfiles disponibles y muestra sus criterios antes de que elijas.',
    };
    if (/coordina|agenda|turno|contact|contrat|confirm/.test(normalized)) return {
      id: ++sequence.current, role: 'assistant', card: 'coordination',
      text: 'Antes de coordinar, OfiAI te mostraría el alcance, el presupuesto y la disponibilidad para revisión. Esta simulación no envía invitaciones ni confirma una contratación.',
    };
    return {
      id: ++sequence.current, role: 'assistant', card: 'request',
      text: 'Entendido. Para este recorrido voy a usar una solicitud ficticia de reparación eléctrica en Santa Rosa. En OfiAI, Intake ayuda a completar los detalles y vos revisás todo antes de publicar.',
    };
  }

  function send(event?: FormEvent, preset?: string): void {
    event?.preventDefault();
    const text = (preset ?? draft).trim();
    if (!text || busy) return;
    setDraft('');
    setMessages(current => [...current, { id: ++sequence.current, role: 'user', text }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages(current => [...current, replyTo(text)]);
      setBusy(false);
    }, 450);
  }

  return <main className="alexa-demo">
    <header className="alexa-demo-topbar">
      <Link to="/login" aria-label="Volver a OfiAI"><ArrowLeft size={18} /><span>OfiAI</span></Link>
      <span className="alexa-demo-label"><Sparkles size={15} />Simulación de experiencia Alexa+</span>
    </header>
    <section className="alexa-demo-shell" aria-label="Demostración conversacional de OfiAI">
      <aside className="alexa-demo-intro">
        <div className="alexa-demo-orb" aria-hidden="true"><Volume2 size={32} /></div>
        <p className="alexa-demo-eyebrow">OfiAI · asistente para trabajos</p>
        <h1>Del pedido al próximo paso, con vos en control.</h1>
        <p>Contá qué necesitás. OfiAI organiza la solicitud y te ayuda a revisar profesionales, precios y coordinación.</p>
        <div className="alexa-demo-guard"><Check size={17} /><span>Las decisiones y confirmaciones quedan en tus manos.</span></div>
        <p className="alexa-demo-note">Recorrido ilustrativo con datos ficticios. No se crean solicitudes ni se contacta a profesionales.</p>
      </aside>
      <section className="alexa-demo-chat" aria-label="Conversación">
        <header className="alexa-demo-chat-head"><div className="alexa-demo-avatar"><Sparkles size={18} /></div><div><strong>OfiAI</strong><span>Asistente de trabajos · simulación</span></div><span className="alexa-demo-online">Demo</span></header>
        <div className="alexa-demo-messages" ref={list} role="log" aria-live="polite" aria-relevant="additions">
          {messages.map(message => <article key={message.id} className={'alexa-message alexa-message-' + message.role}>
            {message.role === 'assistant' && <span className="alexa-message-avatar"><Sparkles size={14} /></span>}
            <div className="alexa-message-content"><p>{message.text}</p>{message.card && <DemoCard type={message.card} />}</div>
          </article>)}
          {busy && <p className="alexa-typing" role="status"><span /><span /><span /> OfiAI está preparando la respuesta…</p>}
        </div>
        {messages.length < 6 && <div className="alexa-suggestions" aria-label="Mensajes sugeridos">
          {examples.map(example => <button type="button" key={example} onClick={() => send(undefined, example)} disabled={busy}>{example}</button>)}
        </div>}
        <form className="alexa-composer" onSubmit={send}>
          <label className="sr-only" htmlFor="alexa-message">Escribí tu mensaje</label>
          <button type="button" className="alexa-mic" aria-label="Entrada de voz ilustrativa" title="La entrada de voz no está disponible en esta simulación" disabled><Mic2 size={19} /></button>
          <input id="alexa-message" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Escribí qué necesitás…" maxLength={500} />
          <button className="alexa-send" type="submit" aria-label="Enviar mensaje" disabled={!draft.trim() || busy}><Send size={18} /></button>
        </form>
        <footer className="alexa-chat-footer">Simulación conversacional · No es un dispositivo ni servicio Alexa real</footer>
      </section>
    </section>
    <footer className="alexa-demo-bottom"><span>Una experiencia de OfiAI</span><Link to="/login">Conocer OfiAI <ArrowRight size={15} /></Link></footer>
  </main>;
}

function DemoCard({ type }: { type: NonNullable<ChatMessage['card']> }) {
  if (type === 'request') return <div className="alexa-result-card"><span className="alexa-card-kicker">SOLICITUD DE EJEMPLO</span><strong>Reparación eléctrica</strong><span>Santa Rosa, La Pampa · Alcance por definir</span><small>Datos ilustrativos · Aún no publicada</small></div>;
  if (type === 'matches') return <div className="alexa-result-card"><span className="alexa-card-kicker">PROFESIONALES DE EJEMPLO</span><div className="alexa-person"><span className="alexa-person-avatar">MR</span><div><strong>María R. · Electricista</strong><span>Santa Rosa · Perfil de demostración</span></div><b>Disponible</b></div><div className="alexa-person"><span className="alexa-person-avatar alexa-person-alt">JL</span><div><strong>Julián L. · Instalaciones</strong><span>Toay · Perfil de demostración</span></div><b>Consultar</b></div><small>Perfiles ficticios · No se contactó a nadie</small></div>;
  if (type === 'price') return <div className="alexa-result-card"><span className="alexa-card-kicker">ESTIMACIÓN</span><strong>Primero, definir el alcance</strong><span>La visita y los materiales pueden cambiar el precio.</span><small>Sin importe real · Requiere evaluación profesional</small></div>;
  return <div className="alexa-result-card"><span className="alexa-card-kicker">REVISIÓN HUMANA</span><strong>Solicitud → opciones → acuerdo</strong><span>Se revisan alcance, importe y fecha antes de cualquier confirmación.</span><small>Sin invitaciones ni cambios reales en esta demo</small></div>;
}
