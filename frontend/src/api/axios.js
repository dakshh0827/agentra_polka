import axios from 'axios'

const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─────────────────────────────────────────────
// REQUEST INTERCEPTOR (WALLET + AUTH)
// ─────────────────────────────────────────────
api.interceptors.request.use((config) => {
  // Prefer wagmi-connected address stored in localStorage
  const wallet =
    localStorage.getItem('wallet-address') ||
    localStorage.getItem('wagmi.store') // fallback

  if (wallet && wallet.startsWith('0x')) {
    config.headers['x-wallet-address'] = wallet
  }

  return config
})

// ─────────────────────────────────────────────
// RESPONSE INTERCEPTOR (ERROR HANDLING)
// ─────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message

    console.error('API Error:', message)

    return Promise.reject(error)
  }
)

export default api