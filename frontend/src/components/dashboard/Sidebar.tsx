import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { BarChart2, CloudSun, Database, Droplets, LayoutDashboard, Leaf, RefreshCw, Settings } from 'lucide-react'
import type { ConnectionState } from '../../context/TerraFlowContext'

const navItems = [
  { to: '/', icon: <LayoutDashboard size={16} />, label: 'Panel' },
  { to: '/zones', icon: <Droplets size={16} />, label: 'Zonas' },
  { to: '/weather', icon: <CloudSun size={16} />, label: 'Clima' },
  { to: '/reports', icon: <BarChart2 size={16} />, label: 'Reportes' },
  { to: '/database', icon: <Database size={16} />, label: 'Base de Datos' },
  { to: '/settings', icon: <Settings size={16} />, label: 'Configuración' },
]

export const Sidebar: React.FC<{ connection: ConnectionState; onRefresh: () => void }> = ({ connection, onRefresh }) => {
  const { pathname } = useLocation()
  const showConnection = pathname === '/' || connection !== 'loading'
  return (
  <header className="tf-navbar">
    <a className="tf-brand" href="/" aria-label="TerraFlow, ir al panel principal">
      <span className="tf-brand__mark"><Leaf size={19} /></span>
      <span><span className="tf-brand__word">TerraFlow</span><span className="tf-brand__descriptor">RIEGO INTELIGENTE</span></span>
    </a>
    <nav className="tf-nav-links" aria-label="Navegación principal">
      {navItems.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `tf-nav-link${isActive ? ' is-active' : ''}`}>
        {item.icon}<span>{item.label}</span>
      </NavLink>)}
    </nav>
    <div className="tf-nav-actions">
      {showConnection && <div className={`tf-nav-connection ${connection === 'offline' ? 'is-offline' : connection === 'loading' ? 'is-loading' : ''}`} role="status" aria-live="polite">
        <span className="tf-nav-connection__dot" />
        <span>{connection === 'offline' ? 'Sin conexión' : connection === 'loading' ? 'Conectando' : 'En línea'}</span>
      </div>}
      <button className="tf-nav-refresh" type="button" onClick={onRefresh} aria-label="Actualizar datos del tablero" title="Actualizar datos">
        <RefreshCw size={15} /><span>Actualizar</span>
      </button>
    </div>
  </header>
  )
}
