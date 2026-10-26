# BNE 3D — Unity prototype

**Current state (23 October 2026):** Unity licensing, Editor physics checks, shader compilation and the WebGL build pass. The browser interface uses native HTML controls in a compact sidebar, with direct Unity messages and live state updates. Safari checks confirmed play/pause, fit-bed, cutaway and class visibility. Firefox checks confirmed editing and applying a 0.5 s experiment, completion, live results and JSON download. The default is a centred, initially buried 3 mm intruder under 400 approximately 1 mm spheres (20 Hz, 1.5 mm peak amplitude, 3 s), displayed in cutaway at device pixel ratio 1. The model remains illustrative; scientific validation and mobile interaction checks remain open. The production player is embedded in the main site; publication checks are recorded in `verification-status.json`.

A browser-targeted, three-dimensional rigid-body granular experiment for drjoshuarasera.com. Target: Unity 6000.3.10f1 (6.3 LTS), built-in renderer and PhysX. No third-party assets or runtime packages are required.

Open this folder in Unity Hub and press Play in any scene. Runtime initialization creates the complete workbench. Use the BNE menu to configure/build the project or run the physics checks. The existing 2D site stays available until the Unity build has passed checks.

## Controls

- The default is a head-on orthographic view. Head-on restores it after orbiting; drag to orbit, scroll/pinch to zoom. Space pauses/resumes, F fits the bed and C toggles the cutaway.
- Browser sample settings and results live in the sidebar. Opening sample settings pauses an active experiment. A permanent plot shows the mass-weighted large/small centres of mass versus elapsed time since shaking began, including final resting, measured above the moving floor. Number-mean results are retained separately.
- Generated initial beds are seeded and non-overlapping. The default uses randomized ballistic deposition into a supported bed, followed by 0.12 s gravity relaxation; it avoids dropping a loose cloud for 2 simulated seconds. Mixed and strictly large-below-small generation are available. The loose-cloud path remains available through `compact=false` for the original regression. New arrangement changes the seed.
- Single intruder or independently sampled large/small size bounds and counts (up to 5,000 spheres), vial diameter/height, frequency/amplitude/duration, independent grain/wall friction, contact bounce and density ratio.
- Fit bed automatically reframes after settling. Full vial, cutaway and hiding the small fraction only change rendering; all spheres remain in the physics.

## Model and units

Unity PhysX rigid-body spheres interact with a 48-facet cylindrical compound collider and sealed end caps. The vial is kinematic; its full prescribed sinusoidal stroke is imposed through MovePosition for every manual physics substep. A starts at a turning point: y=A(cos(2πft)-1), initial velocity zero. The camera remains lab-fixed and does not cancel the vial motion. Gravity acts in the lab frame; no fictitious acceleration is added.

Length units are millimetres, time seconds and body masses milligrams, with density 2500 kg/m3 and spherical mass 4πr³ρ/3. Uniform length/mass conversion preserves the equations while keeping millimetre-sized objects away from tiny Unity coordinates. Linear/angular damping are zero: there is no aerodynamic drag. Surface friction and configurable contact bounce dissipate energy. Grain materials use Average combination; wall materials use Minimum or Maximum, selected according to the requested coefficient. Wall combination has higher priority, so grain/grain contacts receive the grain coefficient and grain/wall contacts receive the wall coefficient. This avoids per-contact managed callbacks. See https://docs.unity3d.com/6000.0/Documentation/ScriptReference/PhysicsMaterialCombine.html.

The default interactive physics step is min(1/600 s, 1/(60f)), with speculative CCD and 12/4 contact iterations. The balanced physics step is min(1/2400 s, 1/(240f)); at 15 Hz this is 1/3600 s. Fast/finer modes change this resolution. In balanced/finer modes, grains use sweep-based Continuous Dynamic CCD; the kinematic vial uses Continuous Speculative CCD. The temporal Gauss–Seidel solver uses 24 position and 8 velocity iterations. Contact margins are 0.01 mm and maximum overlap-correction speed is 10 mm/s. Five-millimetre external end caps keep the original interior floor/lid planes. These are numerical stability controls, not fitted material parameters. Physics advances within a 12 ms frame budget, so demanding cases slow the simulation clock instead of blocking input or skipping physical steps. Pause stops Physics.Simulate calls. Supported beds use 0.12 s of initial gravity relaxation; loose clouds use 2 s. A 0.5 s rest follows shaking. Every substep checks containment; a failed run stops and suppresses result/export controls. Full 4,070-sphere samples are substantially slower than the quick example.

This is an illustrative rigid-body model, not Hertz–Mindlin DEM and not a validated reproduction of Albino et al. The quick 20/250 example preserves the previous slice counts, not a 3D mass composition. The archived paper-size configurations use 10 large/600 small spheres in a shallower bed and a 3 s run, preserving an approximately 1B/2S mass ratio but not the full bed depth. Source-only full-size presets use 70 large/4000 small spheres, 9 × 100 mm, 15 Hz, 1.0 or 1.5 mm amplitude and uniform 0.5–0.75/1.7–2.1 mm size bounds. They approximate the 1B/2S composition but not the measured PSD. Results use number-mean class heights relative to the vial floor and report the actual coarse mass share. No segregation drift is prescribed.

## Build and checks

```
/Applications/Unity/Hub/Editor/6000.3.10f1/Unity.app/Contents/MacOS/Unity -batchmode -nographics -quit -projectPath "$PWD" -buildTarget WebGL -executeMethod Bne3D.Editor.BneBuild.ValidateAndBuildWeb -logFile /tmp/bne-unity-build.log
```

The default output is the site's `applets/bne-3d` directory; override with BNE_WEB_OUTPUT. Gzip plus Unity decompression fallback supports static hosting without custom compression headers. The build needs an activated Unity license. Build source is separate from the webpage; do not imply publication before deployment.

The smoke checks verify seeded non-overlapping 3D packing, cylindrical containment, strict initial layers, single-intruder count, full vial stroke, physical spherical masses, zero drag, first-action pause/resume, finite motion, and retained particles. They run a real 270-sphere experiment in Unity and save Builds/smoke-report.json. They do not assert BNE or paper agreement. Further browser QA must verify visuals, controls and actual interactive performance.

A license-independent C# API check is available with `python3 Tools/api-check.py`. It uses the installed Unity C# compiler and API references to check Editor and Web code paths; passing this does not execute physics, compile shaders or prove browser compatibility.

## Paper-preset containment regression

`Bne3D.Editor.BnePaperCheck.RunBoth` runs both 4,070-sphere presets for 2 s settling, 10 s shaking and 0.5 s resting. It records floor and side penetration at every step, final escaped-particle count, residual speeds and numerical timestep in `Builds/paper-check-7.json` and `Builds/paper-check-8.json`. These checks diagnose numerical containment and motion; they do not validate agreement with the paper. The earlier 270-sphere smoke check alone did not cover the reported failure.

## Interactive performance and CoM

`Bne3D.Editor.BneInteractiveCheck.ValidateAndBuild` checks the quick example, 610-grain paper-size example and both full-size presets, including containment and independently computed mass-weighted CoM. It records startup and end-to-end Editor timings in `Builds/interactive-report.json`, then runs the original loose-cloud smoke check and builds WebGL. Short supported-bed initialization is a different initial-condition model; previous loose-cloud numerical results are not reused as its validation. The shared lightweight sphere mesh only changes rendering; collisions remain spherical. Web state exposes at most 600 plotted history points; JSON export retains the complete history.

## Behaviour and CoM reference frame

Every instantaneous class CoM is computed as `sum(m_i * (y_i - y_floor)) / sum(m_i)`, using the actual kinematic floor position. A common translation of vial and grains leaves the result invariant; the regime scan also found zero discrepancy between commanded and actual floor displacement. A base-relative height can oscillate because the bed leaves the floor during vibration.

The default plot displays a time-weighted mean over each complete vibration cycle, evaluated from physics substeps with boundary splitting and trapezoidal integration. Points sit at cycle mid-times; initial and rested endpoints are instantaneous. Instantaneous mode and the raw exported history remain available. The analytic check cancels a periodic carrier while preserving an imposed linear trend.

The previous shallow mixtures started with the coarse fraction high in a thin bed. The new buried-intruder demo gives approximately 4.55 and 5.01 mm rise in two interactive seeds; the matched unshaken controls give effectively zero intruder rise. Balanced settings give 2.65 mm rise for the first seed. These checks establish a qualitative demonstration, while the magnitude remains sensitive to numerical settings. They do not establish quantitative accuracy. `Bne3D.Editor.BneDemoCheck.ValidateAndBuild` reproduces the checks and builds WebGL; see `validation/bne-buried-intruder-behaviour.json`.

### Main-site integration

The main size-classification page embeds the WebGL player in place of the previous 2D workbench. The public interface offers only the buried intruder and its matched unshaken control, plus custom intruder settings. Mixture and paper configuration methods remain in C# for investigation. `?embedded=1` hides the applet header and reports the required frame height to the same-origin parent. Both the template and generated HTML are updated; no physics binaries changed for this interface-only integration. Firefox verified settings application and a completed embedded control run.
