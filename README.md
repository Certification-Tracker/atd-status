# ATD QAG/LOA Status

The repo and web address use the working name `atd-status`.

A read-only view of each Redbird ATD device's current FAA approval, with its LOA and QAG, for Redbird
support colleagues. Everything shown is already public on the Redbird knowledge base.

## How it's built

- **Site code** lives on `main`: `index.html`, `assets/app.js`, `assets/app.css`, the app manifest,
  service worker and icons. `app.js` is a trimmed copy of the Certification Tracker's ATD Approvals page,
  so a change to how that page looks needs making in both places.
- **Data** lives on the `data` branch: `data/devices.json` and the PDFs under `docs/`. It is built in the
  private `tracker-data` repo by `scripts/build_atd_status.py` and force-pushed here by its
  "ATD Status sync" workflow whenever ATD information changes. No history is kept on that branch.
- **Publishing:** the Deploy workflow combines `main` and `data` and publishes the site with GitHub Pages
  (Settings → Pages → Source: GitHub Actions). It runs on a push to `main` and after each sync.

Nothing flows from this repo back into `tracker-data`.
