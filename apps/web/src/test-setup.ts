/**
 * React Router builds a `Request` with an AbortSignal from jsdom, and Node's own `Request` rejects it
 * ("Expected signal to be an instance of AbortSignal"). Tests never abort navigations, so the signal
 * is dropped. Test-only: this file is loaded by vitest (see vite.config.ts) and never by the app.
 */
const NodeRequest = globalThis.Request;

class TestRequest extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const clean: RequestInit | undefined = init ? { ...init } : init;
    if (clean) delete clean.signal;
    super(input, clean);
  }
}

globalThis.Request = TestRequest as typeof Request;
