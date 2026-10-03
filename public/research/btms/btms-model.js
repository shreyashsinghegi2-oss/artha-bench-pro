// Browser version of the btms-ml models: the trained networks (forward pass only) and the lumped energy balance.
// Pure functions, no DOM, so the page and the tests share one implementation.

/** Configuration features in the order the networks were trained on (btms/pinn.py FEATS). */
export function configFeatures(model, pcm, cooling, cell) {
  const p = pcm === 'none' ? null : model.pcm_table[pcm];
  const core = cell === 2 || cell === 5 ? 1 : 0;
  return [
    cooling === 'forced' ? 1 : 0,
    core,
    p ? 1 : 0,
    p ? p.onset_c : 0,
    p ? p.first_deviation_c : 0,
    p ? p.latent_j_per_g : 0,
    p ? p.k_solid : 0,
    p ? p.cp_solid : 0,
  ];
}

/** Forward pass of a tanh MLP: input [t/duration, features/scale] -> temperature in deg C. */
export function predictTemperature(model, netName, pcm, cooling, cell, timeS) {
  const net = model.models[netName];
  const feats = configFeatures(model, pcm, cooling, cell).map((v, i) => v / model.feat_scale[i]);
  let a = [timeS / model.duration_s, ...feats];
  net.layers.forEach((layer, li) => {
    const out = layer.b.map((b, j) => {
      let s = b;
      const row = layer.W[j];
      for (let k = 0; k < a.length; k += 1) s += row[k] * a[k];
      return s;
    });
    a = li < net.layers.length - 1 ? out.map(Math.tanh) : out;
  });
  return model.t_amb + model.t_scale * a[0];
}

export function predictCurve(model, netName, pcm, cooling, cell, stepS = 10) {
  const out = [];
  for (let t = 0; t <= model.duration_s; t += stepS) out.push({ t, temp: predictTemperature(model, netName, pcm, cooling, cell, t) });
  return out;
}

/** Physics constants from the PINN's learned constants (same names as btms/physics.py LumpedParams). */
export function paramsFromConstants(c) {
  return {
    c_cell: c.c_cell_J_per_K,
    m_pcm_outer: c.m_pcm_kg,
    core_pcm_fraction: c.core_pcm_fraction,
    core_extra_heat_w: c.core_extra_heat_W,
    g_pipe: { natural: c.G_natural_W_per_K, forced: c.G_forced_W_per_K },
    g_per_k: c.G_per_k,
    melt_width_c: c.melt_width_C,
  };
}

/**
 * Lumped energy balance, explicit Euler with 1 s steps (port of btms/physics.py simulate_cell):
 *   C_eff(T) dT/dt = Q - G (T - T_amb)
 * pcm: null for no PCM, or {first_deviation_c, onset_c, latent_j_per_g, cp_solid, k_solid}.
 */
export function simulateCell(prm, pcm, cooling, cell, { durationS = 1200, tAmb = 27, qCell = 2 } = {}) {
  const core = cell === 2 || cell === 5;
  const q = qCell + (core ? prm.core_extra_heat_w : 0);
  const g = prm.g_pipe[cooling] + prm.g_per_k * (pcm ? pcm.k_solid : 0);
  const m = prm.m_pcm_outer * (core ? prm.core_pcm_fraction : 1);
  const w = prm.melt_width_c;
  const centre = pcm ? 0.5 * (pcm.first_deviation_c + pcm.onset_c) : 0;
  const temps = new Float64Array(durationS + 1);
  temps[0] = tAmb;
  for (let i = 0; i < durationS; i += 1) {
    const T = temps[i];
    let c = prm.c_cell;
    if (pcm) {
      const melt = Math.exp(-0.5 * ((T - centre) / w) ** 2) / (w * Math.sqrt(2 * Math.PI));
      c += m * (1000 * pcm.cp_solid + 1000 * pcm.latent_j_per_g * melt);
    }
    temps[i + 1] = T + (q - g * (T - tAmb)) / c;
  }
  return temps;
}

/** A material like `base` but melting around `centreC` with the given latent heat (btms/design.py). */
export function hypotheticalPcm(base, centreC, latent, spreadC = 1.6) {
  return { ...base, first_deviation_c: centreC - spreadC / 2, onset_c: centreC + spreadC / 2, latent_j_per_g: latent };
}

export function r2(y, p) {
  const mean = y.reduce((a, b) => a + b, 0) / y.length;
  let ssRes = 0;
  let ssTot = 0;
  y.forEach((v, i) => {
    ssRes += (v - p[i]) ** 2;
    ssTot += (v - mean) ** 2;
  });
  return 1 - ssRes / ssTot;
}
