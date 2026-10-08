/**
 * @archivo auth.service.ts
 * @descripcion Servicio de lógica de negocio para el módulo de autenticación de OfiAI.
 * Coordina Firebase Auth, Firestore Repositories, Resend y la asignación de roles RBAC.
 * @modulo Services
 */

import {
  createFirebaseUser,
  verifyFirebasePassword,
  generatePasswordResetLink,
  revokeUserRefreshTokens,
} from '../integrations/firebase/auth';
import { firebaseAuth, firestore } from '../integrations/firebase/admin';
import { userRepository } from '../repositories/user.repository';
import { Usuario } from '../models/User';
import { Empresa } from '../models/Company';
import { Profesional } from '../models/Professional';
import { COLECCIONES } from '../database/firestore/collections';
import {
  DatosRegistroEmpresa,
  DatosRegistroParticular,
  DatosRegistroProfesional,
  DatosLogin,
} from '../validators/auth.validator';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../config/logger';
import { enviarEmailResend } from '../integrations/resend';

export interface RespuestaAuth {
  usuario: Usuario;
  customToken?: string;
  perfilEspecifico?: Empresa | Profesional | null;
}

/** Coordina autenticacion verificada y perfiles de usuario. */
class AuthService {
  /** Guarda preferencias de canales exclusivamente para la cuenta autenticada. */
  async updatePreferences(uid: string, preferences: NonNullable<Usuario['preferenciasNotificaciones']>): Promise<void> {
    await userRepository.update(uid, { preferenciasNotificaciones: preferences });
  }

  /**
   * Registra una nueva empresa en OfiAI.
   * Crea el usuario en Firebase Auth, asigna claim 'empresa', guarda el Usuario en Firestore y crea el perfil Empresa.
   */
  async registerCompany(datos: DatosRegistroEmpresa): Promise<RespuestaAuth> {
    return this.registerContractor(datos, 'empresa');
  }

  /** Crea un contratante particular gratuito usando el mismo aislamiento de Jobs. */
  async registerCitizen(datos: DatosRegistroParticular): Promise<RespuestaAuth> {
    return this.registerContractor({
      ...datos, nombreEmpresa: [datos.nombre, datos.apellido].join(' '),
      industria: 'Servicios particulares', tamanoEmpresa: 'micro',
    }, 'particular');
  }

  /** Conserva el rol de contratante existente; el tipo de cuenta lo decide el servidor. */
  private async registerContractor(datos: DatosRegistroEmpresa, tipoCuenta: 'empresa' | 'particular'): Promise<RespuestaAuth> {
    const usuarioExistente = await userRepository.findByEmail(datos.email);
    if (usuarioExistente) {
      throw new ApiError('El correo electrónico ya se encuentra registrado.', 400);
    }

    // 1. Crear usuario en Firebase Auth con claim de rol 'empresa'
    const firebaseUser = await createFirebaseUser(
      datos.email,
      datos.password,
      datos.nombre,
      'empresa'
    );

    const fechaActual = new Date();

    // 2. Construir modelo de usuario base
    const nuevoUsuario: Usuario = {
      id: firebaseUser.uid,
      email: datos.email,
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      rol: 'empresa',
      tipoCuenta,
      pais: datos.pais,
      idioma: 'es-LA' as const,
      emailVerificado: false,
      activo: true,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    // 3. Guardar usuario en colección 'users'
    await userRepository.create(nuevoUsuario);

    // 4. Crear documento específico de Empresa en colección 'companies'
    const perfilEmpresa: Empresa = {
      id: firestore.collection(COLECCIONES.EMPRESAS).doc().id,
      usuarioId: firebaseUser.uid,
      tipoCuenta,
      nombreEmpresa: datos.nombreEmpresa,
      industria: datos.industria,
      tamanoEmpresa: datos.tamanoEmpresa,
      rut: datos.rut,
      pais: datos.pais,
      ciudad: datos.ciudad,
      suscripcionActiva: false,
      totalContrataciones: 0,
      calificacionPromedio: 5.0,
      activo: true,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    await firestore.collection(COLECCIONES.EMPRESAS).doc(perfilEmpresa.id).set(perfilEmpresa);
    logger.info(`🏢 Perfil de empresa registrado exitosamente para UID: ${firebaseUser.uid}`);

    // 5. Generar Custom Token para iniciar sesión inmediatamente en el cliente
    const customToken = await firebaseAuth.createCustomToken(firebaseUser.uid, { rol: 'empresa' });

    return {
      usuario: nuevoUsuario,
      customToken,
      perfilEspecifico: perfilEmpresa,
    };
  }

  /**
   * Registra un nuevo profesional de oficios en OfiAI.
   * Crea el usuario en Firebase Auth, asigna claim 'profesional', guarda el Usuario en Firestore y crea el perfil Profesional.
   */
  async registerProfessional(datos: DatosRegistroProfesional): Promise<RespuestaAuth> {
    const usuarioExistente = await userRepository.findByEmail(datos.email);
    if (usuarioExistente) {
      throw new ApiError('El correo electrónico ya se encuentra registrado.', 400);
    }

    // 1. Crear usuario en Firebase Auth con claim de rol 'profesional'
    const firebaseUser = await createFirebaseUser(
      datos.email,
      datos.password,
      `${datos.nombre} ${datos.apellido}`,
      'profesional'
    );

    const fechaActual = new Date();

    // 2. Construir modelo de usuario base
    const nuevoUsuario: Usuario = {
      id: firebaseUser.uid,
      email: datos.email,
      nombre: datos.nombre,
      apellido: datos.apellido,
      telefono: datos.telefono,
      rol: 'profesional',
      tipoCuenta: 'profesional',
      pais: datos.pais,
      idioma: 'es-LA' as const,
      emailVerificado: false,
      activo: true,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    // 3. Guardar usuario en colección 'users'
    await userRepository.create(nuevoUsuario);

    // 4. Crear documento específico de Profesional en colección 'professionals'
    const perfilProfesional: Profesional = {
      id: firestore.collection(COLECCIONES.PROFESIONALES).doc().id,
      usuarioId: firebaseUser.uid,
      nombre: datos.nombre,
      apellido: datos.apellido,
      especialidades: datos.especialidades,
      categorias: datos.categorias,
      aniosExperiencia: datos.aniosExperiencia,
      tarifaHora: datos.tarifaHora,
      moneda: 'USD',
      disponible: true,
      pais: datos.pais,
      ciudad: datos.ciudad,
      calificacionPromedio: 5.0,
      totalResenas: 0,
      totalTrabajos: 0,
      verificado: false,
      fechaCreacion: fechaActual,
      fechaActualizacion: fechaActual,
    };

    await firestore.collection(COLECCIONES.PROFESIONALES).doc(perfilProfesional.id).set(perfilProfesional);
    logger.info(`👷 Perfil profesional registrado exitosamente para UID: ${firebaseUser.uid}`);

    // 5. Generar Custom Token para el cliente
    const customToken = await firebaseAuth.createCustomToken(firebaseUser.uid, { rol: 'profesional' });

    return {
      usuario: nuevoUsuario,
      customToken,
      perfilEspecifico: perfilProfesional,
    };
  }

  /**
   * Inicia sesión verificando la existencia y estado activo del usuario en Firestore.
   * Genera un custom token para autenticación segura en el SDK de cliente de Firebase.
   */
  async login(datos: DatosLogin): Promise<RespuestaAuth> {
    const verifiedUid = await verifyFirebasePassword(datos.email, datos.password);
    const usuario = await userRepository.findByEmail(datos.email);
    if (!usuario) {
      throw new ApiError('Credenciales de acceso inválidas.', 401);
    }

    if (!usuario.activo) {
      throw new ApiError('La cuenta de usuario se encuentra suspendida o deshabilitada.', 403);
    }

    // Verificar existencia del registro en Firebase Auth
    if (verifiedUid !== usuario.id) {
      throw new ApiError('Credenciales de acceso inválidas.', 401);
    }

    // Actualizar timestamp de último acceso
    await userRepository.update(usuario.id, { ultimoAcceso: new Date() });

    // Generar Custom Token con Custom Claims de rol incorporado
    const customToken = await firebaseAuth.createCustomToken(usuario.id, { rol: usuario.rol });

    return {
      usuario,
      customToken,
    };
  }

  /**
   * Solicita un enlace de recuperación de contraseña vía Firebase Auth.
   */
  async recoverPassword(email: string): Promise<void> {
    const usuario = await userRepository.findByEmail(email);
    if (!usuario) {
      // Por seguridad no se revela si el email existe o no
      logger.info(`Solicitud de recuperación de clave para email no registrado: ${email}`);
      return;
    }

    const link = await generatePasswordResetLink(email);
    logger.info(`Enlace de recuperación generado para ${email}`);

    await enviarEmailResend({ to: email, subject: 'Restablecer contrasena de OfiAI', text: `Restablece tu contrasena en este enlace: ${link}` });
  }

  /**
   * Obtiene el perfil completo de un usuario autenticado por su UID.
   */
  async getUserProfile(uid: string): Promise<RespuestaAuth> {
    const usuario = await userRepository.findById(uid);
    if (!usuario) {
      throw new ApiError('Usuario no encontrado.', 404);
    }

    let perfilEspecifico: Empresa | Profesional | null = null;

    if (usuario.rol === 'empresa') {
      const snap = await firestore
        .collection(COLECCIONES.EMPRESAS)
        .where('usuarioId', '==', uid)
        .limit(1)
        .get();
      if (!snap.empty) {
        perfilEspecifico = snap.docs[0]?.data() as Empresa;
      }
    } else if (usuario.rol === 'profesional') {
      const snap = await firestore
        .collection(COLECCIONES.PROFESIONALES)
        .where('usuarioId', '==', uid)
        .limit(1)
        .get();
      if (!snap.empty) {
        perfilEspecifico = snap.docs[0]?.data() as Profesional;
      }
    }

    return {
      usuario,
      perfilEspecifico,
    };
  }

  /**
   * Cierra sesión del usuario revocando sus refresh tokens en Firebase Auth.
   */
  async logout(uid: string): Promise<void> {
    await revokeUserRefreshTokens(uid);
    logger.info(`Sesión cerrada exitosamente para usuario UID: ${uid}`);
  }
}

export const authService = new AuthService();
