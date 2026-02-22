import { useAuthStore } from '../store/useAuthStore';

/**
 * Hook de autenticación. Ahora envuelve el store de Zustand.
 */
export const useAuth = useAuthStore;
