/**
 * @archivo auth.types.ts
 * @descripcion
 * Tipos globales relacionados con autenticación.
 */

export type UserRole =
  | "company"
  | "professional"
  | "admin";


export type AccountStatus =
  | "active"
  | "inactive"
  | "suspended";


export interface AuthenticatedUser {

  uid: string;

  email: string;

  role: UserRole;

  status: AccountStatus;

}


export interface RegisterCompanyDTO {

  email: string;

  password: string;

  name: string;

  companyName: string;

  industry: string;

  location?: string;

}


export interface RegisterProfessionalDTO {

  email: string;

  password: string;

  name: string;

  profession: string;

  experience: number;

  location?: string;

}


export interface LoginDTO {

  email: string;

  password: string;

}