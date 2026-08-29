// This tracked entry is overwritten by `npm run build` with the bundled
// production Express API before Vercel packages the function.
export default function prebuildPlaceholder(_req, res) {
  res.status(503).json({ error: 'API bundle has not been generated yet.' });
}
