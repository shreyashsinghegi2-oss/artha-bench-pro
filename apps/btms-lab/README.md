# BTMS PINN Lab

Static website for the physics-informed ML study of a PCM + pulsating heat pipe battery thermal management system
(extending Mane et al., Journal of Energy Storage 180 (2026) 124313). Deployed as its own Vercel project with this
folder as the root directory; no build step.

- `index.html`, `app.js`: live model (prediction, unseen-PCM test, design explorer, results)
- `btms-model.js`: browser forward pass of the trained networks and the lumped energy balance
- `learn.html`: step-by-step explanation of every algorithm
- `downloads.html`, `data/`, `code/`: dataset, PCM properties, full Python source (btms-ml)
- `selftest.html`: runs the model checks in the browser
- `model.json`, `results.json`: exported by `btms-ml/export_web.py`

Tests: `tests/btmsModel.test.ts` in the repository root.
