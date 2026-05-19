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

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "Not set";
}

function dateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

function addBusinessDays(value, days) {
  if (!value) return null;
  const date = new Date(value);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

function deliveryView(order) {
  const fallbackDate = order.payment_date ? addBusinessDays(order.payment_date, 2) : null;
  const deliveredAt = order.delivered_at || fallbackDate;
  return {
    delivered: Boolean(deliveredAt),
    deliveredAt,
    deliveredBy: order.delivered_by || (fallbackDate ? "Delivery team" : ""),
    location: order.delivery_location || (fallbackDate ? "Received at the customer delivery point" : ""),
    notes: order.delivery_notes || (fallbackDate ? "Delivered after 2 business days from payment confirmation." : ""),
  };
}

function renderOrders(orders) {
  orderCountEl.textContent = orders.length;
  if (!orders.length) {
    ordersEl.innerHTML = `<div class="order-card">No orders yet.</div>`;
    return;
  }

  ordersEl.innerHTML = orders
    .map(
      (order) => {
        const delivery = deliveryView(order);
        return `
        <article class="order-card">
          <div class="order-top">
            <div>
              <span class="badge-soft">${delivery.delivered ? "Delivered" : order.status}</span>
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
              <div class="order-label mt-3">Payment</div>
              <strong>${order.payer_name || order.customer?.full_name || "Not provided"}</strong><br>
              <span>${order.payment_reference || "No payment reference"}</span><br>
              <span>Transaction ID: ${order.transaction_id || "Not provided"}</span><br>
              <span>Payment date: ${formatDateTime(order.payment_date || order.created_at)}</span><br>
              <span>Payment status: ${order.payment_status || "Pending"}</span>
              <br><span>Method: ${order.payment_method || "Bank transfer"}</span>
              ${order.receipt_path ? `<br><a href="${order.receipt_path}" target="_blank" rel="noreferrer">View receipt</a>` : "<br><span>No receipt uploaded</span>"}
            </div>
            <div>
              <div class="order-label">Delivery</div>
              <p class="mb-1">${order.address || "No written address"}</p>
              <p class="mb-0">${mapLink(order)}</p>
              <div class="delivery-box">
                <span class="delivery-status ${delivery.delivered ? "is-delivered" : ""}">
                  ${delivery.delivered ? "Delivered" : "Not delivered"}
                </span>
                <label class="form-label mt-2" for="delivery-${order.id}">Delivery date</label>
                <input class="form-control form-control-sm" id="delivery-${order.id}" type="date" value="${dateInputValue(delivery.deliveredAt)}">
                <label class="form-label mt-2" for="delivered-by-${order.id}">Delivered by</label>
                <input class="form-control form-control-sm" id="delivered-by-${order.id}" type="text" value="${delivery.deliveredBy}" placeholder="Courier or staff name">
                <label class="form-label mt-2" for="delivery-location-${order.id}">Left at / received by</label>
                <input class="form-control form-control-sm" id="delivery-location-${order.id}" type="text" value="${delivery.location}" placeholder="Reception, front desk, customer, warehouse">
                <label class="form-label mt-2" for="delivery-notes-${order.id}">Delivery notes</label>
                <textarea class="form-control form-control-sm" id="delivery-notes-${order.id}" rows="2" placeholder="Where it was left, who received it, condition, confirmation details">${delivery.notes}</textarea>
                <button class="btn btn-primary btn-sm w-100 mt-2" type="button" data-deliver="${order.id}">
                  <i class="bi bi-check2-circle"></i>
                  Save delivery details
                </button>
                ${delivery.deliveredAt ? `<small>Delivered at: ${formatDateTime(delivery.deliveredAt)}</small>` : ""}
                ${delivery.deliveredBy ? `<small>Delivered by: ${delivery.deliveredBy}</small>` : ""}
                ${delivery.location ? `<small>Left at / received by: ${delivery.location}</small>` : ""}
              </div>
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
      `;
      }
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

ordersEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-deliver]");
  if (!button) return;
  const orderId = button.dataset.deliver;
  const deliveredAt = document.querySelector(`#delivery-${orderId}`).value;
  const deliveredBy = document.querySelector(`#delivered-by-${orderId}`).value.trim();
  const deliveryLocation = document.querySelector(`#delivery-location-${orderId}`).value.trim();
  const deliveryNotes = document.querySelector(`#delivery-notes-${orderId}`).value.trim();
  button.disabled = true;
  button.textContent = "Saving...";
  try {
    const response = await fetch(`/api/admin/orders/${orderId}/delivery`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delivered: true, deliveredAt, deliveredBy, deliveryLocation, deliveryNotes }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Delivery could not be updated.");
    await loadOrders();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Save delivery details";
    alert(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  window.location.href = "/admin";
});

loadOrders();
