/**
 * @archivo user.model.ts
 * @descripcion
 * Modelo principal de usuarios OfiAI.
 */


import {
  UserRole,
  AccountStatus
} from "../types/auth.types";


export interface UserModel {


  uid: string;


  email: string;


  name: string;


  role: UserRole;


  status: AccountStatus;


  createdAt: Date;


  updatedAt: Date;



  // Datos empresa
  company?: {

    companyName: string;

    industry: string;

    location?: string;

  };



  // Datos profesional
  professional?: {

    profession: string;

    experience: number;

    location?: string;

  };


}