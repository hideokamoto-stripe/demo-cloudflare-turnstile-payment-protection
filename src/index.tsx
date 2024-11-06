import { Hono } from "hono";
import { env } from "hono/adapter";
import { html } from "hono/html";

const app = new Hono<{
  Bindings: CloudflareBindings;
}>();

app.get("/", (c) => {
  const { TURNSTILE_SITE_KEY } = env(c);
  return c.html(
    <main>
      <form id="payment-form">
        <div id="payment-element"></div>
        <div id="result"></div>
        <div class="cf-turnstile"></div>
        <button type="submit" disabled>
          Order
        </button>
      </form>
      {html`
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=_turnstileCb"
          defer
        ></script>
        <script>
          let turnstileToken = "";
          const submitButon = document.querySelector("button[type='submit']");
          function _turnstileCb() {
            turnstile.render(".cf-turnstile", {
              sitekey: "${TURNSTILE_SITE_KEY}",
              callback: function (token) {
                turnstileToken = token;
                submitButon.removeAttribute("disabled");
              },
            });
          }
        </script>
      `}
    </main>,
  );
});

export default app;
