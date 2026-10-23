import { Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured } from './lib/supabase.js'
import { UiProvider } from './ui/UiProvider.jsx'
import { MasterProvider } from './state/MasterContext.jsx'
import { DataProvider } from './state/DataContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import SheetsPage from './pages/SheetsPage.jsx'
import SheetView from './pages/SheetView.jsx'
import MasterPage from './pages/MasterPage.jsx'
import ComingSoon from './pages/ComingSoon.jsx'
import AbilityTreePage from './pages/AbilityTreePage.jsx'
import MapPage from './pages/MapPage.jsx'
import SetupNeeded from './pages/SetupNeeded.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import NotesPage from './pages/NotesPage.jsx'
import { PlayerIdentityProvider } from './state/PlayerIdentityContext.jsx'

// O mapa vira a página inicial quando for implementado (etapa 8).
const DEFAULT_ROUTE = '/fichas'

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <UiProvider>
      <MasterProvider>
        <DataProvider>
          <PlayerIdentityProvider>
          <div className="app">
            <Sidebar />
            <main className="main">
              <Routes>
                <Route path="/" element={<Navigate to={DEFAULT_ROUTE} replace />} />
                <Route path="/mapa" element={<MapPage />} />
                <Route path="/fichas" element={<SheetsPage />} />
                <Route path="/fichas/:slug" element={<SheetView />} />
                <Route path="/arvores" element={<AbilityTreePage />} />
                <Route path="/inventario" element={<InventoryPage />} />
                <Route path="/notas" element={<NotesPage />} />
                <Route path="/mestre" element={<MasterPage />} />
                <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
              </Routes>
            </main>
          </div>
          </PlayerIdentityProvider>
        </DataProvider>
      </MasterProvider>
    </UiProvider>
  )
}
