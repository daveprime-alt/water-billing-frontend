import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const useAuthStore = create(persist((set) => ({
  token: null,
  user: null,
  mustChangePassword: false,
  login: (response) => set({
    token: response.token,
    user: response.user,
    mustChangePassword: Boolean(response.mustChangePassword),
  }),
  clearSession: () => set({ token: null, user: null, mustChangePassword: false }),
}), {
  name: 'clearwater-session',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ token: state.token, user: state.user, mustChangePassword: state.mustChangePassword }),
}))
