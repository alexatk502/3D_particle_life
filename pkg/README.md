# 3D Particle Life

Particle Life clone in Rust + WASM. 10 particle types, asymmetric interaction matrix,
periodic-box physics with **strictly conserved zero total momentum**.

## Run

```bash
wasm-pack build --target web --release
python3 -m http.server 8000   # or any static server
# open http://localhost:8000
```

## Physics

- **Force model**: classic piecewise-linear particle-life force. Below `r_min = beta * r_max`
  particles feel a strong symmetric repulsion (prevents overlap). Between `r_min` and `r_max`
  the matrix entry `M[ki][kj]` drives attraction/repulsion. Beyond `r_max`, no interaction.
- **Boundaries**: periodic (toroidal). Walls don't inject momentum.
- **Zero-momentum invariant**: the matrix is asymmetric, so pairwise forces are not
  Newton-3rd-law-symmetric. Each step we subtract the mean velocity from every particle,
  which is a Galilean transform — it doesn't change relative dynamics but pins Σv = 0
  exactly. The `|Σv|` readout in the panel stays at machine epsilon.
- **Damping**: multiplicative (`v *= friction`). Scales all velocities equally, so the
  zero-momentum invariant is preserved.

## 2D → 3D

Switch `DIMS = 2` to `DIMS = 3` in `main.js`. The Rust core (`src/lib.rs`) already runs
N-dim — positions/velocities are flat `Vec<f32>` with stride `dims`, the pair loop
uses minimum-image displacement in all `dims` axes. Only the renderer is 2D; for 3D
you'd project the z-component (depth-shading or a WebGL renderer).
