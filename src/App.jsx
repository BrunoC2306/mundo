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
import SetupNeeded from './pages/SetupNeeded.jsx'

// O mapa vira a página inicial quando for implementado (etapa 8).
const DEFAULT_ROUTE = '/fichas'

export default function App() {
  if (!isConfigured) return <SetupNeeded />
  return (
    <UiProvider>
      <MasterProvider>
        <DataProvider>
          <div className="app">
            <Sidebar />
            <main className="main">
              <Routes>
                <Route path="/" element={<Navigate to={DEFAULT_ROUTE} replace />} />
                <Route path="/mapa" element={<ComingSoon title="Mapa" stage="8" text="Mapa do Mundo de Batalha com pontos de interesse e galerias de imagens." />} />
                <Route path="/fichas" element={<SheetsPage />} />
                <Route path="/fichas/:slug" element={<SheetView />} />
                <Route path="/arvores" element={<AbilityTreePage />} />
                <Route path="/inventario" element={<ComingSoon title="Inventário" stage="9" text="Lista de itens por personagem." />} />
                <Route path="/notas" element={<ComingSoon title="Notas" stage="9" text="Cadernos de notas por personagem." />} />
                <Route path="/mestre" element={<MasterPage />} />
                <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
              </Routes>
            </main>
          </div>
        </DataProvider>
      </MasterProvider>
    </UiProvider>
  )
}
