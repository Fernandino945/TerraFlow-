import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Droplets, CloudSun, BarChart2, Settings, Leaf, Database } from 'lucide-react'

const navItems = [
  { to: '/', icon: <LayoutDashboard size={18} />, label: 'Panel' },
  { to: '/zones', icon: <Droplets size={18} />, label: 'Zonas' },
  { to: '/weather', icon: <CloudSun size={18} />, label: 'Clima' },
  { to: '/reports', icon: <BarChart2 size={18} />, label: 'Reportes' },
  { to: '/database', icon: <Database size={18} />, label: 'Base de Datos' },
  { to: '/settings', icon: <Settings size={18} />, label: 'Configuración' },
]

export const Sidebar: React.FC = () => {
  return (
    <aside
      className="flex flex-col"
      style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}
          >
            <Leaf size={16} style={{ color: '#4ade80' }} />
          </div>
          <div>
            <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>TerraFlow</div>
            <div className="mono text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              RIEGO INTELIGENTE
            </div>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full status-pulse-green" style={{ background: '#4ade80' }} />
          <span className="mono text-xs" style={{ color: '#4ade80' }}>EN VIVO</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'nav-active' : 'nav-idle'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'rgba(74,222,128,0.12)' : 'transparent',
              color: isActive ? '#4ade80' : 'var(--text-muted)',
              border: `1px solid ${isActive ? 'rgba(74,222,128,0.25)' : 'transparent'}`,
            })}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          <div className="mono">v1.0.0</div>
          <div className="mt-0.5 opacity-60">Open-Meteo API</div>
        </div>
      </div>
    </aside>
  )
}
