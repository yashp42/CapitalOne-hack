export async function getProfile(req, res) {
  res.json({ id: req.params.id, profile: { /* TODO */ } });
}
export async function putProfile(req, res) {
  res.json({ id: req.params.id, saved: true, profile: req.body || {} });
}
