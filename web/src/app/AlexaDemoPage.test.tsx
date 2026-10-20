import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlexaDemoPage } from './AlexaDemoPage';

describe('Simulación conversacional Alexa+ de OfiAI', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('explica que es una simulación y presenta el flujo sin llamar a la API', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><AlexaDemoPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: /del pedido al próximo paso/i })).toBeTruthy();
    expect(screen.getByText(/no se crean solicitudes ni se contacta/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /reparar una instalación eléctrica/i }));

    expect(await screen.findByText(/solicitud ficticia de reparación eléctrica/i, {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText(/aún no publicada/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('presenta opciones y estimaciones como ilustrativas, sin simular confirmaciones reales', async () => {
    render(<MemoryRouter><AlexaDemoPage /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribí tu mensaje' }), { target: { value: '¿Cuánto podría costar?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => expect(screen.getByText(/la cifra final debe confirmarla un profesional/i)).toBeTruthy(), { timeout: 2000 });
    expect(screen.getByText(/sin importe real/i)).toBeTruthy();
    expect(screen.getByText(/no es un dispositivo ni servicio Alexa real/i)).toBeTruthy();
  });
});
