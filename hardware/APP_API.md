# App API — Supabase RPC

Both the app and Pico Ws call Supabase's Data API.

Raw HTTP format:

```http
POST https://YOUR_PROJECT.supabase.co/rest/v1/rpc/FUNCTION_NAME
apikey: sb_publishable_...
Content-Type: application/json
```

## Create pair

Function: `window_create_pair`

```json
{}
```

Returns the pair ID and one-time secret.

## Publish the current user's timezone

Function: `window_set_timezone`

```json
{
  "p_pair_id": "AB12CD34",
  "p_pair_secret": "...",
  "p_side": "A",
  "p_timezone": "America/New_York"
}
```

## Get the other person's timezone

Function: `window_get_partner`

```json
{
  "p_pair_id": "AB12CD34",
  "p_pair_secret": "...",
  "p_side": "A"
}
```

## Send a knock pattern

Function: `window_send_knock`

```json
{
  "p_pair_id": "AB12CD34",
  "p_pair_secret": "...",
  "p_side": "A",
  "p_intervals_ms": [0, 180, 520]
}
```

The first knock is at time zero. Each later number is the delay since the previous
knock.

## Get initial cursor

Function: `window_get_knock_cursor`

```json
{
  "p_pair_id": "AB12CD34",
  "p_pair_secret": "..."
}
```

## Receive partner knocks

Function: `window_get_knocks`

```json
{
  "p_pair_id": "AB12CD34",
  "p_pair_secret": "...",
  "p_side": "B",
  "p_after_id": 42,
  "p_limit": 25
}
```

## JavaScript / React Native example

```js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const pair = {
  id: "AB12CD34",
  secret: "...",
  side: "A",
};

export async function setMyTimezone(timezone) {
  const { data, error } = await supabase.rpc("window_set_timezone", {
    p_pair_id: pair.id,
    p_pair_secret: pair.secret,
    p_side: pair.side,
    p_timezone: timezone,
  });

  if (error) throw error;
  return data;
}

export async function sendKnock(intervalsMs) {
  const { data, error } = await supabase.rpc("window_send_knock", {
    p_pair_id: pair.id,
    p_pair_secret: pair.secret,
    p_side: pair.side,
    p_intervals_ms: intervalsMs,
  });

  if (error) throw error;
  return data;
}
```
