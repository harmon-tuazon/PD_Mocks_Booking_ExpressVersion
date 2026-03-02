import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')

  // Log environment variable status during build
  console.log('🔍 Vite Build Environment Check:')
  console.log('  VITE_SUPABASE_URL:', env.VITE_SUPABASE_URL ? '✓ SET' : '✗ MISSING')
  console.log('  VITE_SUPABASE_ANON_KEY:', env.VITE_SUPABASE_ANON_KEY ? '✓ SET' : '✗ MISSING')

  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.warn('⚠️  WARNING: Missing required Supabase environment variables!')
    console.warn('   The admin app will show a blank page without these variables.')
    console.warn('   Please set them in Vercel Dashboard → Settings → Environment Variables')
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    },
  }
})
