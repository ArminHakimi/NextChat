"use client";

import { useState, useEffect } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch from API route
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1>Users Page</h1>

      <div className="card">
        <h2>🔍 Fetching Data from API Route</h2>
        <p>
          This page demonstrates client-side data fetching from an API route
          located at <code>/api/users</code>.
        </p>
      </div>

      {loading && <p>Loading users...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {!loading && users.length > 0 && (
        <>
          <h2>Users List ({users.length})</h2>
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: "1rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: "#0070f3",
                    color: "white",
                  }}
                >
                  <th style={{ padding: "0.75rem", textAlign: "left" }}>
                    Name
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left" }}>
                    Email
                  </th>
                  <th style={{ padding: "0.75rem", textAlign: "left" }}>
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: "1px solid #ddd" }}>
                    <td style={{ padding: "0.75rem" }}>{user.name}</td>
                    <td style={{ padding: "0.75rem" }}>{user.email}</td>
                    <td style={{ padding: "0.75rem" }}>
                      <span
                        style={{
                          backgroundColor: "#e0e0e0",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                          fontSize: "0.875rem",
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: "2rem" }}>
        <h2>💡 How This Works</h2>
        <ol style={{ lineHeight: "2", marginLeft: "1.5rem" }}>
          <li>Page renders with "use client" directive (client component)</li>
          <li>useEffect hook runs and calls /api/users endpoint</li>
          <li>API route returns mock user data</li>
          <li>Data updates state and table renders</li>
        </ol>
      </div>
    </div>
  );
}
