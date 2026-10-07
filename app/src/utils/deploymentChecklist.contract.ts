import { deviceVerificationSteps } from './deploymentChecklist';

for (const required of [
  'tablet-orientation',
  'camera-permission',
  'front-and-back-capture',
  'scan-upload',
  'llm-review',
  'manual-fallback',
]) {
  if (!deviceVerificationSteps.some((step) => step.id === required)) {
    throw new Error(`Missing device verification step: ${required}`);
  }
}
