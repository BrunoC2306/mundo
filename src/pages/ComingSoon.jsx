import PageHeader from '../components/PageHeader.jsx'

// Seções das próximas etapas. Nada aqui finge funcionar nem guarda dados.
export default function ComingSoon({ title, stage, text }) {
  return (
    <section className="page">
      <PageHeader title={title} />
      <div className="state">
        <h2 className="state__title">Chega na etapa {stage}</h2>
        <p className="state__text">{text}</p>
      </div>
    </section>
  )
}
