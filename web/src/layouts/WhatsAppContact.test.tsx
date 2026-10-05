/** @archivo WhatsAppContact.test.tsx @descripcion Verifica contacto manual, formato y privacidad del enlace. */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WhatsAppContact } from './WhatsAppContact';
import { LandingLayout } from './LandingLayout';

afterEach(cleanup);

it('abre solo el numero autorizado sin mensajes, identificadores ni datos de sesion', () => {
  render(<WhatsAppContact />);
  const link = screen.getByRole('link', { name: /Contactar por WhatsApp/ });
  expect(link.getAttribute('href')).toBe('https://wa.me/5492954446198');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  expect(link.getAttribute('referrerpolicy')).toBe('no-referrer');
});

it('ofrece contacto en el pie publico sin quitar los accesos existentes', () => {
  render(<MemoryRouter><LandingLayout><h1>OfiAI</h1></LandingLayout></MemoryRouter>);
  expect(screen.getByRole('link', { name: /Contactar por WhatsApp/ }).closest('footer')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ingresar' }).getAttribute('href')).toBe('/login');
  expect(screen.getByRole('link', { name: 'Crear cuenta' }).getAttribute('href')).toBe('/register/company');
});
