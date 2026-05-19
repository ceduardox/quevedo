require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/eduardo_store";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-session-secret";

const products = [
  {
    id: "professional-kitchen-faucet",
    name: "Professional Kitchen Faucet",
    category: "Pro Collection",
    price: 750,
    badge: "Pro",
    image: "Professional Kitchen Faucet_1757915501686-qDncg0hK.png",
    description: "Polished professional faucet for premium kitchen projects.",
  },
  {
    id: "satin-finish-kitchen-sink",
    name: "Satin Finish Kitchen Sink",
    category: "Pro Collection",
    price: 750,
    badge: "Pro",
    image: "Satin Finish Kitchen Sink_1757915501686-BvzPqhJl.png",
    description: "Premium satin sink with a durable, refined finish.",
  },
  {
    id: "stainless-steel-kitchen-mixer",
    name: "Stainless Steel Kitchen Mixer",
    category: "Kitchen",
    price: 590,
    badge: "Best Seller",
    image: "Stainless Steel Kitchen Mixer_1757915501686-BemfgtaI.png",
    description: "High-flow stainless mixer built for daily use.",
  },
  {
    id: "chrome-soap-dispenser",
    name: "Chrome Soap Dispenser",
    category: "Accessories",
    price: 180,
    badge: "Add-on",
    image: "Chrome Soap Dispenser_1757915501685-Jawrtdpi.png",
    description: "Chrome dispenser to complete a kitchen or bath set.",
  },
];

let pool;
let dbReady = false;
const memory = { customers: [], orders: [], items: [], nextCustomerId: 1, nextOrderId: 1 };

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/media", express.static(__dirname));
app.use("/vendor/bootstrap", express.static(path.join(__dirname, "node_modules", "bootstrap", "dist")));
app.use("/vendor/bootstrap-icons", express.static(path.join(__dirname, "node_modules", "bootstrap-icons", "font")));
app.use("/vendor/leaflet", express.static(path.join(__dirname, "node_modules", "leaflet", "dist")));

function getProduct(productId) {
  return products.find((product) => product.id === productId);
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const product = getProduct(item.productId);
      const quantity = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
      return product ? { product, quantity } : null;
    })
    .filter(Boolean);
}

function hashPassword(password) {
  if (!password) return null;
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ user: ADMIN_USER, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const index = item.indexOf("=");
      if (index > -1) cookies[item.slice(0, index)] = decodeURIComponent(item.slice(index + 1));
      return cookies;
    }, {});
}

function verifyAdminToken(token) {
  try {
    if (!token || !token.includes(".")) return false;
    const [payload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
    if (signature.length !== expected.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.user === ADMIN_USER && data.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req, res, next) {
  const token = parseCookies(req).admin_session;
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ ok: false, message: "Admin login required." });
  }
  next();
}

async function initDb() {
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'New',
      total NUMERIC(10,2) NOT NULL,
      address TEXT,
      latitude NUMERIC(11,8),
      longitude NUMERIC(11,8),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      unit_price NUMERIC(10,2) NOT NULL,
      quantity INTEGER NOT NULL,
      line_total NUMERIC(10,2) NOT NULL
    );
  `);
  dbReady = true;
}

async function createOrder(payload) {
  const selectedItems = normalizeItems(payload.items);
  if (!selectedItems.length) {
    const error = new Error("Select at least one product.");
    error.status = 400;
    throw error;
  }

  const fullName = String(payload.fullName || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  if (!fullName || !phone || !email) {
    const error = new Error("Name, phone and email are required.");
    error.status = 400;
    throw error;
  }

  const total = selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const orderData = {
    fullName,
    phone,
    email,
    password: String(payload.password || "").trim(),
    address: String(payload.address || "").trim(),
    latitude: payload.latitude ? Number(payload.latitude) : null,
    longitude: payload.longitude ? Number(payload.longitude) : null,
    notes: String(payload.notes || "").trim(),
    total,
    items: selectedItems,
  };

  if (!dbReady) return createMemoryOrder(orderData);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customerResult = await client.query(
      `INSERT INTO customers (full_name, phone, email, password_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone
       RETURNING id, full_name, phone, email, created_at`,
      [orderData.fullName, orderData.phone, orderData.email, hashPassword(orderData.password)]
    );
    const customer = customerResult.rows[0];
    const orderResult = await client.query(
      `INSERT INTO orders (customer_id, total, address, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, status, total, address, latitude, longitude, notes, created_at`,
      [customer.id, orderData.total, orderData.address, orderData.latitude, orderData.longitude, orderData.notes]
    );
    const order = orderResult.rows[0];

    for (const item of orderData.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.product.id,
          item.product.name,
          item.product.price,
          item.quantity,
          item.product.price * item.quantity,
        ]
      );
    }

    await client.query("COMMIT");
    return { ...order, customer, items: orderData.items };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function createMemoryOrder(orderData) {
  let customer = memory.customers.find((item) => item.email === orderData.email);
  if (!customer) {
    customer = {
      id: memory.nextCustomerId++,
      full_name: orderData.fullName,
      phone: orderData.phone,
      email: orderData.email,
      password_hash: hashPassword(orderData.password),
      created_at: new Date().toISOString(),
    };
    memory.customers.push(customer);
  } else {
    customer.full_name = orderData.fullName;
    customer.phone = orderData.phone;
  }

  const order = {
    id: memory.nextOrderId++,
    customer_id: customer.id,
    status: "New",
    total: orderData.total,
    address: orderData.address,
    latitude: orderData.latitude,
    longitude: orderData.longitude,
    notes: orderData.notes,
    created_at: new Date().toISOString(),
  };
  memory.orders.push(order);
  orderData.items.forEach((item) => {
    memory.items.push({
      order_id: order.id,
      product_id: item.product.id,
      product_name: item.product.name,
      unit_price: item.product.price,
      quantity: item.quantity,
      line_total: item.product.price * item.quantity,
    });
  });
  return { ...order, customer, items: orderData.items };
}

async function listOrders() {
  if (!dbReady) {
    return memory.orders
      .slice()
      .reverse()
      .map((order) => ({
        ...order,
        customer: memory.customers.find((customer) => customer.id === order.customer_id),
        items: memory.items.filter((item) => item.order_id === order.id),
      }));
  }

  const result = await pool.query(`
    SELECT
      o.*,
      c.full_name,
      c.phone,
      c.email,
      COALESCE(
        json_agg(
          json_build_object(
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'line_total', oi.line_total
          )
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'
      ) AS items
    FROM orders o
    LEFT JOIN customers c ON c.id = o.customer_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY o.id, c.id
    ORDER BY o.created_at DESC
  `);

  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    total: Number(row.total),
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    created_at: row.created_at,
    customer: {
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
    },
    items: row.items,
  }));
}

app.get("/api/products", (req, res) => {
  res.json(products);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, database: dbReady ? "postgres" : "memory-demo" });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-login.html"));
});

app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.post("/api/admin/login", (req, res) => {
  const username = String(req.body.username || "");
  const password = String(req.body.password || "");
  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "Invalid username or password." });
  }
  res.setHeader("Set-Cookie", `admin_session=${encodeURIComponent(createAdminToken())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (req, res) => {
  res.json({ ok: true, user: ADMIN_USER });
});

app.post("/api/orders", async (req, res) => {
  try {
    const order = await createOrder(req.body);
    res.status(201).json({ ok: true, orderId: order.id, total: Number(order.total) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "Order could not be created." });
  }
});

app.get("/api/admin/orders", requireAdmin, async (req, res) => {
  const orders = await listOrders();
  res.json({ ok: true, database: dbReady ? "postgres" : "memory-demo", orders });
});

initDb()
  .catch((error) => {
    console.warn("PostgreSQL is not available. The app will start in memory demo mode.");
    console.warn(error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Store ready at http://localhost:${PORT}`);
      console.log(`Admin login at http://localhost:${PORT}/admin`);
      console.log(`Database: ${dbReady ? "PostgreSQL" : "memory demo mode"}`);
    });
  });
