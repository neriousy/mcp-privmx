import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'privmx-chat',
    // forward environment configuration without extra code
  });
}
