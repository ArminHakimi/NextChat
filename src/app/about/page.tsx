export default function About() {
  return (
    <div>
      <h1>About Next.js</h1>

      <div className="card">
        <h2>What is Next.js?</h2>
        <p>
          Next.js is a React framework that enables you to build full-stack web
          applications by extending the latest React features and integrating
          powerful Rust-based JavaScript tooling for the fastest builds.
        </p>
      </div>

      <div className="card">
        <h2>Key Features</h2>
        <ul style={{ lineHeight: "2", marginLeft: "1.5rem" }}>
          <li>
            <strong>Server and Client Components:</strong> Optimized rendering
            with automatic code splitting.
          </li>
          <li>
            <strong>API Routes:</strong> Build scalable APIs with simple file
            structure.
          </li>
          <li>
            <strong>Static & Dynamic Rendering:</strong> Fastest performance
            with flexible options.
          </li>
          <li>
            <strong>Built-in SEO:</strong> Metadata and sitemap support out of
            the box.
          </li>
          <li>
            <strong>Middleware:</strong> Run code before requests are processed.
          </li>
          <li>
            <strong>Edge Functions:</strong> Deploy serverless functions at the
            edge.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Comparison Table</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                backgroundColor: "#f0f0f0",
                borderBottom: "2px solid #0070f3",
              }}
            >
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Aspect</th>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>React</th>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Express</th>
              <th style={{ padding: "0.75rem", textAlign: "left" }}>Next.js</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "0.75rem" }}>
                <strong>Purpose</strong>
              </td>
              <td style={{ padding: "0.75rem" }}>UI Library</td>
              <td style={{ padding: "0.75rem" }}>Backend Framework</td>
              <td style={{ padding: "0.75rem" }}>Full-stack Framework</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "0.75rem" }}>
                <strong>Rendering</strong>
              </td>
              <td style={{ padding: "0.75rem" }}>Client-side</td>
              <td style={{ padding: "0.75rem" }}>Server-side</td>
              <td style={{ padding: "0.75rem" }}>Both</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "0.75rem" }}>
                <strong>Routing</strong>
              </td>
              <td style={{ padding: "0.75rem" }}>Manual (React Router)</td>
              <td style={{ padding: "0.75rem" }}>Manual (Express routes)</td>
              <td style={{ padding: "0.75rem" }}>Automatic (File-based)</td>
            </tr>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "0.75rem" }}>
                <strong>API Routes</strong>
              </td>
              <td style={{ padding: "0.75rem" }}>No</td>
              <td style={{ padding: "0.75rem" }}>Yes</td>
              <td style={{ padding: "0.75rem" }}>Yes</td>
            </tr>
            <tr>
              <td style={{ padding: "0.75rem" }}>
                <strong>Database</strong>
              </td>
              <td style={{ padding: "0.75rem" }}>No</td>
              <td style={{ padding: "0.75rem" }}>Via ORM/driver</td>
              <td style={{ padding: "0.75rem" }}>Via ORM/driver</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>When to Use Next.js</h2>
        <ul style={{ lineHeight: "2", marginLeft: "1.5rem" }}>
          <li>Building full-stack applications</li>
          <li>Need SEO optimized sites</li>
          <li>Want rapid development without complex setup</li>
          <li>Combining frontend + backend in one project</li>
          <li>Static site generation with dynamic content</li>
        </ul>
      </div>
    </div>
  );
}
