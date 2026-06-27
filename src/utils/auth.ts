// src/utils/auth.ts

export async function handleLogout() {
  try {
    await fetch("/api/logout", {
      method: "POST",
    });
  } finally {
    window.location.href = "/sign-in";
  }
}