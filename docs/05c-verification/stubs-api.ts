export const api = { me: async () => (window as any).__MOCK.me, summary: async () => { const s = (window as any).__MOCK.summary; if (s === 'error') throw new Error('down'); return s; } };
