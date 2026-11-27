import React, { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/dashboard/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Zones } from './pages/Zones'
import { Weather } from './pages/Weather'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'
import { DatabaseExplorer } from './pages/DatabaseExplorer'
import { TerraFlowContext, ConnectionState } from './context/TerraFlowContext'

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>('loading')
  const [refreshVersion, setRefreshVersion] = useState(0)
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <TerraFlowContext.Provider value={{ connection, setConnection, refreshVersion }}>
      <div className="tf-app">
        <Sidebar connection={connection} onRefresh={() => setRefreshVersion(value => value + 1)} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/weather" element={<Weather />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/database" element={<DatabaseExplorer />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
      </TerraFlowContext.Provider>
    </BrowserRouter>
  )
}
