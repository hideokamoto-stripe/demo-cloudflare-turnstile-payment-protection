import { Hono } from "hono";
import { env } from "hono/adapter";
import { html } from "hono/html";
import Stripe from "stripe";
import { HTTPException } from "hono/http-exception";

const app = new Hono<{
  Bindings: CloudflareBindings;
}>();

type TurnstileResult = {
  success: boolean;
  challenge_ts: string;
  hostname: string;
  "error-codes": Array<string>;
  action: string;
  cdata: string;
};

app.post("/pre-confirm", async (c) => {
  const { TURNSTILE_SECRET_KEY, STRIPE_SECRET_KEY } = env(c);
  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-10-28.acacia",
    appInfo: {
      name: "example/cloudflare-turnstile",
    },
  });

  const body = await c.req.json();
  const ip = c.req.header("CF-Connecting-IP");
  const paymentIntentId = body.payment_intent_id

  const formData = new FormData();
  formData.append("secret", TURNSTILE_SECRET_KEY);
  formData.append("response", body.turnstile_token);
  formData.append("remoteip", ip || "");
  const turnstileResult = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      body: formData,
      method: "POST",
    },
  );
  const outcome = await turnstileResult.json<TurnstileResult>();

  await stripe.paymentIntents.update(paymentIntentId, {
    metadata: {
      turnstile_result: outcome.success ? 'success' : 'failed',
      turnstile_challenge_ts: outcome.challenge_ts,
    }
  })

  if (!outcome.success) {
    throw new HTTPException(401, {
      res: new Response(
        JSON.stringify({
          success: outcome.success,
          message: "Unauthorized",
          error_codes: outcome["error-codes"],
        }),
      ),
    });
  }
  return c.json({
    success: outcome.success
  });
});

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
        <button type="submit">Order</button>
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
          const resultElement = document.getElementById("result");

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
            resultElement.innerHTML = "";

            const preConfirmationResponse = await fetch("/pre-confirm", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                turnstile_token: turnstileToken,
                payment_intent_id: "${paymentIntent.id}",
              }),
            });
            const preConfirmationResult = await preConfirmationResponse.json();
            console.log(preConfirmationResult);
            if (!preConfirmationResult.success) {
              submitButon.removeAttribute("disabled");
              resultElement.innerHTML = JSON.stringify(
                preConfirmationResult,
                null,
                2,
              );
              return;
            }
            return;

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
