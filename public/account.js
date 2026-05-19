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

function bankTransferBox(order) {
  if (order.receipt_path || order.payment_status === "In review") {
    return `<div class="review-box"><strong>Payment in review</strong><span>Your voucher was uploaded. We will verify the transfer and update your order.</span></div>`;
  }
  return `
    <div class="bank-transfer-box mt-3">
      <p class="eyebrow">Pending payment</p>
      <h3>Transfer to this account</h3>
      <p class="bank-help">Make the transfer for ${money.format(order.total)} and upload your voucher here.</p>
      <dl>
        <div><dt>Bank name</dt><dd>Citibank</dd></div>
        <div><dt>Bank address</dt><dd>111 Wall Street New York, NY 10043 USA</dd></div>
        <div><dt>ABA routing number</dt><dd>031100209</dd></div>
        <div><dt>SWIFT code</dt><dd>CITIUS33</dd></div>
        <div><dt>Account number</dt><dd>70588040002228010</dd></div>
        <div><dt>Account type</dt><dd>CHECKING</dd></div>
        <div><dt>Beneficiary</dt><dd>IMPORTADORA QUEVEDO LLC</dd></div>
      </dl>
      <form class="voucher-form" data-voucher-form="${order.id}">
        <label class="form-label" for="receipt-${order.id}">Upload payment voucher</label>
        <input class="form-control" id="receipt-${order.id}" name="receipt" type="file" accept="image/*,.pdf" required />
        <button class="btn btn-primary btn-sm w-100 mt-2" type="submit">Upload voucher</button>
      </form>
    </div>
  `;
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
              <span>Status: ${order.payment_status || "Pending payment"}</span>
              ${bankTransferBox(order)}
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

ordersEl.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-voucher-form]");
  if (!form) return;
  event.preventDefault();
  const orderId = form.dataset.voucherForm;
  const button = form.querySelector("button");
  button.disabled = true;
  button.textContent = "Uploading...";
  try {
    const response = await fetch(`/api/account/orders/${orderId}/receipt`, {
      method: "POST",
      body: new FormData(form),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Voucher could not be uploaded.");
    await loadOrders();
  } catch (error) {
    button.disabled = false;
    button.textContent = "Upload voucher";
    alert(error.message);
  }
});

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
