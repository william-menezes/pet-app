import { lostElapsedLabel } from './lost-elapsed';

const NOW = Date.parse('2026-11-25T12:00:00Z');
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

describe('lostElapsedLabel', () => {
  it('menos de uma hora: poucos minutos', () => {
    expect(lostElapsedLabel(ago(0), NOW)).toBe('há poucos minutos');
    expect(lostElapsedLabel(ago(59), NOW)).toBe('há poucos minutos');
  });

  it('horas até 48 h, com singular', () => {
    expect(lostElapsedLabel(ago(60), NOW)).toBe('há 1 hora');
    expect(lostElapsedLabel(ago(5 * 60 + 30), NOW)).toBe('há 5 horas');
    expect(lostElapsedLabel(ago(47 * 60 + 59), NOW)).toBe('há 47 horas');
  });

  it('depois de 48 h, dias', () => {
    expect(lostElapsedLabel(ago(48 * 60), NOW)).toBe('há 2 dias');
    expect(lostElapsedLabel(ago(75 * 60), NOW)).toBe('há 3 dias');
  });

  it('data inválida ou muito no futuro: null', () => {
    expect(lostElapsedLabel('ontem', NOW)).toBeNull();
    expect(lostElapsedLabel(ago(-30), NOW)).toBeNull();
  });
});
