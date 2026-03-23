import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // PayPal Client Setup
  const paypal = (await import('@paypal/checkout-server-sdk')).default;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === 'YOUR_PAYPAL_CLIENT_ID' || clientSecret === 'YOUR_PAYPAL_CLIENT_SECRET') {
    console.warn("WARNING: PayPal credentials are not correctly configured in environment variables.");
  }

  const environment = new paypal.core.SandboxEnvironment(
    clientId || 'YOUR_PAYPAL_CLIENT_ID',
    clientSecret || 'YOUR_PAYPAL_CLIENT_SECRET'
  );
  const client = new paypal.core.PayPalHttpClient(environment);

  // PayPal Order Creation
  app.post("/api/paypal/create-order", async (req, res) => {
    const { amount, planName } = req.body;
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer("return=representation");
    request.requestBody({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount,
          },
          description: `Subscription for ${planName}`,
        },
      ],
    });

    try {
      const order = await client.execute(request);
      res.json({ id: order.result.id });
    } catch (err: any) {
      console.error("PayPal Create Order Error:", err);
      let errorMessage = err.message;
      if (err.text && err.text.includes("invalid_client")) {
        errorMessage = "PayPal Authentication Failed. Please check your PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // PayPal Order Capture
  app.post("/api/paypal/capture-order", async (req, res) => {
    const { orderID } = req.body;
    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
      const capture = await client.execute(request);
      res.json(capture.result);
    } catch (err: any) {
      console.error("PayPal Capture Order Error:", err);
      let errorMessage = err.message;
      if (err.text && err.text.includes("invalid_client")) {
        errorMessage = "PayPal Authentication Failed. Please check your PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.";
      }
      res.status(500).json({ error: errorMessage });
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
