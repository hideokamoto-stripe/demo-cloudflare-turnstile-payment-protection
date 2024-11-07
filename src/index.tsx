import { Hono } from "hono";
import { env } from "hono/adapter";
import { html } from "hono/html";
import Stripe from "stripe";

const app = new Hono<{
  Bindings: CloudflareBindings;
}>();

app.get("/", async (c) => {
  const { TURNSTILE_SITE_KEY, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY } =
    env(c);
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-10-28.acacia",
    appInfo: {
      name: "example/cloudflare-turnstile",
    },
  });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 100,
    currency: "usd",
  });
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
        <script src="https://js.stripe.com/v3/"></script>
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
          const stripe = Stripe("${STRIPE_PUBLISHABLE_KEY}");
          const elementsAppearance = {
            theme: "stripe",
          };
          const elements = stripe.elements({
            appearance: elementsAppearance,
            clientSecret: "${paymentIntent.client_secret}",
          });
          const paymentElement = elements.create("payment");
          paymentElement.mount("#payment-element");

          const paymentForm = document.getElementById("payment-form");
          paymentForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!turnstileToken) {
              return;
            }
            if (submitButon) {
              submitButon.setAttribute("disabled", true);
            }
            const { error: submitError } = await elements.submit();
            if (submitError) {
              console.log(submitError);
              submitButon.removeAttribute("disabled");
              return;
            }
            const { error: confirmationError } = await stripe.confirmPayment({
              elements,
              confirmParams: {
                return_url: "http://localhost:8787",
              },
            });
            submitButon.removeAttribute("disabled");
            console.log(confirmationError);
            resultElement.innerHTML = JSON.stringify(
              confirmationError,
              null,
              2,
            );
          });
        </script>
      `}
    </main>,
  );
});

export default app;
