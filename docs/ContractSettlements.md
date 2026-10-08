# Cobros y liquidaciones de OfiAI

Estado al 2026-10-08: implementacion local, sin despliegue ni cobros reales en esta fase.

## Decision comercial vigente

- Profesionales y particulares: cuentas gratuitas. Las empresas conservan sus suscripciones.
- Comision general vigente autorizada: 1000 puntos basicos, es decir 10% del presupuesto profesional. Sustituye el 5% anterior solo para nuevos desgloses; no modifica acuerdos aceptados.
- La paga el contratante, adicional al presupuesto. No se descuenta del profesional.
- Se retiro el esquema de custodia. Checkout Pro es un cobro ordinario a la cuenta del token de Mercado Pago.
- Las transferencias al profesional las efectua la propietaria fuera de OfiAI. La aplicacion registra el comprobante, pero no ejecuta ni certifica la transferencia bancaria.
- Ambas confirmaciones de trabajo, ausencia de reclamo, cobro aprobado, neto suficiente y destino verificado habilitan el registro de liquidacion. Esto no inmoviliza dinero ni consulta el saldo disponible actual de la cuenta.

Ejemplo con la referencia de acreditacion inmediata elegida: presupuesto ARS 100.000; profesional ARS 100.000; OfiAI ARS 10.000; procesamiento estimado ARS 7.488,98; IVA sobre procesamiento ARS 1.572,69; total ARS 119.061,67. Solo contempla esos cargos: faltan validar posibles retenciones, impuestos sobre la comision y condiciones particulares de la cuenta.

Referencia publica revisada el 2026-10-08: [Checkout Mercado Pago](https://www.mercadopago.com.ar/herramientas-para-vender/check-out), 6,29% mas IVA. Se configura para ARS como `processorBps=629` y `processorTaxBps=2100`; equivale matematicamente a 7,6109%, no a una tasa truncada de 7,61%. `providerChargesVerified` permanece `false`: la tabla publica no confirma el domicilio fiscal, los medios admitidos ni las tarifas particulares de la cuenta. Tampoco cambia por API la preferencia de acreditacion de Mercado Pago.

El simulador compartido mostraba ARS 119.061,66. OfiAI obtiene ARS 119.061,67 al redondear por separado procesamiento e IVA a centavos, antes de sumarlos. El neto final debe conciliarse con el proveedor y no se considera garantizado por esta estimacion.

## Arquitectura y calculo

Se reutilizan Express, autenticacion Firebase, Coordinator, cliente Mercado Pago y repositorios Firestore. Los archivos `protected-contract.*` conservan su nombre interno inicial, pero no implementan custodia ni liberacion de fondos.

El servidor obtiene el presupuesto aceptado de Coordinator. Nunca recibe el importe final o el destinatario como autoridad desde React/Expo. Trabaja en unidades minimas con BigInt y redondeo half-up:

```
comision = presupuesto * comisionBps / 10000
impuestoPlataforma = comision * platformTaxBps / 10000
procesamiento = total * processorBps / 10000 + processorFixedMinor
impuestoProcesamiento = procesamiento * processorTaxBps / 10000
retenciones = total * withholdingBps / 10000
total = presupuesto + comision + impuestoPlataforma
        + procesamiento + impuestoProcesamiento + retenciones
```

La ecuacion se resuelve por iteracion entera con limite y rechazo si no converge. No es una tabla fiscal universal: las bases admitidas deben coincidir con las condiciones efectivas del proveedor. Si no coinciden, se necesita ampliar el motor antes de activar cobros. Cada moneda tiene precision explicita; no se convierte automaticamente una moneda a otra.

La politica y el desglose se congelan al aceptar. Un cambio de comisiones crea una version nueva y no modifica acuerdos aceptados. Los desgloses no aceptados solo se actualizan por accion expresa. No se permite aceptar costos aun no verificados.

El panel distingue importe profesional, comision, procesamiento estimado, impuestos, total, cobro confirmado, costos efectivos informados, neto recibido y diferencia por cubrir. Un intento pendiente/rechazado no se muestra como cobrado. Si el neto no cubre al profesional, la comision completa y el impuesto configurado sobre ella, bloquea el registro: no reduce ninguno silenciosamente. No compensa automaticamente diferencias de tarifa ni redondeo.

## Estados y permisos

El estado de trabajo permanece en Coordinator; el expediente registra las confirmaciones y `BOTH_APPROVED`. El estado financiero es independiente: `UNPAID`, `PAYMENT_PENDING`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CHARGEBACK`. `PAID` indica el cobro al contratante, no que se haya transferido al profesional.

- Participantes: acceso solo a su acuerdo; contratante acepta desglose y ambos pueden reclamar/aportar evidencia.
- Profesional: edita unicamente su cuenta privada de cobro; cambiarla revoca su verificacion.
- OWNER: bandeja financiera, verificacion de destinos, registro manual, comisiones y permisos.
- Unicos correos permitidos para OWNER: `romina.celis33@gmail.com` y `rom-cel@live.com.ar`. La API exige token Firebase valido, rol administrador autoritativo y grant OWNER activo ligado al UID. Por decision expresa de la propietaria no exige `email_verified` ni MFA para esas cuentas. Ni escribir ese correo en un formulario ni asignar un grant OWNER a otro correo permite entrar. La lista es compartida con el bootstrap y no editable por HTTP.
- Compatibilidad de perfiles OWNER: se conserva el valor almacenado (`OWNER`, `owner` o con espacios accidentales). El repositorio valida UID, correo y grant vigente antes de proyectar `rol: admin` como capacidad operativa compatible y `financialRole: OWNER` como identificacion de propietaria. No reescribe Firestore. Web y movil muestran OWNER; las rutas existentes siguen funcionando sin duplicar la arquitectura de roles.
- DISPUTE_ADMIN: solo expedientes asignados y capacidades concedidas. No puede nombrar administradores, cambiar comisiones ni gestionar liquidaciones del OWNER.
- Operaciones administrativas sensibles: autenticacion de los ultimos 10 minutos para todos; MFA adicional para DISPUTE_ADMIN, sin exigirlo a los dos OWNER autorizados. La excepcion reduce la defensa contra robo de contrasenas y no se extiende a administradores generales.
- Permisos activos se releen en servidor; el rol general `admin` no basta. Se rechazan conflictos de interes.
- Propuesta y aprobacion de resoluciones financieras son acciones separadas. Segun umbral se exige aprobador independiente. Ninguna resolucion mueve fondos.

Bootstrap de OWNER: `node dist/workers/financial-owner.worker.js` comprueba, sin escribir. `--apply` concede solo a las identidades Firebase autorizadas, habilitadas y ya existentes con perfil activo admin/OWNER. No exige verificacion de correo ni MFA, no crea usuarios, no cambia el rol persistido, contrasenas ni factores inscritos, no marca correos como verificados y no hay endpoint para autootorgarse OWNER. El alta deja auditoria y repetirla no duplica un permiso activo.

## Endpoints nuevos

Prefijo `/api/v1`. Requieren Firebase ID token salvo webhook firmado.

| Metodo | Ruta | Uso |
| --- | --- | --- |
| GET / POST | `/jobs/:id/contract` | Consultar / preparar desglose del acuerdo |
| POST | `/jobs/:id/contract/commands` | Aceptar, reclamar, mensaje, apelar, asignar, proponer/aprobar resolucion |
| GET | `/jobs/:id/contract/entries` | Mensajes y metadata de evidencias |
| GET | `/jobs/:id/contract/audit` | Auditoria autorizada |
| POST | `/jobs/:id/contract/advice` | Asistencia no vinculante de IA |
| POST | `/jobs/:id/contract/evidence` | JPEG/PNG/PDF privado de hasta 4 MB |
| GET | `/jobs/:id/contract/evidence/:evidenceId` | Descarga autenticada con comprobacion de integridad |
| GET | `/resolution` | Reclamos recientes segun permisos |
| GET | `/resolution/policy/:currency` | Politica vigente, OWNER |
| PUT | `/resolution/policy` | Nueva version, OWNER + sesion reciente |
| PUT | `/resolution/grants` | Conceder/revocar DISPUTE_ADMIN, OWNER + sesion reciente |
| GET | `/settlements` | Bandeja financiera, OWNER |
| GET / PUT | `/settlements/account` | Cuenta privada del profesional |
| POST | `/settlements/accounts/:id/verify` | Verificacion manual por OWNER + sesion reciente |
| POST | `/settlements/:id/checkout` | Checkout ordinario del acuerdo aceptado |
| POST | `/settlements/:id/record-transfer` | Registrar transferencia externa, OWNER + sesion reciente |
| POST | `/settlements/webhooks/mercadopago` | Firma y consulta canonica del proveedor |

Tambien se incorporaron `/auth/register/citizen` y GET/POST `/jobs/:id/review` para particulares y evaluaciones de trabajos completados. Se conservan endpoints de suscripciones.

## Firestore y Storage

Base configurada: `FIREBASE_DATABASE_ID`; `default` y `(default)` no son intercambiables.

| Coleccion | Contenido |
| --- | --- |
| `contract_agreements/{jobId}` | Snapshot comercial, politica, estados, confirmaciones y reclamo |
| `contract_agreements/{jobId}/commands` | UUID, huella y actor para idempotencia |
| `contract_agreements/{jobId}/entries` | Mensajes, apelaciones y referencias de evidencias inmutables |
| `contract_agreements/{jobId}/evidence` | Ruta privada, hash, MIME, tamano, fecha y actor |
| `contract_policies/{currency}/versions/{version}` | Historial inmutable; documento padre es politica vigente |
| `financial_grants/{uid}` | Permisos revocables, limites, asignacion OWNER/DISPUTE_ADMIN |
| `financial_audit/{uuid}` | Eventos append-only con fecha servidor y correlacion |
| `settlement_accounts/{uid}` | Titular, alias/CBU/CVU, moneda, version y verificacion manual |
| `contract_checkouts/{jobId}` | Reserva unica, referencia y preferencia del proveedor |
| `contract_payment_receipts/{jobId}` | Estado canonico, importe, neto, devolucion y fechas |
| `contract_payment_receipts/{jobId}/duplicates` | Segundo cobro detectado, requiere conciliacion |
| `contract_transfers/{jobId}` | Registro manual unico, destino historico, importe y comprobante |
| `settlement_references/{hash}` | Impide reutilizar comprobantes entre trabajos |

Storage: `contract-evidence/{jobId}/{uuid}`. Sin URL publica; subida con precondicion de creacion y SHA-256 comprobado en descarga. Las cuentas bancarias no se incluyen en perfiles publicos ni prompts. Auditoria no guarda claves ni cuentas completas.

Reglas locales: denegacion explicita del SDK cliente para las colecciones anteriores y evidencias. Admin SDK solo accede a traves de autorizacion Express. No se necesitan nuevos indices compuestos para estas consultas. No se borra ni migra masivamente informacion existente; expedientes se crean desde presupuestos vigentes, no retroactivamente para trabajos completados.

No desplegar automaticamente todo el archivo local de reglas sobre produccion: en la inspeccion de esta sesion el entorno publicado tenia reglas globales cerradas, diferentes del archivo local. Se requiere revisar diferencias y probarlas en emulador antes de publicarlas.

## Mercado Pago

Se conserva el cliente existente. El webhook valida firma `x-signature`, `x-request-id`, concordancia del ID, pago canonico por API, cuenta receptora, moneda, entorno, referencia del Job e importe exacto. No confia en importes enviados por el webhook o el navegador. Eventos repetidos/anteriores no duplican la acreditacion y reembolsos/contracargos bloquean liquidaciones.

Solo una preferencia por Job; ante timeout busca por referencia antes de reintentar. Si expira o su resultado es incierto, exige conciliacion, no emite un segundo checkout ciegamente. No hay transferencias automaticas, split ni custodia. El registro manual es una declaracion del operador, no confirmacion del banco. Las confirmaciones de trabajo no ordenan pagos.

La integracion de contrataciones limita inicialmente el checkout a ARS. El motor de presupuestos puede calcular otras monedas, pero eso no habilita cobros ni destinos bancarios para ellas. Reembolsos/contracargos se reconcilian al recibir notificacion; su ejecucion no esta implementada en este modulo.

## Variables

Nueva: `CONTRACT_PAYMENTS_ENABLED=false`. Activarla solo tras validar el circuito completo. No altera la habilitacion existente de suscripciones.

Reutilizadas: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_NOTIFICATION_URL`, `CORS_ORIGINS`, Firebase y proveedor IA existentes. El webhook de contrataciones usa el origen de `MERCADOPAGO_NOTIFICATION_URL` con ruta `/api/v1/settlements/webhooks/mercadopago`; cada preferencia incluye esa URL. Retornos usan el primer origen HTTPS permitido. No se agregaron secretos a archivos fuente ni clientes.

`BILLING_TRANSACTION_FEE_BPS` es legado; el nuevo motor parte de `CONTRACT_FEE_BASIS_POINTS=1000` y luego utiliza la politica versionada por moneda/categoria. `CONTRACT_FEE_POLICY_VERSION=2026-10-08-fee-10pct` identifica el cambio sin alterar el catalogo de suscripciones. Las politicas ya guardadas en Firestore no se sobrescriben con defaults de codigo; un cambio requiere publicar una nueva version desde OWNER.

## Web y Expo 54

- Web `/admin/settlements`: busqueda, filtro por estado, detalle, destino, comision y registro manual; configuracion versionada de costos.
- Web profesional, Configuracion: cuenta privada de cobro.
- Web Coordinator: expediente, desglose, consentimiento, checkout y mensajes de reclamo.
- Expo 54 Admin: bandeja y detalle de liquidaciones, verificacion y registro manual.
- Expo profesional: cuenta de cobro; Coordinator: mismo desglose, consentimiento, pago y reclamo.
- Los resultados se leen de API; no se sembraron clientes, ingresos ni transferencias en produccion.

## Verificacion local ejecutada

- Backend: compilacion TypeScript correcta; 30 suites / 340 tests aprobados.
- Web: TypeScript y Vite build correctos; 11 archivos / 98 tests aprobados.
- Mobile Expo 54: TypeScript correcto; 12 suites / 52 tests aprobados.
- QA visual del componente web con Playwright/Chrome temporal a 1440x1000 y 390x844: detalle y configuracion sin desborde horizontal; boton de registro bloqueado hasta consentimiento. Capturas inspeccionadas con datos sinteticos y todas las llamadas externas bloqueadas. No es prueba E2E con autenticacion, Firestore ni Android nativo.
- Casos nuevos: comision adicional, gross-up entero, monedas, ownership, snapshot, consentimiento, MFA, revocacion, doble registro concurrente, deficit de comision, duplicados, devolucion parcial, contracargo, firma falsa, cuenta receptora incorrecta, importes manipulados y paneles web/movil. Las comprobaciones originales del 5% corresponden a la version anterior; ver la validacion del cambio al 10% debajo.
- Son pruebas con Firestore/proveedor aislados. No sustituyen emulador, dispositivo o Mercado Pago real.
- Advertencias previas: tests moviles de otras pantallas necesitan completar `act`; Vite informa chunk grande y uso de `__dirname` en configuracion.
- El navegador aislado bloqueo el WebSocket de recarga de Vite; no impidio el render ni las comprobaciones del componente. La prueba inicial tambien requirio adaptar el import del bundle React del entorno de pruebas; no fue un error de la aplicacion.

### Validacion anterior: 10% y propietarios exclusivos, antes de la excepcion de autenticacion

- Backend: 30 suites / 349 tests aprobados y compilacion correcta.
- Web: 11 archivos / 98 tests aprobados; TypeScript y build correctos.
- Expo 54: 12 suites / 52 tests aprobados; TypeScript correcto.
- Nuevas regresiones: comision 10%, referencia inmediata con IVA separado, preservacion de acuerdos aceptados al 5%, no aplicar cargos ARS a otras monedas y rechazo de OWNER con correo ajeno/no verificado aun existiendo un grant.
- Dry-run Firebase posterior: Gmail continua sin verificar y sin MFA; la segunda cuenta autorizada no existe. No se escribieron grants ni se marcaron correos verificados.
- Los cambios no se desplegaron. Se conserva `CONTRACT_PAYMENTS_ENABLED=false`.

### Excepcion OWNER autorizada el 2026-10-08

- Se retiraron la verificacion obligatoria de correo y MFA solo para los dos correos OWNER permitidos, con grant activo y rol administrador del servidor. Se mantiene autenticacion reciente, revocacion, auditoria, doble aprobacion y MFA de administradores delegados.
- Backend: compilacion correcta; 31 suites / 363 tests aprobados. Incluye 52 pruebas focalizadas de contratos, API y bootstrap, con rechazo de correos ajenos, grants ausentes/revocados, fechas de autenticacion invalidas y elevacion de perfiles no administradores.
- Ejecucion real de bootstrap: `romina.celis33@gmail.com` obtuvo OWNER (`owner_configured`) con auditoria. `rom-cel@live.com.ar` no existe (`account_not_found`) y no se creo automaticamente.
- En una lectura posterior ambas identidades ya existian con `rol: owner`, incompatible con el rol base `admin` que entiende OfiAI. Gmail conservaba el grant OWNER; Live no tenia grant y carecia de `activo: true`. Se solicito autorizacion para normalizar esos perfiles sin cambiar contrasenas. Esta diferencia impide considerar operativo el acceso actual.
- Tras autorizacion expresa se normalizaron ambos perfiles en una transaccion: UID conservado, `rol: admin`, `tipoCuenta: admin`, `activo: true` y grant OWNER activo. Se sincronizo `rol: admin` en Firebase Auth conservando las demas claims. La lectura posterior confirmo los dos permisos y ambos correos siguieron sin verificar y sin factores MFA. Las escrituras dejaron auditoria; no se cambiaron contrasenas. Esto corrige la incompatibilidad anterior, pero no sustituye el despliegue del backend.
- No se marcaron correos como verificados, no se modificaron contrasenas ni se activaron pagos. El codigo actualizado necesita desplegarse en Render para aplicar la excepcion en la API publicada.

## Pendientes antes de habilitar

1. Publicar y comprobar la compatibilidad OWNER contra `/auth/me`, dashboard y liquidaciones con ambas identidades. No reemplazar de nuevo OWNER por admin en Firestore para resolver el acceso. La verificacion de correo y MFA ya no son condiciones para OWNER en esta version.
2. Configurar tarifas, impuestos y condiciones efectivas, confirmar aplicabilidad comercial del cobro y pago posterior manual con el proveedor/asesoria correspondiente. La aplicacion no convierte el saldo ordinario en custodia.
3. Validar checkout, entrega originada por Mercado Pago, rechazo, devoluciones, contracargos y recuperacion de timeouts con cuentas de prueba. No se ejecutaron cobros reales.
4. Completar conciliacion periodica y recuperacion operativa de preferencias vencidas, cobros duplicados y diferencias de neto. Por ahora quedan bloqueados para revision.
5. Cerrar interfaz administrativa de disputas, apelaciones, evidencias, permisos y asistencia IA. El backend existe; los paneles de participantes permiten apertura/mensajes, no todo el Centro de Resolucion solicitado.
6. Una disputa bloquea liquidacion incluso tras resolucion hasta implementar su ejecucion/revision financiera explicita. No hay liberacion automatica por una recomendacion o resolucion.
7. Completar configuracion de comisiones/permisos en movil, paginacion de bandeja (actualmente 50 recientes), onboarding MFA para administradores delegados y pruebas Android/iOS fisicas.
8. Validar reglas en emulador, revisar las reglas publicadas y desplegar API/web. No se hizo despliegue ni se habilito el flag de contrataciones en esta fase.

## Archivos de esta fase

Nuevos:

```
backend/src/ai/agents/dispute.agent.ts
backend/src/ai/prompts/dispute.prompt.ts
backend/src/constants/protected-payments.ts
backend/src/controllers/protected-contract.controller.ts
backend/src/domain/jobs/protected-contract.ts
backend/src/models/protected-contract.model.ts
backend/src/repositories/protected-contract.repository.ts
backend/src/repositories/settlement.repository.ts
backend/src/routes/protected-contract.routes.ts
backend/src/routes/settlement.routes.ts
backend/src/services/protected-contract.service.ts
backend/src/services/settlement.service.ts
backend/src/utils/contract-money.ts
backend/src/validators/protected-contract.validator.ts
backend/src/workers/financial-owner.worker.ts
backend/tests/api/settlements.test.ts
backend/tests/unit/contract-settlements.test.ts
shared/protected-contract.d.ts
shared/settlements.d.ts
web/src/app/ContractAgreementPanel.tsx
web/src/app/ContractFeeSettings.tsx
web/src/app/SettlementsPage.tsx
web/src/app/SettlementsPage.test.tsx
mobile/src/navigation/SettlementPanels.tsx
mobile/src/navigation/SettlementPanels.test.tsx
docs/ContractSettlements.md
```

Integraciones modificadas:

```
backend/.env.example
backend/src/ai/tools/business-ai.tool.ts
backend/src/config/env.ts
backend/src/integrations/mercadopago/index.ts
backend/src/middleware/auth.middleware.ts
backend/src/repositories/coordinator.repository.ts
backend/src/routes/index.ts
backend/src/routes/jobs.routes.ts
backend/tests/api/billing.test.ts
shared/firestore.rules
shared/storage.rules
web/src/app/CoordinatorPage.tsx
web/src/app/ContractChargesPanel.tsx
web/src/app/Router.tsx
web/src/layouts/DashboardLayout.tsx
mobile/src/navigation/ContractReviewPanels.tsx
mobile/src/navigation/JobCoordinatorScreen.tsx
mobile/src/navigation/index.tsx
```

El checkout conserva ademas cambios previos de cuentas gratuitas, registro particular y reviews. Los cambios que ya estaban staged en `.gitignore`, `backend/package.json` y su lockfile se conservaron, sin revertirlos ni atribuirlos a esta fase.
