import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' porque la app se publica dentro de una biblioteca de SharePoint,
// donde la ruta del sitio no coincide con la raiz del dominio.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
})
