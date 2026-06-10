import Browserbase from "@browserbasehq/sdk";

export const browserbase = new Browserbase({
  apiKey: process.env.BROWSERBASE_API_KEY!,
});
