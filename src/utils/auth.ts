// utils/auth.ts

export async function handleLogout() {
  localStorage.removeItem("gebruiker");
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/sign-in"; // of "/login" als dat jouw route is
}
