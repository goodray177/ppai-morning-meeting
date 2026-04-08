import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 這裡的名稱必須跟你的 GitHub Repository 名字完全一致
  // 注意：前後都要有斜線 /
  base: '/ppai-morning-meeting/', 
})