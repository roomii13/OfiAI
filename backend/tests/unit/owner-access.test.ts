/** @archivo owner-access.test.ts @descripcion Compatibilidad OWNER sin degradar perfiles ni conceder permisos por etiqueta. */
import { firestore } from '../../src/integrations/firebase/admin';
import { userRepository } from '../../src/repositories/user.repository';
import { operationsRepository } from '../../src/repositories/operations.repository';
import { MemoryFirestore } from '../intake-fixtures';
jest.mock('../../src/integrations/firebase/admin',()=>({firestore:new (jest.requireActual('../intake-fixtures').MemoryFirestore)()}));
const db=firestore as unknown as MemoryFirestore;
beforeEach(async()=>{
  db.clear();
  await db.collection('users').doc('owner').set({id:'owner',nombre:'Propietaria',email:'romina.celis33@gmail.com',rol:'OWNER',activo:true,emailVerificado:false});
  await db.collection('financial_grants').doc('owner').set({uid:'owner',role:'OWNER',active:true,revision:1,permissions:[],limitsMinor:{}});
});
it.each(['romina.celis33@gmail.com','rom-cel@live.com.ar'])('proyecta %s como OWNER con acceso administrativo sin cambiar Firestore',async(email)=>{
  await db.collection('users').doc('owner').update({email,rol:'OWNER\n'});
  expect(await userRepository.findById('owner')).toMatchObject({rol:'admin',financialRole:'OWNER',emailVerificado:false});
  expect(await userRepository.findByEmail(email)).toMatchObject({id:'owner',rol:'admin',financialRole:'OWNER'});
  expect(db.documents.get('users/owner')?.rol).toBe('OWNER\n');
});
it.each([{active:false},{uid:'another-uid'},{role:'DISPUTE_ADMIN'}])('niega OWNER si su permiso es incompatible: %j',async(patch)=>{
  await db.collection('financial_grants').doc('owner').update(patch);
  expect(await userRepository.findById('owner')).toBeNull();
});
it('niega OWNER sin grant y para correos fuera de la lista cerrada',async()=>{
  await db.collection('users').doc('owner').update({email:'otra.persona@example.test'});
  expect(await userRepository.findById('owner')).toBeNull();
  db.documents.delete('financial_grants/owner');
  await db.collection('users').doc('owner').update({email:'romina.celis33@gmail.com'});
  expect(await userRepository.findById('owner')).toBeNull();
});
it('no restaura OWNER si el perfil esta deshabilitado',async()=>{
  await db.collection('users').doc('owner').update({activo:false});
  expect(await userRepository.findById('owner')).toBeNull();
});
it.each(['admin','profesional','empresa'])('no confia en financialRole guardado en un perfil %s sin permiso',async(rol)=>{
  await db.collection('users').doc('normal').set({rol,activo:true,email:'normal@example.test',financialRole:'OWNER'});
  expect(await userRepository.findById('normal')).toMatchObject({id:'normal',rol});
  expect(await userRepository.findById('normal')).not.toHaveProperty('financialRole');
});
it('moderacion general no puede suspender una cuenta OWNER',async()=>{
  await expect(operationsRepository.moderate('another-admin','owner','suspend_user','Prueba de permisos')).rejects.toMatchObject({codigoEstado:409});
  expect(db.documents.get('users/owner')?.activo).toBe(true);
});
