export class PublishingError extends Error {
  constructor(status) {
    super(status === 403 ? 'The publishing plan or account permissions do not allow this action. Check your Upload-Post plan and reconnect the account.' : 'The publishing provider could not complete this request. Refresh status before trying again.');
    this.status = status;
  }
}

export async function uploadPostRequest(apiKey, path, body, {fetcher = fetch, idempotencyKey} = {}) {
  if (!apiKey) throw Error('Social publishing is not configured yet.');
  if (!path.startsWith('/api/') || path.includes('://')) throw Error('Invalid publishing API path.');
  const multipart = body instanceof FormData;
  const response = await fetcher('https://api.upload-post.com' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {Authorization: 'Apikey ' + apiKey, ...(body !== undefined && !multipart ? {'Content-Type': 'application/json'} : {}), ...(idempotencyKey ? {'Idempotency-Key': idempotencyKey} : {})},
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(45000), redirect: 'manual',
  });
  if (!response.ok) throw new PublishingError(response.status);
  const data = await response.json();
  if (data.success === false) throw new PublishingError(400);
  return data;
}
