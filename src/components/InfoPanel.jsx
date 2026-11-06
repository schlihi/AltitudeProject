export default function InfoPanel({ title, children, accent = 'default' }) {
  return (
    <section className="card" data-accent={accent}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}
