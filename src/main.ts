import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import faviconUrl from './assets/favicon.png'

const ensureFavicon = () => {
  const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (existing) {
    existing.type = 'image/png'
    existing.href = faviconUrl
    return
  }
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/png'
  link.href = faviconUrl
  document.head.appendChild(link)
}

ensureFavicon()

createApp(App).mount('#app')
