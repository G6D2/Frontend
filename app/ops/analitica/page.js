import PageHeader from "../../components/PageHeader";

export default function AnaliticaPage() {
  return (
    <>
      <PageHeader title="Analítica" />
      <iframe
        src="/api/analitica"
        title="Tablero de Analítica"
        sandbox="allow-scripts"
        className="block w-full border-0 bg-surface"
        style={{ height: "1200px" }}
      />
    </>
  );
}
