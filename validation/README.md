# Albino 2D comparison

This is an exploratory diagnostic, not a validation pass. The committed JSON contains the exact options and SHA-256 of the engine used.

| Condition | Initial number-mean separation | Rested separation | Change | Published experimental separation |
| --- | ---: | ---: | ---: | ---: |
| Test 7: 15 Hz, 1.0 mm | 0.770 mm | 0.817 mm | +0.047 mm | -0.4 mm |
| Test 8: 15 Hz, 1.5 mm | 0.770 mm | 1.809 mm | +1.039 mm | +4.1 mm |

Both runs use seed 87413, 250 small and 20 large disks in a 9 x 100 mm sealed 2D cell, stochastic initialization, published size bounds sampled uniformly, friction tan(25 degrees), Hertz–Mindlin with beta_n=beta_s=0, 1 s initial settling, 10 s shaking and 0.5 s resting. Density is 2500 kg/m3, Poisson ratio 0.16, and disk thickness 4 mm. The timestep uses 0.04/sqrt(max contact frequency squared), bounded additionally by the Hertz collision duration and frequency.

Young's modulus is 63 MPa here, 1000 times smaller than the paper's 63 GPa. This enables an exploratory comparison but changes the contact deformation and dynamics. Test 7 stays nearly unchanged and test 8 develops some segregation. The quantitative test 8 result is substantially below the published experimental 4.1 mm and 3D DEM approximately 5.3 mm.

The 20/250 slice has 43.14% coarse mass, not the paper's 1/3 coarse mass; its uniform diameter intervals are not the measured PSD. Walls have the same material properties and friction as grains as an explicit assumption. These planar disk contacts cannot reproduce the out-of-plane pathways in the published 3D bed. The original scripts should also resolve whether the reported 10 s includes settling and resting. A quantitative comparison requires a declared 2D calibration/validation protocol, multiple seeds, and stiffness/timestep convergence. The measured contrast above does not establish those requirements.

Reproduce the saved run with:

```
node archive/bne-2d/bne-validation.js --modulus=63000000 --seeds=87413 --normal=0 --shear=0 --output=/tmp/bne-albino-2d-comparison.json
```

For a five-seed comparison at paper stiffness, omit the modulus and seeds arguments; this is computationally expensive. Neither the script nor the UI declares the model validated automatically.

Sources: [Albino et al.](https://doi.org/10.1016/j.actaastro.2025.11.073), Tables 1–5 and Fig. 9; [PFC Hertz model](https://docs.itascacg.com/pfc700/common/contactmodel/hertz/doc/manual/cmhertz.html).

## Unity 3D containment regression

`bne-unity-paper-containment.json` records the reproduced numerical failure and corrected full-duration paper presets. Both corrected runs use 4,070 spheres, 2 s settling, 10 s shaking and 0.5 s resting, at a balanced step of 1/3600 s. Both retained every grain. Rested RMS speeds were 1.77 and 1.98 mm/s; final floor penetration was below 0.000005 mm. Maximum transient floor penetration was 0.038 mm; maximum side penetration was 0.101 mm. This verifies the declared containment/rest limits for these runs, not scientific agreement with Albino et al. See the Unity project README for solver settings and reproduction commands. Full samples remain expensive (13–17 minutes per Editor run on this machine).

## Interactive startup and CoM checks

`bne-unity-interactive-performance.json` records the supported-bed/native-material implementation: quick 270-grain and paper-size 610-grain examples for their complete 3 s shaking duration, and both full 4,070-grain presets for 10 s. All completed within the declared containment limits; the CoM was checked against a direct mass-weighted calculation. The 270/610 beds were ready in 0.10/0.19 s in Editor. Complete runs (including 0.12 s relaxation and 0.5 s resting) took 3.21/6.81 s. Full samples remained expensive, taking 323/414 s in this diagnostic. These are instrumented Editor timings, not promised browser rates. The 610-grain sample is a shallower demonstration using the paper's size bounds; it is not the full experimental bed.

`bne-interactive-before-native-friction.json` preserves the earlier supported-bed timing baseline. Native materials remove the per-contact callback and simplify the friction implementation; these Editor measurements do not demonstrate an additional speed improvement from that change.
