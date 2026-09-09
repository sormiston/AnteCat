# Three-device dev loop (Mac, Android phone, browser)

Everything hangs off the Mac's LAN IP. `localhost` means the phone.

```sh
supabase start
ipconfig getifaddr en0                # if changed, update .env.development
pnpm exec expo run:android --device   # builds, installs, starts Metro
pnpm web                              # separate terminal
```

## IP

Kong (`0.0.0.0:54321`) and Metro (`0.0.0.0:8081`) already bind all interfaces —
nothing to configure. Verify from the Mac, then from the phone's browser:

```sh
IP=$(ipconfig getifaddr en0)
curl -s "http://$IP:54321/rest/v1/products"   # -> 42501 permission denied
curl -s "http://$IP:8081/status"              # -> packager-status:running
```

Phone can't reach what the Mac can → AP isolation, macOS firewall, or a VPN on
the Mac. The IP is a DHCP lease; re-check it each session.

## Env

`.env.development` (gitignored) mirrors `.example.env.development` (committed) —
keep them in sync. `EXPO_PUBLIC_SUPABASE_URL` is the LAN IP, not localhost.
`VITEST_*` can stay on 127.0.0.1; the prefix is what keeps the service-role key
out of the bundle.

`EXPO_PUBLIC_*` is inlined at bundle time, so changing the IP means
`expo start --dev-client --clear`, not a reload. Any new template file must be
`.example.env.*`-prefixed, never `.env.*.example` (metro-config sweeps root
`.env*` into the graph; see ticket 1).

## Android over USB

Dev build, not Expo Go. Local only — no `eas.json`.

Phone: Build number tapped 7× → Developer options → USB debugging, a data cable,
and accept the RSA dialog. Gate is `adb devices -l` showing `device` —
`unauthorized` means the dialog is unanswered, empty means no ADB interface. The
Expo picker lists un-booted emulators too, so an emulator-only picker is
consistent with an empty adb list, not proof of a connection. To check the cable
itself: `ioreg -p IOUSB -w0 -l | grep idProduct` — under vendor `0x18D1`,
`0x4EE1` is MTP-only/no ADB, `0x4EE2`/`0x4EE7` have ADB. (`system_profiler`
returns nothing under a sandboxed shell.)

First build is ~4 GB and several minutes. After that, JS changes need only
`pnpm exec expo start --dev-client`; rebuild only for native deps or `app.json`
plugin/android changes.

Plain `http://` works on device because prebuild writes
`usesCleartextTraffic="true"` into `android/app/src/debug/AndroidManifest.xml` —
debug variant only.

## Metro fallbacks

`run:android` starts Metro in LAN mode. If Wi-Fi is unusable:

```sh
adb reverse tcp:8081 tcp:8081    # Metro only; Supabase needs its own forward
adb reverse tcp:54321 tcp:54321  # + URL -> http://localhost:54321, rebundle
```

Last resort (or phone on cellular): `expo start --dev-client --tunnel` plus
`ngrok http 54321 --host-header=rewrite`. Both flags matter, and
`src/lib/supabase.ts` already sends `ngrok-skip-browser-warning` to dodge the
free-tier interstitial.

## Success

All three clients show the same payload:

```json
{ "code": "42501", "message": "permission denied for table products" }
```

The error is the pass — it reached Kong → PostgREST → Postgres and failed only on
authorization. `anon` has no grants until ticket 2. Only a network failure (no
response, or the `network error` label) is a real failure.
