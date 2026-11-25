const OLD_CACHE_PREFIX = 'ngsw:';

/**
 * Limpa o que o service worker antigo (Angular `ngsw`) deixou no aparelho: cancela todos os
 * registros e apaga só os caches `ngsw:*`. O Faro não usa service worker (spec 002, research §R12,
 * camada 2). Nunca lança: qualquer falha é engolida, porque isto não pode atrapalhar o carregamento.
 */
export async function unregisterServiceWorkers(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    }
  } catch {
    // sem permissão, contexto inseguro ou navegador sem suporte: segue
  }
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith(OLD_CACHE_PREFIX)).map((name) => caches.delete(name)));
    }
  } catch {
    // idem
  }
}
