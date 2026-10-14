export async function requestCharacter(generate, params, timeout = 10000) {
  const models = ['gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  for (let index = 0; index < models.length; index++) {
    const controller = new AbortController();
    let timer;
    try {
      return await Promise.race([
        generate({ ...params, model: models[index], config: { ...params.config, abortSignal: controller.signal, httpOptions: { timeout } } }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(Object.assign(new Error('Chat timeout'), { status: 504 }));
          }, timeout);
        }),
      ]);
    } catch (error) {
      if (index === models.length - 1 || ![500, 502, 503, 504].includes(Number(error.status))) throw error;
    } finally { clearTimeout(timer); }
  }
}
