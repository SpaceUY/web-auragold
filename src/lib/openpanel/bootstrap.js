// Anexo B del PDF de pedidos de ingeniería (WEB-012A, pág. 18), transcrito tal cual.
import { createAuraAnalytics } from './openpanel.js';
// Supply these adapters from the existing CMP, environment and attribution code.
export function attachAuraAnalytics({
  publicClientId, production, replayReady = false,
  readConsent, subscribeConsent, readValidatedContext,
}) {
  const analytics = createAuraAnalytics({
    clientId: publicClientId, enabled: production === true,
    replayReady, getContext: readValidatedContext,
  });
  // subscribeConsent must run AFTER the CMP persists the new choice.
  const unsubscribe = subscribeConsent(choice => {
    void analytics.setConsent(choice);
  });
  void analytics.setConsent(readConsent());
  return { analytics, unsubscribe };
}
