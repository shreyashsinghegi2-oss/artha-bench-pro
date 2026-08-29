export default function probe(_req: unknown, res: any) {
  res.status(200).json({ ok: true, layer: 'bare-function', runtime: process.version });
}
