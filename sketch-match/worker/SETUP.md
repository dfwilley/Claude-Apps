# Setting up the Sketch Match worker

The worker is a small script that runs on Cloudflare's free plan. It holds the Claude API key so the key is never on
the phone, and it is the only thing the app talks to. This takes about ten minutes and is done once.

1. Sign in at https://dash.cloudflare.com (a free account is enough).
2. Go to **Workers & Pages**, choose **Create**, then **Create Worker**. Name it `sketch-match` and press **Deploy**.
3. Press **Edit code**. Delete everything in the editor, paste in the whole of `sketch-match-worker.mjs` from this
   folder, and press **Deploy**.
4. Go to the worker's **Settings**, then **Variables and Secrets**, and add two entries of type **Secret**:
   - `ANTHROPIC_API_KEY`: your Claude API key (from https://platform.claude.com, API keys).
   - `FAMILY_CODE`: any word or number you choose. Only someone who knows it can use the worker.
5. Copy the worker's address. It looks like `https://sketch-match.your-name.workers.dev`.
6. In Sketch Match, open **Setup** (the gear), enter the address and the family code, and press **Test**.

Good to know:

- Each check of a drawing costs a few cents on the Claude account. Set a monthly spending limit on that account
  (Claude Console, Settings, Limits) so a mistake can't run up a bill.
- The worker only answers the Sketch Match page on `https://dfwilley.github.io`. To allow another address, add a
  text variable `ALLOWED_ORIGINS` with the addresses separated by commas.
- To change the family code, edit the `FAMILY_CODE` secret and enter the new one in the app's Setup.
- The worker stores nothing. The photo goes to Anthropic's Claude API to be looked at and the feedback comes back.
