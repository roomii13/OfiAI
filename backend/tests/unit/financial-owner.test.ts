/** @archivo financial-owner.test.ts @descripcion Bootstrap OWNER aislado, sin modificar identidades reales. */
import { getAuth } from '../../src/config/firebase';
import { env } from '../../src/config/env';
import { firestore } from '../../src/integrations/firebase/admin';
import { provisionFinancialOwners } from '../../src/workers/financial-owner.worker';
import { MemoryFirestore } from '../intake-fixtures';

jest.mock('../../src/config/firebase',()=>({getAuth:()=>({getUserByEmail:mockGetUserByEmail})}));
jest.mock('../../src/integrations/firebase/admin',()=>({firestore:new (jest.requireActual('../intake-fixtures').MemoryFirestore)()}));
const mockGetUserByEmail=jest.fn();
const db=firestore as unknown as MemoryFirestore;
const project=env.FIREBASE_PROJECT_ID;

beforeEach(async()=>{
  db.clear();mockGetUserByEmail.mockReset();env.FIREBASE_PROJECT_ID='ofiai-2f357';
  mockGetUserByEmail.mockImplementation(async(email:string)=>{
    if(email!=='romina.celis33@gmail.com')throw Object.assign(new Error('missing'),{code:'auth/user-not-found'});
    return{uid:'owner',email,disabled:false,emailVerified:false,multiFactor:{enrolledFactors:[]}};
  });
  await db.collection('users').doc('owner').set({email:'romina.celis33@gmail.com',rol:'admin',activo:true,emailVerificado:false});
});
afterEach(()=>{env.FIREBASE_PROJECT_ID=project;});

it('dry-run admite la cuenta autorizada sin verificarla ni guardar permisos',async()=>{
  expect(await provisionFinancialOwners()).toEqual([
    {email:'romina.celis33@gmail.com',status:'eligible',mfaEnrolled:false},
    {email:'rom-cel@live.com.ar',status:'account_not_found',mfaEnrolled:false},
  ]);
  expect(db.documents.has('financial_grants/owner')).toBe(false);
  expect(db.documents.size).toBe(1);
});
it('provisiona unicamente el UID administrador existente y no duplica auditoria',async()=>{
  expect((await provisionFinancialOwners(true))[0]?.status).toBe('owner_configured');
  expect(db.documents.get('financial_grants/owner')).toMatchObject({uid:'owner',role:'OWNER',active:true,revision:1});
  expect(db.documents.get('users/owner')).toHaveProperty('emailVerificado',false);
  const count=db.documents.size;
  expect((await provisionFinancialOwners(true))[0]?.status).toBe('owner_already_configured');
  expect(db.documents.size).toBe(count);
  expect([...db.documents.values()].filter(d=>d.action==='owner_provisioned')).toHaveLength(1);
});
it.each([{rol:'empresa'},{activo:false},{email:'otro@example.test'}])('no eleva perfiles incompatibles: %j',async(patch)=>{
  await db.collection('users').doc('owner').update(patch);
  expect((await provisionFinancialOwners(true))[0]?.status).toBe('existing_admin_required');
  expect(db.documents.has('financial_grants/owner')).toBe(false);
});
it('rechaza una identidad Firebase deshabilitada aunque sea administradora',async()=>{
  mockGetUserByEmail.mockResolvedValueOnce({uid:'owner',disabled:true,emailVerified:false});
  expect((await provisionFinancialOwners(true))[0]?.status).toBe('account_disabled');
  expect(db.documents.has('financial_grants/owner')).toBe(false);
});
it('rechaza proyectos distintos antes de consultar identidades',async()=>{
  env.FIREBASE_PROJECT_ID='other-project';
  await expect(provisionFinancialOwners(true)).rejects.toThrow('proyecto autorizado');
  expect(getAuth().getUserByEmail).not.toHaveBeenCalled();
});
