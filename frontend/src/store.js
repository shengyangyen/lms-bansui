import { create } from 'zustand';
import { decodeJwtPayload } from './utils/jwtPayload';

function getInitialAuth() {
  const token = localStorage.getItem('token');
  let user = null;
  try {
    const raw = localStorage.getItem('user');
    if (raw) user = JSON.parse(raw);
  } catch {
    user = null;
  }
  if (!user && token) {
    const p = decodeJwtPayload(token);
    if (p?.userId) {
      user = {
        id: p.userId,
        email: p.email || '',
        user_role: p.role,
        display_name: p.display_name,
        real_name: p.real_name
      };
    }
  }
  return { token, user };
}

const initial = getInitialAuth();

export const useStore = create((set) => ({
  user: initial.user,
  token: initial.token,
  setUser: (user) => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
    set({ user });
  },
  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  }
}));
