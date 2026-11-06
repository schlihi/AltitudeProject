import { NavLink } from 'react-router-dom';

export default function PageHeader({ title, description }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>

      <nav aria-label="Main navigation">
        <NavLink to="/visualization">Geoid Visualization</NavLink>
        <NavLink to="/altitude">Altitude Comparison</NavLink>
      </nav>
    </header>
  );
}
