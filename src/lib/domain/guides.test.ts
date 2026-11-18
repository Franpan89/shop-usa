/** Reglas de las guías y del código de barras. Ejecutar con: npm test */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CODE128_PATTERNS, code128Bars, code128Values } from './code128';
import {
  IFL_GUIDE_START,
  countryTag,
  destinationLine,
  guideCode,
  normalizeGuideFields,
  shipperIsIncomplete,
  upper,
} from './guides';

describe('numeración de guías', () => {
  it('la serie IFL arranca en IFLWH00100 y rellena a 5 dígitos', () => {
    assert.equal(guideCode('IFL', IFL_GUIDE_START), 'IFLWH00100');
    assert.equal(guideCode('IFL', 431), 'IFLWH00431');
    assert.equal(guideCode('IFL', 12345), 'IFLWH12345');
  });

  it('la guía de un PKG lleva el mismo número que la caja', () => {
    assert.equal(guideCode('PKG', 500), 'PKG500');
    assert.equal(guideCode('PKG', 1203), 'PKG1203');
  });
});

describe('validación de una guía', () => {
  const base = { contents: ' zapatos  prendas de vestir ', itemCount: '1', weightLb: '8.254', declaredValue: '200' };

  it('normaliza a mayúsculas y redondea a 2 decimales', () => {
    const r = normalizeGuideFields(base);
    assert.ok(r.ok);
    assert.equal(r.value.contents, 'ZAPATOS PRENDAS DE VESTIR');
    assert.equal(r.value.weightLb, 8.25);
    assert.equal(r.value.declaredValue, 200);
    assert.equal(r.value.finalDeliveryAddress, null);
  });

  it('acepta coma decimal', () => {
    const r = normalizeGuideFields({ ...base, weightLb: '8,5' });
    assert.ok(r.ok);
    assert.equal(r.value.weightLb, 8.5);
  });

  it('rechaza lo que no se puede declarar', () => {
    assert.equal(normalizeGuideFields({ ...base, contents: '  ' }).ok, false);
    assert.equal(normalizeGuideFields({ ...base, itemCount: 0 }).ok, false);
    assert.equal(normalizeGuideFields({ ...base, itemCount: 1.5 }).ok, false);
    assert.equal(normalizeGuideFields({ ...base, weightLb: 0 }).ok, false);
    assert.equal(normalizeGuideFields({ ...base, weightLb: '' }).ok, false);
    assert.equal(normalizeGuideFields({ ...base, declaredValue: -3 }).ok, false);
  });

  it('la entrega en otra dirección exige la dirección; sin marcar se ignora', () => {
    assert.equal(normalizeGuideFields({ ...base, deliverElsewhere: true, finalDeliveryAddress: '  ' }).ok, false);
    const withAddr = normalizeGuideFields({ ...base, deliverElsewhere: true, finalDeliveryAddress: 'av. loja y solano' });
    assert.ok(withAddr.ok);
    assert.equal(withAddr.value.finalDeliveryAddress, 'AV. LOJA Y SOLANO');
    const unchecked = normalizeGuideFields({ ...base, deliverElsewhere: false, finalDeliveryAddress: 'otra' });
    assert.ok(unchecked.ok);
    assert.equal(unchecked.value.finalDeliveryAddress, null);
  });
});

describe('remitentes y destinos', () => {
  it('un remitente al que le falta un dato clave está incompleto', () => {
    const full = { idNumber: '0107300030', address: '1 MAIN ST', city: 'ORLANDO', phone: '8639348718' };
    assert.equal(shipperIsIncomplete(full), false);
    assert.equal(shipperIsIncomplete({ ...full, phone: null }), true);
    assert.equal(shipperIsIncomplete({ ...full, idNumber: '  ' }), true);
  });

  it('arma el destino sin partes vacías', () => {
    assert.equal(destinationLine({ city: 'Cuenca', province: 'Azuay', country: 'Ecuador' }), 'CUENCA, AZUAY, ECUADOR');
    assert.equal(destinationLine({ city: '', province: null, country: 'Panamá' }), 'PANAMÁ');
    assert.equal(countryTag('Ecuador'), 'EC');
    assert.equal(countryTag('Panamá'), 'PTY');
    assert.equal(upper('  ándrade   cordero '), 'ÁNDRADE CORDERO');
  });
});

describe('código de barras Code 128', () => {
  it('la tabla tiene 107 símbolos válidos y distintos', () => {
    assert.equal(CODE128_PATTERNS.length, 107);
    assert.equal(new Set(CODE128_PATTERNS).size, 107);
    CODE128_PATTERNS.forEach((p, value) => {
      const widths = [...p].map(Number);
      const isStop = value === 106;
      assert.equal(widths.length, isStop ? 7 : 6, `largo del símbolo ${value}`);
      assert.equal(widths.reduce((a, b) => a + b, 0), isStop ? 13 : 11, `módulos del símbolo ${value}`);
      // Todos los símbolos de Code 128 tienen un número par de módulos en barras negras.
      const barModules = widths.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
      assert.equal(barModules % 2, 0, `paridad del símbolo ${value}`);
    });
  });

  it('calcula el dígito de control: inicio B + Σ valor × posición, módulo 103', () => {
    // "PJJ123C": el ejemplo clásico del estándar (aquí en juego B).
    const values = code128Values('PJJ123C');
    assert.deepEqual(values.slice(0, 8), [104, 48, 42, 42, 17, 18, 19, 35]);
    assert.equal(values[8], (104 + 48 * 1 + 42 * 2 + 42 * 3 + 17 * 4 + 18 * 5 + 19 * 6 + 35 * 7) % 103);
    assert.equal(values.at(-1), 106);
  });

  it('el ancho total es 11 módulos por símbolo + la parada', () => {
    for (const text of ['IFLWH00100', 'PKG500', 'A']) {
      const { modules } = code128Bars(text);
      assert.equal(modules, 11 * (text.length + 2) + 13, text);
    }
  });

  it('se puede leer de vuelta: decodifica las barras y recupera el texto', () => {
    const text = 'IFLWH00431';
    const { bars, modules } = code128Bars(text);
    // Reconstruye la cadena de módulos (1 = barra) y la parte en símbolos.
    const bits = Array<string>(modules).fill('0');
    for (const b of bars) for (let i = 0; i < b.w; i++) bits[b.x + i] = '1';
    const runs: number[] = [];
    let current = bits[0];
    let len = 0;
    for (const bit of bits) {
      if (bit === current) len++;
      else {
        runs.push(len);
        current = bit;
        len = 1;
      }
    }
    runs.push(len);
    const symbols: number[] = [];
    let at = 0;
    while (at < runs.length) {
      const stop = runs.length - at === 7;
      const chunk = runs.slice(at, at + (stop ? 7 : 6)).join('');
      const value = CODE128_PATTERNS.indexOf(chunk);
      assert.notEqual(value, -1, `patrón desconocido ${chunk}`);
      symbols.push(value);
      at += stop ? 7 : 6;
    }
    assert.deepEqual(symbols, code128Values(text));
    const data = symbols.slice(1, -2);
    assert.equal(String.fromCharCode(...data.map((v) => v + 32)), text);
  });

  it('rechaza caracteres fuera de ASCII imprimible', () => {
    assert.throws(() => code128Values('Ñandú'));
    assert.throws(() => code128Values(''));
  });
});
