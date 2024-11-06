import { Hono } from "hono";

const app = new Hono<{
  Bindings: CloudflareBindings;
}>();

app.get("/", (c) => {
  return c.html(
    <main>
      <form id="payment-form">
        <div id="payment-element"></div>
        <div id="result"></div>
        <button type="submit">Order</button>
      </form>
    </main>,
  );
});

export default app;
