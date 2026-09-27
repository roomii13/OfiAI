/** @archivo setup.ts @descripcion Entorno aislado que nunca carga secretos locales. */
process.env.NODE_ENV = 'test';
process.env.FIREBASE_PROJECT_ID = 'demo-ofiai';
process.env.FIREBASE_DATABASE_ID = '(default)';
process.env.FIREBASE_PRIVATE_KEY = '';
process.env.FIREBASE_CLIENT_EMAIL = '';
process.env.FIREBASE_API_KEY = 'emulator-only-key';
process.env.SCHEDULER_ENABLED = 'false';
process.env.GROQ_API_KEY = '';
process.env.GEMINI_API_KEY = '';
process.env.DEEPSEEK_API_KEY = '';
process.env.AI_LEGACY_FALLBACK_ENABLED = 'false';
process.env.AI_BUSINESS_LLM_ENABLED = 'false';
process.env.AI_COST_RATES_JSON = '{}';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
process.env.JWT_SECRET = 'ofiai-test-only-key-not-for-production';
process.env.MERCADOPAGO_NOTIFICATION_URL = 'https://example.test/api/v1/subscriptions/webhooks/mercadopago';
