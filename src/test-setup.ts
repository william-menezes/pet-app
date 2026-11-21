/**
 * Ajustes de ambiente dos testes de unidade (jsdom). Roda antes de cada arquivo de teste.
 * O jsdom não implementa `matchMedia`, que o ngx-sonner (aviso temporário) consulta ao montar.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
