const chain: any = new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : chain), apply: () => chain });
export const z = chain; export default chain;
