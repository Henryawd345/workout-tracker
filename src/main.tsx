import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { initDb } from './data/index.ts'
import { registerPwa } from './registerPwa.ts'
import { router } from './router.tsx'
import './styles/global.css'

void initDb()
registerPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
