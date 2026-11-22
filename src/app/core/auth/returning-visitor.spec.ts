import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { clearReturning, isReturning, markReturning } from './returning-visitor';

describe('returning-visitor', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.clear());

  const run = <T>(fn: () => T): T => TestBed.runInInjectionContext(fn);

  it('sem marca => false', () => {
    expect(run(() => isReturning())).toBe(false);
  });

  it('depois de marcar => true', () => {
    run(() => markReturning());
    expect(localStorage.getItem('faro.returning')).toBe('1');
    expect(run(() => isReturning())).toBe(true);
  });

  it('clearReturning remove a marca', () => {
    run(() => markReturning());
    run(() => clearReturning());
    expect(run(() => isReturning())).toBe(false);
  });

  it('storage lançando erro => false e nunca lança', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(run(() => isReturning())).toBe(false);
    expect(() => run(() => markReturning())).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });

  it('no servidor (sem navegador) => false e não grava', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    run(() => markReturning());
    expect(localStorage.getItem('faro.returning')).toBeNull();
    expect(run(() => isReturning())).toBe(false);
  });
});
