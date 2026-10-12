# PNGScope

Inspect every last byte of a PNG, in your browser.

PNGScope opens a PNG or APNG file locally and shows:

- **Overview**: a zoomable preview with a pixel probe, dimensions, color type, bit depth, color space, transparency and any problems found.
- **Chunks**: every chunk in file order, with its offset, size and CRC-32 (recomputed and compared), and each field mapped to the bytes it comes from.
- **Metadata**: color profile, gamma, chromaticities, pixel density, text entries, Exif and time, plus a PNG chunk reference.
- **Animation**: APNG frame controls and a frame-by-frame player.
- **Hex viewer**: the whole file, colored by structure (signature, length, type, data, CRC, trailing bytes), with go-to-offset, selection and copy.

Nothing is uploaded: there is no server, and files are read with the File API and parsed in the page and a Web Worker.

PNG parsing and decoding use [format-png](https://www.npmjs.com/package/format-png).

## Development

```sh
npm install
npm run dev      # http://localhost:5173/png-scope/
npm run lint
npm run build    # outputs dist/
npm run preview  # serves dist/ at /png-scope/
```

## Deployment

`.github/workflows/deploy.yml` lints, builds and deploys `dist/` to GitHub Pages on every push to `main`.
Pull requests are built but not deployed.

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.

The site is served from `/png-scope/` (see `base` in `vite.config.ts`). If you rename the repository, update `base` too.
