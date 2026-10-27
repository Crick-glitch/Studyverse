export const useAuth = () => ({ signOut: async () => { (window as any).__signedOut = true; } });
