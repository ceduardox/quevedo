const loginPanel = document.querySelector("#loginPanel");
const ordersPanel = document.querySelector("#ordersPanel");
const ordersEl = document.querySelector("#accountOrders");
const form = document.querySelector("#accountLoginForm");
const messageEl = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function addBusinessDays(value, days) {
  if (!value) return null;
  const date = new Date(value);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date.toLocaleDateString("en-US");
}

function deliveryStatus(order) {
  const date = order.delivered_at ? new Date(order.delivered_at).toLocaleDateString("en-US") : addBusinessDays(order.payment_date, 2);
  return date ? `Delivered on ${date}` : "Pending delivery";
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersEl.innerHTML = `<div class="order-card">No orders found for this account.</div>`;
    return;
  }
  ordersEl.innerHTML = orders
    .map(
      (order) => `
        <article class="order-card">
          <div class="order-top">
            <div>
              <span class="badge-soft">${order.delivered_at || order.payment_date ? "Delivered" : order.status}</span>
              <h2>Order #${order.id}</h2>
              <small>${new Date(order.created_at).toLocaleString("en-US")}</small>
            </div>
            <div class="order-total">${money.format(order.total)}</div>
          </div>
          <div class="order-grid">
            <div>
              <div class="order-label">Delivery status</div>
              <strong>${deliveryStatus(order)}</strong>
              <p>${order.delivery_notes || "Delivered after 2 business days from payment confirmation."}</p>
            </div>
            <div>
              <div class="order-label">Payment</div>
              <span>${order.payment_method || "Bank transfer"}</span><br>
              <span>${order.receipt_path ? "Receipt uploaded" : "No receipt uploaded"}</span>
            </div>
            <div>
              <div class="order-label">Products</div>
              <ul class="order-items">
                ${order.items.map((item) => `<li>${item.quantity} x ${item.product_name} - ${money.format(item.line_total)}</li>`).join("")}
              </ul>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadOrders() {
  const response = await fetch("/api/account/orders");
  const result = await response.json();
  if (response.status === 401) {
    loginPanel.hidden = false;
    ordersPanel.hidden = true;
    logoutButton.hidden = true;
    return;
  }
  loginPanel.hidden = true;
  ordersPanel.hidden = false;
  logoutButton.hidden = false;
  renderOrders(result.orders);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageEl.textContent = "Checking account...";
  const response = await fetch("/api/account/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
  });
  const result = await response.json();
  if (!response.ok) {
    messageEl.classList.add("error");
    messageEl.textContent = result.message || "Login failed.";
    return;
  }
  await loadOrders();
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/account/logout", { method: "POST" });
  window.location.reload();
});

loadOrders();
