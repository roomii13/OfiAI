/** @archivo sales.worker.ts @descripcion Seguimientos comerciales internos, nunca envios externos masivos. */
import { salesService } from '../services/sales.service';
/** El consentimiento y la version se vuelven a verificar dentro de la transaccion. */
export async function salesFollowUpWorker(): Promise<number> { return salesService.followUp(); }
