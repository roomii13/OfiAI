/** @archivo financial-owner.worker.ts @descripcion Alta puntual de OWNER por identidades Firebase verificadas y autorizadas por la propietaria. */
import { randomUUID } from 'node:crypto';
import { getAuth } from '../config/firebase';
import { firestore } from '../integrations/firebase/admin';
import { ProtectedContractRepository } from '../repositories/protected-contract.repository';
import { PROTECTED_COLLECTIONS as P, FINANCIAL_OWNER_EMAILS } from '../constants/protected-payments';
import { env } from '../config/env';
/** No crea usuarios ni acepta correos desde HTTP. Dry-run por defecto y proyecto exacto. */
export async function provisionFinancialOwners(apply=false):Promise<Array<{email:string;status:string;mfaEnrolled:boolean}>> {
  if(env.FIREBASE_PROJECT_ID!=='ofiai-2f357') throw new Error('El alta OWNER solo admite el proyecto autorizado.');
  const output:Array<{email:string;status:string;mfaEnrolled:boolean}>=[];
  for(const email of FINANCIAL_OWNER_EMAILS){
    const identity=await getAuth().getUserByEmail(email).catch((error:unknown)=>{
      if(error && typeof error==='object' && 'code' in error && error.code==='auth/user-not-found')return null;throw error;
    });
    if(!identity){output.push({email,status:'account_not_found',mfaEnrolled:false});continue;}
    const mfaEnrolled=Boolean(identity.multiFactor?.enrolledFactors.length);
    if(identity.disabled||!identity.emailVerified){output.push({email,status:'verified_identity_required',mfaEnrolled});continue;}
    const status=await firestore.runTransaction(async tx=>{
      const user=(await tx.get(firestore.collection('users').doc(identity.uid))).data();
      const ref=firestore.collection(P.grants).doc(identity.uid);const previous=(await tx.get(ref)).data();
      if(!user?.activo||user.rol!=='admin'||String(user.email).toLowerCase()!==email)return 'existing_admin_required';
      if(previous?.role==='OWNER'&&previous.active)return 'owner_already_configured';
      if(!apply)return 'eligible';
      tx.set(ref,{uid:identity.uid,role:'OWNER',active:true,revision:(previous?.revision ?? 0)+1,permissions:['view','communicate','propose','resolve','finance'],limitsMinor:{},updatedAt:new Date().toISOString()});
      new ProtectedContractRepository(firestore).audit(tx,identity.uid,{uid:'trusted-bootstrap',rol:'admin'},'owner_provisioned',previous?.role ?? null,'OWNER',randomUUID(),'Identidad verificada y autorizada por la propietaria.');
      return 'owner_configured';
    });
    output.push({email,status,mfaEnrolled});
  }
  return output;
}
if(require.main===module){
  provisionFinancialOwners(process.argv.includes('--apply')).then(result=>{process.stdout.write(JSON.stringify(result,null,2)+'\n');}).catch(()=>{process.stderr.write('No se pudo verificar/configurar OWNER. No se muestran detalles de credenciales.\n');process.exitCode=1;}).finally(()=>firestore.terminate());
}
