# Retired 2D BNE experiment

Preserved for research and regression work. The public site uses the 3D Unity intruder applet instead. The UI tests use a mock DOM; they no longer inspect the current size-classification page. Run from the repository root:

```sh
node --test archive/bne-2d/bne.test.js archive/bne-2d/bne-interface.test.js
```

The BNE workbench uses bne-engine.js for rotating soft-disk DEM, bne-worker.js for background integration, bne.js for controls/visualization and bne.css for its layout. Run node --test bne.test.js bne-interface.test.js for contact, frame acceleration and stability checks. Single-intruder and mixed-size modes use the same physical laws with no prescribed rise; results compare mass-weighted centre heights. The 2D contact parameters are illustrative and omit aerodynamic forces.

BNE controls span diameter ratios 1–10, frequencies 0–150 Hz, cell widths 9–240 mm and heights 60–300 mm. Grain and wall friction are independent. The default single-intruder example uses 50 Hz, 1.5 mm peak amplitude and 5 s; changing cell size preserves particle count and therefore changes filling depth.

Mixture mode uses independent uniform diameter intervals (default 0.8–1.0 and 1.2–1.4 mm), 1,000 small plus 600 large grains, with up to 5,000 particles overall. Initialization is stochastic non-overlapping sampling or a strict generated large-below-small layer followed by gravity settling. Sample/cell settings use an overlay. Paper-size reference bounds are 0.5–0.75 and 1.7–2.1 mm (Albino et al., doi:10.1016/j.actaastro.2025.11.073); this is not a reconstruction of its 3D model or measured PSD. Sparse contact records and spatial neighbour lookup replace the quadratic storage/search. Elastic contacts remain available; mixture mode also offers faster rigid contacts with adaptive stepping, impulse restitution/friction, rotation, and split positional correction.


The Albino reference buttons load test 7 (15 Hz, 1.0 mm) and test 8 (15 Hz, 1.5 mm), 9 mm width and 100 mm height, 0.5–0.75 / 1.7–2.1 mm size bounds, friction tan(25 degrees), and the user's 250-small/20-large planar slice. They select Hertz–Mindlin and the paper's 63 GPa modulus, Poisson ratio 0.16, density 2500 kg/m3. Wall friction is provisionally set equal to grain friction. Normal and shear damping ratios are separate direct inputs (both default zero); Hertz never uses the restitution control. Zero damping is the PFC default, not a recovered Albino calibration value. The default 63 MPa value when manually choosing Hertz is an explicitly reduced-stiffness exploratory setting, not glass.

The contact implementation follows the PFC Hertz force law with alpha_h=1.5, alpha_d=0, unloading shear-force rescaling, and no-tension/slip-cut dashpots. A critical damping ratio is not a vial damping coefficient: the vial follows full harmonic motion from a turning point, regardless of particle damping. Canvas framing includes its full 2A stroke. The solver retains disk mass rho*pi*r^2*4mm and inertia 0.5*m*r^2, and constrains all centers to a plane; it is not a 3D sphere simulation or PFC itself. Hertz timesteps resolve the current contact frequency and impending collision duration; increasing stiffness substantially increases runtime. Initial gravity settling lasts at least 1 s and can extend to 3 s for stability; 0.5 s of rest follows the selected shaking duration. Duration in the UI is shaking time, not total settling-plus-shaking-plus-rest time. The paper's statement of 10 s total simulation time should be reconciled with its original scripts before a strict time-history replication.

Validation remains open. The published experimental number-mean large-minus-small heights are -0.4 mm (test 7) and +4.1 mm (test 8); the paper's 3D DEM test 8 is approximately +5.3 mm. Published experimental large-particle shares above 1/4, 1/2, 3/4 of bed height are 69/44/24 percent (test 7) and 77/61/39 percent (test 8); DEM shares are 73/44/26 and 89/81/49 percent. The interface reports number means and count fractions alongside its existing mass-weighted metric. A 20/250 slice with uniform diameter bounds does not preserve the paper's 1B/2S mass composition or its measured PSD. A match in one run is not validation: compare both amplitudes over five seeds, then check timestep and stiffness convergence. Do not silently fit parameters or report the applet as validated.

Sources: Albino et al., doi:10.1016/j.actaastro.2025.11.073, sections 2.2–4.2 and Tables 1–5; https://docs.itascacg.com/pfc700/common/contactmodel/hertz/doc/manual/cmhertz.html.

Run `node bne-validation.js --modulus=63000000000 --seeds=87413,87540,87667,87794,87921 --normal=0 --shear=0 --output=/tmp/bne-albino-comparison.json` for the paired five-seed comparison. It checkpoints each completed run, reports the paper targets and model assumptions, and deliberately does not declare validation from a single numerical match. Full glass stiffness is computationally expensive. Use a lower modulus only as an explicitly labelled exploratory or convergence run.

The browser workbench now selects Hertz–Mindlin by default in both modes; engine defaults remain backward-compatible for callers that omit solver.
