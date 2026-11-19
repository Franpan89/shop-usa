/** Paginación de listas largas. Ejecutar con: npm test */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_SIZE, pageInfo, pageWindow } from './pagination';

describe('paginación', () => {
  it('10 filas por página', () => {
    assert.equal(PAGE_SIZE, 10);
    const p1 = pageInfo(47, undefined);
    assert.deepEqual([p1.page, p1.pageCount, p1.start, p1.end], [1, 5, 0, 10]);
    const p5 = pageInfo(47, '5');
    assert.deepEqual([p5.page, p5.start, p5.end], [5, 40, 47]);
  });

  it('una página fuera de rango o inválida se ajusta', () => {
    assert.equal(pageInfo(47, '99').page, 5);
    assert.equal(pageInfo(47, '0').page, 1);
    assert.equal(pageInfo(47, '-3').page, 1);
    assert.equal(pageInfo(47, 'abc').page, 1);
    assert.equal(pageInfo(47, '2.9').page, 2);
  });

  it('sin filas hay una sola página vacía; con exactamente 10 también', () => {
    const empty = pageInfo(0, '3');
    assert.deepEqual([empty.page, empty.pageCount, empty.start, empty.end], [1, 1, 0, 0]);
    assert.equal(pageInfo(10, 1).pageCount, 1);
    assert.equal(pageInfo(11, 1).pageCount, 2);
  });

  it('el paginador muestra la primera, la última y las vecinas', () => {
    assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
    assert.deepEqual(pageWindow(1, 10), [1, 2, '…', 10]);
    assert.deepEqual(pageWindow(5, 10), [1, '…', 4, 5, 6, '…', 10]);
    assert.deepEqual(pageWindow(10, 10), [1, '…', 9, 10]);
    assert.deepEqual(pageWindow(1, 1), [1]);
  });
});
