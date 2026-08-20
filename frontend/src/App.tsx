import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/dashboard/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Zones } from './pages/Zones'
import { Weather } from './pages/Weather'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { DatabaseExplorer } from './pages/DatabaseExplorer'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex" style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/database" element={<DatabaseExplorer />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
