require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/eduardo_store";
const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

const products = [
  {
    id: "professional-kitchen-faucet",
    name: "Professional Kitchen Faucet",
    category: "Linea Pro",
    price: 750,
    badge: "Pro",
    image: "Professional Kitchen Faucet_1757915501686-qDncg0hK.png",
    description: "Griferia profesional cromada para cocina moderna.",
  },
  {
    id: "satin-finish-kitchen-sink",
    name: "Satin Finish Kitchen Sink",
    category: "Linea Pro",
    price: 750,
    badge: "Pro",
    image: "Satin Finish Kitchen Sink_1757915501686-BvzPqhJl.png",
    description: "Lavaplatos satinado premium con acabado resistente.",
  },
  {
    id: "stainless-steel-kitchen-mixer",
    name: "Stainless Steel Kitchen Mixer",
    category: "Cocina",
    price: 590,
    badge: "Top venta",
    image: "Stainless Steel Kitchen Mixer_1757915501686-BemfgtaI.png",
    description: "Mezclador inoxidable de alto flujo para uso diario.",
  },
  {
    id: "chrome-soap-dispenser",
    name: "Chrome Soap Dispenser",
    category: "Accesorios",
    price: 180,
    badge: "Complemento",
    image: "Chrome Soap Dispenser_1757915501685-Jawrtdpi.png",
    description: "Dispensador cromado para completar el set de cocina o bano.",
  },
];

let pool;
let dbReady = false;
const memory = { customers: [], orders: [], items: [], nextCustomerId: 1, nextOrderId: 1 };

app.use(express.json());
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
      status TEXT NOT NULL DEFAULT 'Nuevo',
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
    const error = new Error("Selecciona al menos un producto.");
    error.status = 400;
    throw error;
  }

  const fullName = String(payload.fullName || "").trim();
  const phone = String(payload.phone || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  if (!fullName || !phone || !email) {
    const error = new Error("Nombre, telefono y correo son obligatorios.");
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
    status: "Nuevo",
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

app.post("/api/orders", async (req, res) => {
  try {
    const order = await createOrder(req.body);
    res.status(201).json({ ok: true, orderId: order.id, total: Number(order.total) });
  } catch (error) {
    res.status(error.status || 500).json({ ok: false, message: error.message || "No se pudo crear el pedido." });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, message: "Clave de admin invalida." });
  }
  const orders = await listOrders();
  res.json({ ok: true, database: dbReady ? "postgres" : "memory-demo", orders });
});

initDb()
  .catch((error) => {
    console.warn("PostgreSQL no esta disponible. La app iniciara en modo demo en memoria.");
    console.warn(error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Tienda lista en http://localhost:${PORT}`);
      console.log(`Admin en http://localhost:${PORT}/admin.html?key=${ADMIN_KEY}`);
      console.log(`Base de datos: ${dbReady ? "PostgreSQL" : "modo demo en memoria"}`);
    });
  });
