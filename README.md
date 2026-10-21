# drjoshuarasera.com
Personal website for Dr Joshua Rasera.

Static HTML, CSS and JavaScript; no installation or build step.
Preview: python3 -m http.server 8765 --bind 127.0.0.1

Research content:
- research.html: mineral processing overview
- mineral-enrichment.html: charging, separation and terrestrial dry beneficiation
- size-classification.html: vibration study and Brazil nut effect

Shared appearance is in style.css; the header/footer markup is repeated across pages.
assets/jr-mark.svg is the reusable identity mark; favicon.svg is the browser icon.
research-routing.js preserves old research-page anchors.

The electrostatics experiment uses electrostatics-engine.js for SI-unit grain trajectories and research.js for playback and controls; electrostatics.css styles this applet. Validate the model with node --test electrostatics.test.js electrostatics-inspection.test.js. electrostatics-collectors.js supplies the separate, display-scale contact bed. The inspector follows a persistent grain and exposes electric force, x/y drag, weight and buoyancy; use the scrubber, 5 ms steps, or 1/100–1/50 playback for close inspection. Charge distributions and apparatus dimensions are illustrative; the applet explains its assumptions and sources in its expandable model notes. The vibration and investment applets are unchanged.
