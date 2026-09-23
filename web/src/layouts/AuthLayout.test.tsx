/**
 * @archivo AuthLayout.test.tsx
 * @descripcion Regresiones del fondo de login y aislamiento de las pantallas de registro.
 */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AuthLayout } from './AuthLayout';

afterEach(cleanup);

it('muestra el fondo decorativo sin esconder los controles del login', () => {
  const { container } = render(<AuthLayout withBackground><label>Email<input type="email" /></label></AuthLayout>);
  expect(container.querySelector('main.ofi-login')).toBeTruthy();
  const image = container.querySelector('img');
  expect(image?.getAttribute('src')).toContain('login-handshake');
  expect(image?.getAttribute('alt')).toBe('');
  expect(image?.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy();
});

it('mantiene el layout de registro sin agregar el fondo de login', () => {
  const { container } = render(<AuthLayout><h1>Registro de empresa</h1></AuthLayout>);
  expect(container.querySelector('.ofi-login-image')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Registro de empresa' })).toBeTruthy();
});
