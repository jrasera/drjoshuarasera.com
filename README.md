# drjoshuarasera.com

Static website for Dr Joshua Rasera. Preview locally:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

## Pages and identity

- `research.html`: mineral processing overview.
- `mineral-enrichment.html`: electrostatic separation and dry beneficiation.
- `size-classification.html#bne`: experimental context and the embedded 3D intruder applet.
- `strategic-engineering.html#value-chain`: illustrative resource value-chain DCF comparison.
- `about.html`, `publications.html`, `consulting.html`, `notes.html`, `contact.html`: supporting pages.

The shared appearance is in `style.css`. Header/footer markup is repeated across pages. The approved identity is in `assets/identity`: the humanist **Dr Joshua Rasera** wordmark, mineral-specimen banner icon, and JR footer monogram. The J forms the sole upright of the monogram; the R contributes its bowl and leg. The root `favicon.svg` uses this JR. Fonts are hosted in `assets/fonts` with their OFL licences. `research-routing.js` preserves older research anchors.

## Applets

### Electrostatic separation

`electrostatics-engine.js` computes SI-unit grain trajectories; `research.js` provides playback and the force inspector. `electrostatics-collectors.js` supplies a separate illustrative display bed. Display settling remains separate from flight and mass accounting. Charge distributions and apparatus dimensions are illustrative; the page exposes assumptions and sources.

### Granular segregation

The production WebGL player is `applets/bne-3d/`, embedded by `bne-embed.js` and `bne-embed.css`. The Unity source, build instructions and verification record are in `unity/BNE3D`. The public interface offers a buried intruder, its matched unshaken control, and adjustable intruder settings. Paper and mixture configurations remain in source for investigation.

The plot defaults to cycle-mean class CoM heights relative to the moving container base. Instantaneous values and raw exported history remain available. The model is exploratory: rise magnitudes depend on numerical settings and do not constitute validation against published experiments. Mobile touch interaction remains an open check.

### Value-chain DCF

`value-chain-engine.js` compares three synthetic extraction–processing–delivery configurations. Saleable output is constrained by feed availability, processing capacity, delivery capacity and demand. `strategic-engineering.js` renders charts, comparisons, annual tables and CSV downloads; `value-chain.css` styles the applet.

Investment occurs at year zero; annual operating cash flows occur at year-end for the chosen operating life, beginning in the selected first operating year. All monetary inputs are constant-purchasing-power USD, pre-tax and unlevered. Yield is saleable mass fraction, not mineral recovery from a specified feed grade. Production throttles to avoid unsold output. Taxes, financing, working capital, replacement investment and closure costs are omitted. This compares three configurations; it does not optimise all possible chains or reproduce the ESA model.

## Checks

```sh
node --test electrostatics.test.js electrostatics-inspection.test.js value-chain.test.js
node --test archive/bne-2d/bne.test.js archive/bne-2d/bne-interface.test.js
node tools/check-site.js
python3 unity/BNE3D/Tools/api-check.py
```

The Unity API check compiles C# only. Runtime physics, shaders and browser checks are documented separately in `unity/BNE3D/verification-status.json`. Validation reports are preserved in `validation/`. Retired 2D code and identity proof materials are in `archive/`; the main pages do not link to them.

## Publishing

GitHub Pages publishes the root of `main` at **https://drjoshuarasera.com/**. Pushes to `main` trigger deployment. `CNAME` and `.nojekyll` are intentional. The Unity build uses gzip with decompression fallback, supporting static hosting without custom compression headers. Generated Unity caches, local builds, editor logs and OS metadata are excluded by `.gitignore`.
