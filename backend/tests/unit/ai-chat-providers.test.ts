/** @archivo ai-chat-providers.test.ts @descripcion Seleccion de proveedor para el chat autenticado. */
import { aiService } from '../../src/services/ai.service';
import { geminiClient, GeminiIntakeError } from '../../src/integrations/gemini/gemini.client';

jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: {} }));
afterEach(() => { jest.restoreAllMocks(); });

it('intenta IA externa por defecto y conserva el proveedor real', async () => {
  jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  const external = jest.spyOn(geminiClient, 'generarTexto').mockResolvedValue({
    proveedor: 'deepseek', modelo: 'deepseek-flash', texto: 'Puedo ayudarte a definir el trabajo.',
  });
  const result = await aiService.chatear({ mensaje: 'Necesito ayuda con una obra' }, 'company-test', 'empresa');
  expect(external).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ proveedor: 'deepseek', respuesta: 'Puedo ayudarte a definir el trabajo.' });
});

it('respeta el modo explicito de solo reglas', async () => {
  jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  const external = jest.spyOn(geminiClient, 'generarTexto');
  const result = await aiService.chatear({ mensaje: 'Necesito ayuda', usarGemini: false }, 'company-test', 'empresa');
  expect(external).not.toHaveBeenCalled();
  expect(result.proveedor).toBe('reglas');
});

it('vuelve a reglas sin filtrar errores si fallan ambos proveedores', async () => {
  jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  jest.spyOn(geminiClient, 'generarTexto').mockRejectedValue(new GeminiIntakeError('unavailable'));
  const result = await aiService.chatear({ mensaje: 'Necesito ayuda' }, 'company-test', 'empresa');
  expect(result.proveedor).toBe('reglas');
  expect(result.respuesta).not.toContain('unavailable');
});
