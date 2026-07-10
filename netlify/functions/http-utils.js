const jsonResponse = (statusCode, payload, headers = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(payload)
});

const parseJsonBody = (event, { allowEmpty = false } = {}) => {
  if (allowEmpty && !event.body) return { ok: true, data: {} };

  try {
    const data = JSON.parse(event.body || '');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('Request body må være et JSON-objekt');
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      response: jsonResponse(400, { error: 'Ugyldig JSON i request body' })
    };
  }
};

const getHeader = (event, name) => {
  const headers = event?.headers || {};
  const targetName = name.toLowerCase();
  const entry = Object.entries(headers).find(([headerName]) => headerName.toLowerCase() === targetName);
  return entry?.[1];
};

module.exports = {
  getHeader,
  jsonResponse,
  parseJsonBody
};
