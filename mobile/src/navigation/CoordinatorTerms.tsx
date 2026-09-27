/** @archivo CoordinatorTerms.tsx @descripcion Terminos completos antes y despues del consentimiento bilateral. */
import { Text, View } from 'react-native';
import type { PricingQuote } from '../../../shared/pricing';
import type { CoordinatorCommand } from '../../../shared/coordinator';
import { useThemeMobile } from '../providers/theme';
import { coordinatorDate, coordinatorMoney, quoteCoverage, quoteUnits } from '../lib/coordinatorPresentation';
import { coordinatorStyles as s } from './CoordinatorUi';

/** Muestra todos los terminos economicos sin convertir la estimacion en oferta. */
export function CoordinatorQuoteTerms({ quote }: { quote: PricingQuote }) {
  const { colores } = useThemeMobile();
  return <View style={s.section}>
    <Text style={[s.subtitle, { color: colores.texto }]}>{quote.label}</Text>
    <Text style={{ color: colores.texto }}>Importe total: {coordinatorMoney(quote.amount, quote.currency)}</Text>
    <Text style={{ color: colores.texto }}>Alcance: {quote.scope}</Text>
    <Text style={{ color: colores.texto }}>Cantidad: {quote.quantity} · {quoteUnits[quote.unit]}</Text>
    <Text style={{ color: colores.texto }}>Materiales: {quoteCoverage[quote.materials]}</Text>
    <Text style={{ color: colores.texto }}>Impuestos: {quoteCoverage[quote.taxes]}</Text>
    <Text style={{ color: colores.texto }}>Valido hasta: {quote.validUntil}</Text>
  </View>;
}

/** Expone horario local y su valor ISO para evitar ambiguedad de zona. */
export function CoordinatorScheduleTerms({ schedule }: { schedule: NonNullable<CoordinatorCommand['schedule']> }) {
  const { colores } = useThemeMobile();
  return <View style={s.section}>
    <Text style={{ color: colores.texto }}>Inicio: {coordinatorDate(schedule.startsAt)}</Text>
    <Text style={{ color: colores.texto }}>Fin: {coordinatorDate(schedule.endsAt)}</Text>
    <Text style={{ color: colores.textoSuave }}>{schedule.startsAt} / {schedule.endsAt}</Text>
  </View>;
}
