import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter: funciona em qualquer hospedagem estática, sem regras de redirecionamento.
export default defineConfig({
  plugins: [react()],
  base: './',
})
