import { createContext, useState, useContext } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Xóa sạch localStorage cũ để không lưu phiên làm việc vĩnh viễn
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch {
      // ignore
    }

    try {
      const savedUser = sessionStorage.getItem('user');
      const token = sessionStorage.getItem('token');
      if (savedUser && token && savedUser !== 'undefined') {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.error('Lỗi phân giải dữ liệu người dùng từ sessionStorage:', e);
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
    }
    return null;
  });

  const [loading] = useState(false);

  const login = (userData, token) => {
    sessionStorage.setItem('user', JSON.stringify(userData));
    sessionStorage.setItem('token', token);
    setUser(userData);
  };

  const updateUser = (updatedUserData) => {
    const merged = { ...user, ...updatedUserData };
    sessionStorage.setItem('user', JSON.stringify(merged));
    setUser(merged);
  };

  const logout = () => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, updateUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  return useContext(AuthContext);
};
