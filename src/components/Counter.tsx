"use client";

import { useState } from "react";

interface CounterProps {
  initialValue?: number;
}

export default function Counter({ initialValue = 0 }: CounterProps) {
  const [count, setCount] = useState(initialValue);

  return (
    <div
      style={{
        backgroundColor: "#f0f0f0",
        padding: "1rem",
        borderRadius: "8px",
        display: "inline-block",
      }}
    >
      <p style={{ marginBottom: "1rem" }}>
        <strong>Count:</strong>{" "}
        <span style={{ fontSize: "1.5rem" }}>{count}</span>
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button className="button" onClick={() => setCount(count + 1)}>
          +
        </button>
        <button className="button" onClick={() => setCount(count - 1)}>
          -
        </button>
        <button
          className="button"
          onClick={() => setCount(0)}
          style={{ backgroundColor: "#666" }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
