export type SigningErrorState = {
  detailsJson: string;
  summaryLine: string;
  name: string;
  message: string;
};

export const buildSigningErrorState = (error: unknown): SigningErrorState => {
  if (error === null || typeof error !== 'object') {
    const asString = typeof error === 'string' ? error : '';

    return {
      detailsJson: JSON.stringify({ value: error }, null, 2),
      summaryLine: asString,
      name: '',
      message: asString,
    };
  }

  const name = Reflect.get(error, 'name');
  const message = Reflect.get(error, 'message');
  const payload = Reflect.get(error, 'payload');
  const stack = Reflect.get(error, 'stack');

  const detailsJson = JSON.stringify(
    {
      name,
      message,
      payload,
      stack: typeof stack === 'string' ? stack : undefined,
    },
    null,
    2,
  );

  let summaryLine = '';
  if (name === 'SigningErr::Unknown' && payload !== null && typeof payload === 'object') {
    const reason = Reflect.get(payload, 'reason');
    if (typeof reason === 'string') {
      summaryLine = reason;
    }
  }
  if (!summaryLine && typeof message === 'string') {
    summaryLine = message;
  }

  const nameStr = typeof name === 'string' ? name : '';
  const messageStr = typeof message === 'string' ? message : '';

  return { detailsJson, summaryLine, name: nameStr, message: messageStr };
};
