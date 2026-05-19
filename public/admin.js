const ordersEl = document.querySelector("#orders");
const orderCountEl = document.querySelector("#orderCount");
const dbModeEl = document.querySelector("#dbMode");
const logoutButton = document.querySelector("#logoutButton");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function mapLink(order) {
  if (!order.latitude || !order.longitude) return "No GPS location";
  const url = `https://www.google.com/maps?q=${order.latitude},${order.longitude}`;
  return `<a href="${url}" target="_blank" rel="noreferrer">Open in Google Maps</a>`;
}

function renderOrders(orders) {
  orderCountEl.textContent = orders.length;
  if (!orders.length) {
    ordersEl.innerHTML = `<div class="order-card">No orders yet.</div>`;
    return;
  }

  ordersEl.innerHTML = orders
    .map(
      (order) => `
        <article class="order-card">
          <div class="order-top">
            <div>
              <span class="badge-soft">${order.status}</span>
              <h2>Order #${order.id}</h2>
              <small>${new Date(order.created_at).toLocaleString()}</small>
            </div>
            <div class="order-total">${money.format(order.total)}</div>
          </div>
          <div class="order-grid">
            <div>
              <div class="order-label">Customer</div>
              <strong>${order.customer?.full_name || ""}</strong><br>
              <span>${order.customer?.phone || ""}</span><br>
              <span>${order.customer?.email || ""}</span>
            </div>
            <div>
              <div class="order-label">Delivery</div>
              <p class="mb-1">${order.address || "No written address"}</p>
              <p class="mb-0">${mapLink(order)}</p>
            </div>
            <div>
              <div class="order-label">Products</div>
              <ul class="order-items">
                ${order.items
                  .map(
                    (item) =>
                      `<li>${item.quantity} x ${item.product_name || item.product?.name} - ${money.format(item.line_total || item.product?.price * item.quantity)}</li>`
                  )
                  .join("")}
              </ul>
              ${order.notes ? `<p class="mt-2 mb-0"><strong>Notes:</strong> ${order.notes}</p>` : ""}
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadOrders() {
  try {
    const response = await fetch("/api/admin/orders");
    const result = await response.json();
    if (response.status === 401) {
      window.location.href = "/admin";
      return;
    }
    if (!response.ok) throw new Error(result.message || "Orders could not be loaded.");
    dbModeEl.textContent = result.database === "postgres" ? "PostgreSQL" : "Memory demo";
    renderOrders(result.orders);
  } catch (error) {
    ordersEl.innerHTML = `<div class="order-card text-danger">${error.message}</div>`;
  }
}

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin";
});

loadOrders();
