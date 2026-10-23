import { useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FileText, Map, Network, Package, ShieldCheck, Users } from 'lucide-react'
import { useMaster } from '../state/MasterContext.jsx'

const NAV = [
  { to: '/mapa', label: 'Mapa', title: 'Mapa do Mundo de Batalha', Icon: Map },
  { to: '/fichas', label: 'Fichas', title: 'Fichas dos personagens', Icon: Users },
  { to: '/arvores', label: 'Árvores', title: 'Árvores de habilidades', Icon: Network },
  { to: '/inventario', label: 'Inventário', title: 'Inventário', Icon: Package },
  { to: '/notas', label: 'Notas', title: 'Notas da campanha', Icon: FileText },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { isMaster } = useMaster()
  const taps = useRef([])

  // Acesso discreto: 5 toques seguidos na marca abrem a área do mestre (ou use o endereço #/mestre).
  const onMark = () => {
    const now = Date.now()
    taps.current = [...taps.current.filter((t) => now - t < 2500), now]
    if (taps.current.length >= 5) {
      taps.current = []
      navigate('/mestre')
    }
  }

  return (
    <nav className="rail" aria-label="Navegação principal">
      <button className="rail__mark" onClick={onMark} aria-label="Mundo de Batalha">
        <span>MB</span>
      </button>
      <ul className="rail__nav">
        {NAV.map(({ to, label, title, Icon }) => (
          <li key={to}>
            <NavLink to={to} title={title} className={({ isActive }) => `rail__link ${isActive ? 'rail__link--active' : ''}`}>
              <Icon size={22} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
        {isMaster && (
          <li className="rail__master">
            <NavLink to="/mestre" title="Área do mestre" className={({ isActive }) => `rail__link ${isActive ? 'rail__link--active' : ''}`}>
              <ShieldCheck size={22} strokeWidth={1.8} />
              <span>Mestre</span>
            </NavLink>
          </li>
        )}
      </ul>
    </nav>
  )
}
