export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.publicMessage || 'Internal server error' });
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}
