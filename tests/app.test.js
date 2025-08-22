const { formatearCOP, safeParseInt } = require('../app');

describe('formatearCOP', () => {
  test('formatea números en pesos colombianos sin decimales', () => {
    expect(formatearCOP(1234)).toBe('$\u00A01.234');
  });
  test('maneja cero correctamente', () => {
    expect(formatearCOP(0)).toBe('$\u00A00');
  });
});

describe('safeParseInt', () => {
  test('convierte cadenas numéricas a enteros', () => {
    expect(safeParseInt('42')).toBe(42);
  });
  test('retorna 0 para entradas no numéricas', () => {
    expect(safeParseInt('abc')).toBe(0);
  });
  test('retorna 0 para undefined', () => {
    expect(safeParseInt(undefined)).toBe(0);
  });
});
