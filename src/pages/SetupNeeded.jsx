export default function SetupNeeded() {
  return (
    <main className="setup">
      <div className="setup__panel">
        <h1 className="page__title">Falta configurar o banco de dados</h1>
        <p>
          Este site precisa de um projeto Supabase para guardar e sincronizar os dados. Copie o arquivo <code>.env.example</code> para{' '}
          <code>.env</code>, preencha <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code> e{' '}
          <code>VITE_MASTER_EMAIL</code> e reinicie o site.
        </p>
        <p>O passo a passo completo está no arquivo <code>README.md</code>.</p>
      </div>
    </main>
  )
}
