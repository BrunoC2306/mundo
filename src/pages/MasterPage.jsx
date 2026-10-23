import { Loader2 } from 'lucide-react'
import { useMaster } from '../state/MasterContext.jsx'
import MasterLogin from './MasterLogin.jsx'
import MasterDashboard from './MasterDashboard.jsx'

export default function MasterPage() {
  const { ready, isMaster } = useMaster()
  if (!ready) {
    return (
      <section className="page">
        <div className="state">
          <Loader2 className="spin" size={28} />
        </div>
      </section>
    )
  }
  return isMaster ? <MasterDashboard /> : <MasterLogin />
}
