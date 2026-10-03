import { hypotheticalPcm, paramsFromConstants, predictCurve, r2, simulateCell } from './btms-model.js';

const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const PCM_LABEL = { om42: 'OM42', om48: 'OM48', paraffin: 'Paraffin', none: 'No PCM' };
const fmt1 = (v) => `${v.toFixed(1)} °C`;
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (parent) parent.appendChild(e);
  return e;
}

function niceTicks(lo, hi, n = 5) {
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) || step0;
  const out = [];
  for (let v = Math.floor(lo / step) * step; v < hi + step - 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/**
 * Line chart: one y-axis, thin 2px lines, legend + direct end labels, crosshair tooltip, table view.
 * series: [{ name, colorVar, dash?, points: [{x, y}] }]
 */
function lineChart(container, { series, xLabel, yLabel, xFmt = (v) => v, yFmt = fmt1, marker = null, title }) {
  container.innerHTML = '';
  const W = Math.max(300, Math.round(container.clientWidth || 640));
  const narrow = W < 520;
  const H = narrow ? 260 : 316, pad = { l: 40, r: narrow ? 64 : 96, t: 30, b: 38 };
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const xLo = Math.min(...xs), xHi = Math.max(...xs);
  const yT = niceTicks(Math.min(...ys), Math.max(...ys));
  const yLo = yT[0], yHi = yT[yT.length - 1];
  const X = (v) => pad.l + ((v - xLo) / (xHi - xLo || 1)) * (W - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - yLo) / (yHi - yLo || 1)) * (H - pad.t - pad.b);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title }, container);
  yT.forEach((t) => {
    el('line', { x1: pad.l, x2: W - pad.r, y1: Y(t), y2: Y(t), stroke: css('--grid'), 'stroke-width': 1 }, svg);
    const tx = el('text', { x: pad.l - 6, y: Y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: css('--text-secondary') }, svg);
    tx.textContent = t;
  });
  niceTicks(xLo, xHi, narrow ? 4 : 6).filter((t) => t >= xLo && t <= xHi).forEach((t) => {
    const tx = el('text', { x: X(t), y: H - pad.b + 16, 'text-anchor': 'middle', 'font-size': 11, fill: css('--text-secondary') }, svg);
    tx.textContent = xFmt(t);
  });
  const xl = el('text', { x: (pad.l + W - pad.r) / 2, y: H - 4, 'text-anchor': 'middle', 'font-size': 11, fill: css('--text-secondary') }, svg);
  xl.textContent = xLabel;
  const yl = el('text', { x: 4, y: 12, 'font-size': 11, fill: css('--text-secondary') }, svg);
  yl.textContent = yLabel;
  if (marker !== null) el('line', { x1: X(marker), x2: X(marker), y1: pad.t, y2: H - pad.b, stroke: css('--text-muted'), 'stroke-dasharray': '3 3', 'stroke-width': 1 }, svg);
  // end labels, nudged apart
  const ends = series.map((s) => ({ s, y: Y(s.points[s.points.length - 1].y) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  series.forEach((s) => {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    el('path', { d, fill: 'none', stroke: css(s.colorVar), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-dasharray': s.dash || '' }, svg);
  });
  ends.forEach(({ s, y }) => {
    const last = s.points[s.points.length - 1];
    const t = el('text', { x: W - pad.r + 6, y: y + 4, 'font-size': 11, fill: css('--text-primary') }, svg);
    t.textContent = yFmt(last.y);
  });
  // hover layer
  const cross = el('line', { y1: pad.t, y2: H - pad.b, stroke: css('--text-muted'), 'stroke-width': 1, visibility: 'hidden' }, svg);
  const dots = series.map((s) => el('circle', { r: 4, fill: css(s.colorVar), stroke: css('--surface-1'), 'stroke-width': 2, visibility: 'hidden' }, svg));
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  container.appendChild(tip);
  const hit = el('rect', { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, fill: 'transparent' }, svg);
  const base = series[0].points;
  const show = (evt) => {
    const r = svg.getBoundingClientRect();
    const px = ((evt.clientX - r.left) / r.width) * W;
    const xv = xLo + ((px - pad.l) / (W - pad.l - pad.r)) * (xHi - xLo);
    const idx = base.reduce((best, p, i) => (Math.abs(p.x - xv) < Math.abs(base[best].x - xv) ? i : best), 0);
    const xx = X(base[idx].x);
    cross.setAttribute('x1', xx); cross.setAttribute('x2', xx); cross.setAttribute('visibility', 'visible');
    const lines = [`<b>${xFmt(base[idx].x)}</b>`];
    series.forEach((s, k) => {
      const p = s.points[Math.min(idx, s.points.length - 1)];
      dots[k].setAttribute('cx', X(p.x)); dots[k].setAttribute('cy', Y(p.y)); dots[k].setAttribute('visibility', 'visible');
      lines.push(`${s.name}: <b>${yFmt(p.y)}</b>`);
    });
    tip.innerHTML = lines.join('<br>');
    tip.hidden = false;
    const left = (xx / W) * r.width;
    tip.style.left = `${Math.min(r.width - 170, Math.max(0, left + 12))}px`;
    tip.style.top = '8px';
  };
  hit.addEventListener('pointermove', show);
  hit.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); dots.forEach((d) => d.setAttribute('visibility', 'hidden')); });
  // legend + table toggle
  const legend = document.createElement('div');
  legend.className = 'legend';
  legend.innerHTML = series.map((s) => `<span><i style="border-top-color:${css(s.colorVar)};${s.dash ? 'border-top-style:dashed' : ''}"></i>${s.name}</span>`).join('');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Show table';
  legend.appendChild(btn);
  container.appendChild(legend);
  const table = document.createElement('div');
  table.className = 'scroll';
  table.hidden = true;
  const step = Math.max(1, Math.round(base.length / 25));
  table.innerHTML = `<table><caption class="sr-only">${title}</caption><thead><tr><th>${xLabel}</th>${series.map((s) => `<th class="num">${s.name}</th>`).join('')}</tr></thead><tbody>${
    base.filter((_, i) => i % step === 0 || i === base.length - 1).map((p) => {
      const i = base.indexOf(p);
      return `<tr><td>${xFmt(p.x)}</td>${series.map((s) => `<td class="num">${yFmt(s.points[Math.min(i, s.points.length - 1)].y)}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table>`;
  container.appendChild(table);
  btn.addEventListener('click', () => {
    table.hidden = !table.hidden;
    svg.style.display = table.hidden ? '' : 'none';
    btn.textContent = table.hidden ? 'Show table' : 'Show chart';
  });
}

function tiles(container, items) {
  container.innerHTML = items.map(([k, v, n]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div>${n ? `<div class="n">${n}</div>` : ''}</div>`).join('');
}

function table(container, cols, rows) {
  container.innerHTML = `<table><thead><tr>${cols.map(([, h, num]) => `<th class="${num ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${cols.map(([k, , num, f]) => `<td class="${num ? 'num' : ''}">${f ? f(r[k]) : r[k]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

async function main() {
  const [model, results] = await Promise.all([fetch('/research/btms/model.json').then((r) => r.json()), fetch('/research/btms/results.json').then((r) => r.json())]);
  const simulated = /SIMULATED/.test(model.data_note);
  $('data-note').innerHTML = simulated
    ? '<b>Demonstration data.</b> These models are trained on simulated data from a lumped energy-balance model, because the full experimental dataset is not yet public. They demonstrate the method; they are not experimental findings.'
    : `<b>Data:</b> ${model.data_note}`;
  const calibrated = paramsFromConstants(model.constants);
  const truth = model.sim_true_params || null;
  const curveFromTemps = (temps, step = 10) => Array.from({ length: Math.floor((temps.length - 1) / step) + 1 }, (_, i) => ({ x: i * step, y: temps[i * step] }));
  const pcmProps = (name) => (name === 'none' ? null : model.pcm_table[name]);
  const tFmt = (s) => `${Math.round(s)} s`;

  // 1 · predict
  const renderPredict = () => {
    const pcm = $('p-pcm').value, cool = $('p-cool').value, cell = Number($('p-cell').value);
    const nn = predictCurve(model, 'pinn_all', pcm, cool, cell).map((p) => ({ x: p.t, y: p.temp }));
    const phys = curveFromTemps(simulateCell(calibrated, pcmProps(pcm), cool, cell));
    tiles($('p-tiles'), [
      ['PINN at 1200 s', fmt1(nn[nn.length - 1].y), 'end of the 3C-equivalent test'],
      ['Physics model at 1200 s', fmt1(phys[phys.length - 1].y), 'calibrated energy balance'],
      ['Difference', `${Math.abs(nn[nn.length - 1].y - phys[phys.length - 1].y).toFixed(2)} °C`, 'agreement of the two'],
    ]);
    lineChart($('p-chart'), {
      title: `Temperature of cell C${cell}, ${PCM_LABEL[pcm]}, ${cool} cooling`, xLabel: 'Time (s)', yLabel: 'Cell temperature (°C)', xFmt: tFmt,
      series: [{ name: 'PINN prediction', colorVar: '--series-1', points: nn }, { name: 'Calibrated physics', colorVar: '--series-2', dash: '5 4', points: phys }],
    });
  };
  ['p-pcm', 'p-cool', 'p-cell'].forEach((id) => $(id).addEventListener('change', renderPredict));
  renderPredict();

  // 2 · unseen OM42
  const renderUnseen = () => {
    const cool = $('u-cool').value, cell = Number($('u-cell').value);
    const pinn = predictCurve(model, 'pinn_unseen_om42', 'om42', cool, cell).map((p) => ({ x: p.t, y: p.temp }));
    const nn = predictCurve(model, 'nn_unseen_om42', 'om42', cool, cell).map((p) => ({ x: p.t, y: p.temp }));
    const series = [{ name: 'PINN (never saw OM42)', colorVar: '--series-1', points: pinn }, { name: 'Plain network (never saw OM42)', colorVar: '--series-2', points: nn }];
    if (truth) {
      const actual = curveFromTemps(simulateCell(truth, model.pcm_table.om42, cool, cell));
      series.unshift({ name: 'Actual (simulated)', colorVar: '--series-3', points: actual });
      const yA = actual.map((p) => p.y);
      tiles($('u-tiles'), [
        ['PINN, this curve', `R² ${r2(yA, pinn.map((p) => p.y)).toFixed(3)}`, `all OM42 data: R² ${model.held_out_om42.pinn_unseen_om42.r2}, error ${model.held_out_om42.pinn_unseen_om42.rmse_c} °C`],
        ['Plain network, this curve', `R² ${r2(yA, nn.map((p) => p.y)).toFixed(3)}`, `all OM42 data: R² ${model.held_out_om42.nn_unseen_om42.r2}, error ${model.held_out_om42.nn_unseen_om42.rmse_c} °C`],
      ]);
    } else {
      tiles($('u-tiles'), [
        ['PINN on all OM42 data', `R² ${model.held_out_om42.pinn_unseen_om42.r2}`, `RMSE ${model.held_out_om42.pinn_unseen_om42.rmse_c} °C`],
        ['Plain network on all OM42 data', `R² ${model.held_out_om42.nn_unseen_om42.r2}`, `RMSE ${model.held_out_om42.nn_unseen_om42.rmse_c} °C`],
      ]);
    }
    lineChart($('u-chart'), { title: `OM42, cell C${cell}, ${cool} cooling: models trained without OM42`, xLabel: 'Time (s)', yLabel: 'Cell temperature (°C)', xFmt: tFmt, series });
  };
  ['u-cool', 'u-cell'].forEach((id) => $(id).addEventListener('change', renderUnseen));
  renderUnseen();

  // 3 · design explorer
  const renderDesign = () => {
    const melt = Number($('d-melt').value), lat = Number($('d-lat').value), amb = Number($('d-amb').value);
    const dur = Number($('d-dur').value), cool = $('d-cool').value;
    $('d-melt-o').textContent = `${melt} °C`;
    $('d-lat-o').textContent = `${lat} J/g`;
    const opts = { durationS: dur, tAmb: amb };
    const mine = simulateCell(calibrated, hypotheticalPcm(model.pcm_table.om42, melt, lat), cool, 2, opts);
    const om42 = simulateCell(calibrated, model.pcm_table.om42, cool, 2, opts);
    const step = dur > 1200 ? 30 : 10;
    const sweep = [];
    for (let m = 30; m <= 66; m += 2) sweep.push({ x: m, y: Math.max(...simulateCell(calibrated, hypotheticalPcm(model.pcm_table.om42, m, lat), cool, 2, opts)) });
    const best = sweep.reduce((a, b) => (b.y < a.y ? b : a));
    tiles($('d-tiles'), [
      ['Your PCM: peak', fmt1(Math.max(...mine)), `melting ${melt} °C, ${lat} J/g`],
      ['OM42: peak', fmt1(Math.max(...om42)), 'same conditions'],
      ['Best melting point here', `${best.x} °C`, `peak ${fmt1(best.y)} at ${lat} J/g`],
    ]);
    lineChart($('d-curve'), {
      title: 'Core-cell temperature over the ride', xLabel: 'Time (s)', yLabel: '°C', xFmt: tFmt,
      series: [{ name: `Your PCM (${melt} °C)`, colorVar: '--series-1', points: curveFromTemps(mine, step) }, { name: 'OM42', colorVar: '--series-2', points: curveFromTemps(om42, step) }],
    });
    lineChart($('d-sweep'), {
      title: 'Peak temperature against PCM melting point', xLabel: 'Melting point (°C)', yLabel: 'Peak °C', xFmt: (v) => `${v} °C`, marker: melt,
      series: [{ name: `Peak temperature, ${amb} °C ambient`, colorVar: '--series-1', points: sweep }],
    });
  };
  ['d-melt', 'd-lat'].forEach((id) => $(id).addEventListener('input', renderDesign));
  ['d-amb', 'd-dur', 'd-cool'].forEach((id) => $(id).addEventListener('change', renderDesign));
  renderDesign();
  let resizeTimer;
  let lastWidth = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { renderPredict(); renderUnseen(); renderDesign(); }, 150);
  });

  // 4 · results
  const f2 = (v) => Number(v).toFixed(2);
  if (results.experiments) {
    table($('r-table'), [['experiment', 'Experiment'], ['features', 'Inputs'], ['model', 'Model'], ['r2', 'R²', true, (v) => Number(v).toFixed(3)], ['rmse_c', 'RMSE °C', true, f2], ['max_abs_c', 'Max error °C', true, f2]], results.experiments);
  }
  if (results.conformal) {
    table($('r-conf'), [['calibration', 'Calibrated on'], ['half_width_C', 'Interval ± °C', true, f2], ['coverage', 'Actual coverage (target 0.90)', true, f2]], results.conformal);
  }
  table($('r-const'), [['k', 'Constant'], ['v', 'Learned value', true]], Object.entries(results.constants).map(([k, v]) => ({ k: k.replaceAll('_', ' '), v: Number(v).toPrecision(4) })));
}

main().catch((err) => {
  $('data-note').textContent = `Could not load the model: ${err.message}`;
});
