const form = document.querySelector("#loginForm");
const messageEl = document.querySelector("#loginMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.className = "form-message mt-3";
  messageEl.textContent = "Checking credentials...";
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Login failed.");
    window.location.href = "/admin/dashboard";
  } catch (error) {
    messageEl.classList.add("error");
    messageEl.textContent = error.message;
  }
});
