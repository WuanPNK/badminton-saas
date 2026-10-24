import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động gắn JWT Token vào mọi request gửi lên Backend
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tự động bắt lỗi 401 (Hết hạn phiên đăng nhập)
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Chỉ redirect nếu không phải đang ở trang login để tránh lặp vô tận
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/auth')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;