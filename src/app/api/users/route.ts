import { NextRequest, NextResponse } from "next/server";

export async function GET(_: NextRequest) {
  // API route to fetch users
  // File location: src/app/api/users/route.ts
  // Accessible at: /api/users

  const mockUsers = [
    {
      id: 1,
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "Admin",
    },
    {
      id: 2,
      name: "Bob Smith",
      email: "bob@example.com",
      role: "User",
    },
    {
      id: 3,
      name: "Carol Williams",
      email: "carol@example.com",
      role: "Moderator",
    },
    {
      id: 4,
      name: "David Brown",
      email: "david@example.com",
      role: "User",
    },
  ];

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return NextResponse.json({
    users: mockUsers,
    total: mockUsers.length,
  });
}
