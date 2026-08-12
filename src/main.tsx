import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/newsreader'
import '@fontsource-variable/dm-sans'
import './styles.css'

const app = window.location.pathname === '/preview/globe'
  ? import('./preview/GlobePreview')
  : import('./preview/ImmersivePreview')

app.then(({ default: Root }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
})
