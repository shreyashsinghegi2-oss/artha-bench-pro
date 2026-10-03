import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hypotheticalPcm, paramsFromConstants, predictTemperature, simulateCell } from '../public/research/btms/btms-model.js';

const model = JSON.parse(readFileSync('public/research/btms/model.json', 'utf8'));
const parity = JSON.parse(readFileSync('tests/fixtures/btms-parity.json', 'utf8'));
const pcmName = (code: number) => model.pcm_codes[String(code)] as string;
const coolName = (code: number) => model.cooling_codes[String(code)] as string;

describe('BTMS web model', () => {
  it.each(Object.keys(parity))('%s matches the PyTorch outputs', (net) => {
    const { rows, temp_c: expected } = parity[net];
    rows.forEach((r: { pcm: number; cooling: number; location: number; time: number }, i: number) => {
      const got = predictTemperature(model, net, pcmName(r.pcm), coolName(r.cooling), r.location, r.time);
      expect(Math.abs(got - expected[i])).toBeLessThan(1e-3);
    });
  });

  it('physics: with no cooling the rise is Q t / C', () => {
    const prm = { ...paramsFromConstants(model.constants), g_pipe: { natural: 0, forced: 0 }, g_per_k: 0 };
    const temps = simulateCell(prm, null, 'natural', 1, { durationS: 1200 });
    expect(temps[1200] - 27).toBeCloseTo((2 * 1200) / prm.c_cell, 9);
  });

  it('physics: a PCM keeps the cell cooler than no PCM, and the fan helps', () => {
    const prm = paramsFromConstants(model.constants);
    const om42 = model.pcm_table.om42;
    const none = simulateCell(prm, null, 'natural', 2)[1200];
    const nat = simulateCell(prm, om42, 'natural', 2)[1200];
    const forced = simulateCell(prm, om42, 'forced', 2)[1200];
    expect(nat).toBeLessThan(none);
    expect(forced).toBeLessThan(nat);
  });

  it('physics: on a 40 C day a 34 C-melting PCM is already molten and loses its buffer', () => {
    const prm = paramsFromConstants(model.constants);
    const low = hypotheticalPcm(model.pcm_table.om42, 34, 250);
    const mild = Math.max(...simulateCell(prm, low, 'natural', 2, { tAmb: 27 })) - 27;
    const hot = Math.max(...simulateCell(prm, low, 'natural', 2, { tAmb: 40 })) - 40;
    expect(hot).toBeGreaterThan(mild);
  });

  it('matches the Python design sweep', () => {
    const results = JSON.parse(readFileSync('public/research/btms/results.json', 'utf8'));
    const prm = paramsFromConstants(model.constants);
    const row = results.design_grid.find((g: { duration_s: number; ambient_c: number; melt_centre_c: number }) =>
      g.duration_s === 1200 && g.ambient_c === 27 && g.melt_centre_c === 44);
    const temps = simulateCell(prm, hypotheticalPcm(model.pcm_table.om42, 44, 250), 'natural', 2, { durationS: 1200, tAmb: 27 });
    expect(Math.max(...temps)).toBeCloseTo(row.peak_temp_c, 2);
  });
});
