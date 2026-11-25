import { TestBed } from '@angular/core/testing';

import { ZardSkeletonComponent } from './skeleton.component';

describe('ZardSkeletonComponent', () => {
  it('pulsa em bg-muted com raio rounded-md e não é anunciado', () => {
    const fixture = TestBed.createComponent(ZardSkeletonComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const block = host.querySelector('[data-slot="skeleton"]') as HTMLElement;
    expect([...block.classList]).toEqual(expect.arrayContaining(['animate-pulse', 'rounded-md', 'bg-muted']));
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });
});
