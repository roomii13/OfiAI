/** @archivo CitizenRegisterPage.tsx @descripcion Alta de particulares conectada a Auth, sin campos de empresa. */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuth, type RegisterCitizenInput } from '../context/AuthContext';

/** Formulario accesible que no decide roles ni permisos desde el navegador. */
export function CitizenRegisterPage() {
  const { registerCitizen, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [form, setForm] = useState<RegisterCitizenInput>({
    nombre: '', apellido: '', email: '', password: '', ciudad: '', pais: 'AR',
  });
  /** Actualiza solamente campos del contrato publico. */
  function update<K extends keyof RegisterCitizenInput>(field: K, value: RegisterCitizenInput[K]): void {
    setForm(previous => ({ ...previous, [field]: value }));
  }
  /** Inicia la sesion Firebase tras la creacion confirmada por el backend. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (loading) return; setError('');
    try { await registerCitizen(form); navigate('/dashboard'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos crear tu cuenta.'); }
  }
  return <AuthLayout>
    <h1 className="text-2xl font-bold">Crear cuenta particular</h1>
    <p className="mb-6 mt-2 text-sm text-gray-600">Tu cuenta es gratis para siempre. Contrata profesionales para tu hogar o necesidades personales.</p>
    <form className="grid gap-4" onSubmit={submit}>
      {(['nombre', 'apellido', 'email', 'password', 'ciudad'] as const).map(field => <label className="grid gap-1 text-sm" key={field}>
        {{ nombre: 'Nombre', apellido: 'Apellido', email: 'Email', password: 'Contraseña', ciudad: 'Ciudad' }[field]}
        <input className="ofi-input" type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
          autoComplete={field === 'password' ? 'new-password' : field === 'email' ? 'email' : undefined}
          required minLength={field === 'password' ? 8 : 2} maxLength={field === 'email' ? 254 : 128}
          value={form[field]} onChange={event => update(field, event.target.value)} />
      </label>)}
      <label className="grid gap-1 text-sm">Pais<select className="ofi-input" value={form.pais}
        onChange={event => update('pais', event.target.value as RegisterCitizenInput['pais'])}>
        {Object.entries({ AR: 'Argentina', MX: 'Mexico', CO: 'Colombia', CL: 'Chile', PE: 'Peru', EC: 'Ecuador',
          VE: 'Venezuela', BO: 'Bolivia', PY: 'Paraguay', UY: 'Uruguay' }).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select></label>
      <p className="text-sm text-gray-600">Por una contratacion efectiva dentro de OfiAI se suma un 10% al importe del servicio. No hay cuota mensual.</p>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button className="ofi-btn-primary justify-center" disabled={loading}><UserPlus size={18} />{loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}</button>
    </form>
    <Link className="mt-5 inline-block text-sm" to="/login">Ya tengo cuenta</Link>
  </AuthLayout>;
}
