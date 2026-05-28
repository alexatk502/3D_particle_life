use wasm_bindgen::prelude::*;

pub const NUM_TYPES: usize = 10;

struct Rng(u64);
impl Rng {
    fn new(seed: u64) -> Self { Self(seed.wrapping_mul(6364136223846793005).wrapping_add(1)) }
    fn next_u32(&mut self) -> u32 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.0 >> 32) as u32
    }
    fn f32(&mut self) -> f32 { (self.next_u32() as f32) / (u32::MAX as f32 + 1.0) }
    fn range(&mut self, lo: f32, hi: f32) -> f32 { lo + self.f32() * (hi - lo) }
}

#[wasm_bindgen]
pub struct Simulation {
    dims: usize,
    box_size: f32,
    n: usize,
    pos: Vec<f32>,
    vel: Vec<f32>,
    kind: Vec<u8>,
    matrix: [f32; NUM_TYPES * NUM_TYPES],

    r_max: f32,
    beta: f32,
    force_scale: f32,
    repulsion_scale: f32,
    friction: f32,
    dt: f32,

    // cell-list scratch (reused, no per-step alloc)
    cells_per_axis: u32,
    cell_size: f32,
    cell_of: Vec<u32>,       // n
    cell_count: Vec<u32>,    // num_cells
    cell_start: Vec<u32>,    // num_cells + 1
    sorted_idx: Vec<u32>,    // n — original id at sorted position k
    sorted_pos: Vec<f32>,    // n * d
    sorted_kind: Vec<u8>,    // n
    sorted_acc: Vec<f32>,    // n * d

    // --- SPH (mini 1): density via Poly6 kernel, h = r_max for now ---
    mass: f32,
    density: Vec<f32>,           // n, original order — exposed to JS
    sorted_density: Vec<f32>,    // n, scratch in sorted order
}

#[wasm_bindgen]
impl Simulation {
    #[wasm_bindgen(constructor)]
    pub fn new(dims: usize, n: usize, box_size: f32, seed: u64) -> Simulation {
        let mut rng = Rng::new(seed);
        let dims = if dims == 3 { 3 } else { 2 };
        let mut pos = vec![0.0_f32; n * dims];
        let mut vel = vec![0.0_f32; n * dims];
        let mut kind = vec![0_u8; n];

        for i in 0..n {
            for d in 0..dims { pos[i * dims + d] = rng.range(0.0, box_size); }
            for d in 0..dims { vel[i * dims + d] = rng.range(-0.5, 0.5); }
            kind[i] = (rng.next_u32() as usize % NUM_TYPES) as u8;
        }
        zero_momentum(&mut vel, dims, n);

        let mut matrix = [0.0_f32; NUM_TYPES * NUM_TYPES];
        for v in matrix.iter_mut() { *v = rng.range(-1.0, 1.0); }

        Simulation {
            dims, box_size, n, pos, vel, kind, matrix,
            r_max: 60.0,
            beta: 0.3,
            force_scale: 80.0,
            repulsion_scale: 200.0,
            friction: 0.85,
            dt: 0.02,
            cells_per_axis: 0,
            cell_size: 0.0,
            cell_of: Vec::new(),
            cell_count: Vec::new(),
            cell_start: Vec::new(),
            sorted_idx: Vec::new(),
            sorted_pos: Vec::new(),
            sorted_kind: Vec::new(),
            sorted_acc: Vec::new(),
            mass: 1.0,
            density: Vec::new(),
            sorted_density: Vec::new(),
        }
    }

    pub fn step(&mut self) {
        let d = self.dims;
        let n = self.n;
        if n == 0 { return; }
        let bs = self.box_size;
        let half = 0.5 * bs;
        let r_max = self.r_max;
        let r_max2 = r_max * r_max;
        let beta = self.beta;
        let force_scale = self.force_scale;
        let repulsion_scale = self.repulsion_scale;

        // Grid: cell side = r_max, but force >=3 cells/axis so neighbor-3x3 doesn't
        // duplicate cells under wrap.
        let cpa_f = (bs / r_max).floor().max(3.0);
        let cpa = cpa_f as usize;
        let cpa_u = cpa as u32;
        let cell_size = bs / cpa_f;
        let num_cells = if d == 3 { cpa * cpa * cpa } else { cpa * cpa };
        self.cells_per_axis = cpa_u;
        self.cell_size = cell_size;

        // (re)size buffers
        if self.cell_count.len() != num_cells {
            self.cell_count.resize(num_cells, 0);
            self.cell_start.resize(num_cells + 1, 0);
        }
        if self.cell_of.len() != n {
            self.cell_of.resize(n, 0);
            self.sorted_idx.resize(n, 0);
            self.sorted_pos.resize(n * d, 0.0);
            self.sorted_kind.resize(n, 0);
            self.sorted_acc.resize(n * d, 0.0);
            self.density.resize(n, 0.0);
            self.sorted_density.resize(n, 0.0);
        }
        for c in self.cell_count.iter_mut() { *c = 0; }

        // 1) cell id per particle + count
        let inv_cs = 1.0 / cell_size;
        for i in 0..n {
            let mut c = 0u32;
            for k in 0..d {
                let mut cc = (self.pos[i * d + k] * inv_cs) as i32;
                if cc < 0 { cc = 0; }
                if cc >= cpa as i32 { cc = cpa as i32 - 1; }
                c = c * cpa_u + cc as u32;
            }
            self.cell_of[i] = c;
            self.cell_count[c as usize] += 1;
        }

        // 2) prefix sums -> cell_start
        let mut sum = 0u32;
        for c in 0..num_cells {
            self.cell_start[c] = sum;
            sum += self.cell_count[c];
        }
        self.cell_start[num_cells] = sum;

        // 3) scatter (reuse cell_count as write cursor)
        for c in self.cell_count.iter_mut() { *c = 0; }
        for i in 0..n {
            let c = self.cell_of[i] as usize;
            let pos_in_sort = (self.cell_start[c] + self.cell_count[c]) as usize;
            self.sorted_idx[pos_in_sort] = i as u32;
            self.cell_count[c] += 1;
        }

        // 4) gather sorted scratch for cache-friendly inner loop
        for k in 0..n {
            let i = self.sorted_idx[k] as usize;
            for dim in 0..d { self.sorted_pos[k * d + dim] = self.pos[i * d + dim]; }
            self.sorted_kind[k] = self.kind[i];
        }
        for a in self.sorted_acc.iter_mut() { *a = 0.0; }

        // 5) force loop — sorted order, only own cell + immediate neighbors
        let cpa_i = cpa as i32;
        let dz_lo = if d == 3 { -1i32 } else { 0 };
        let dz_hi = if d == 3 {  1i32 } else { 0 };

        // SPH (Poly6) constants. We use h = r_max so the kernel cutoff matches the
        // cell-list cutoff; no extra neighbor work.
        let h2 = r_max2;
        let h6 = h2 * h2 * h2;
        let pi = core::f32::consts::PI;
        let poly6_const: f32 = if d == 3 {
            // 315 / (64 π h^9)
            315.0 / (64.0 * pi * h6 * r_max * r_max * r_max)
        } else {
            // 4 / (π h^8)
            4.0 / (pi * h6 * h2)
        };
        let mass = self.mass;

        for k in 0..n {
            // unpack cell coords from packed id (recompute is cheaper than storing 3 u32 per particle)
            let mut c = self.cell_of[self.sorted_idx[k] as usize];
            let mz = if d == 3 { let v = (c % cpa_u) as i32; c /= cpa_u; v } else { 0 };
            let my = { let v = (c % cpa_u) as i32; c /= cpa_u; v };
            let mx = (c % cpa_u) as i32;

            let ki = self.sorted_kind[k] as usize;
            let px = self.sorted_pos[k * d];
            let py = self.sorted_pos[k * d + 1];
            let pz = if d == 3 { self.sorted_pos[k * d + 2] } else { 0.0 };
            let row = ki * NUM_TYPES;

            let mut ax = 0.0_f32;
            let mut ay = 0.0_f32;
            let mut az = 0.0_f32;
            let mut density_acc = 0.0_f32; // Σ (h² - r²)³ over pairs within h

            for dz in dz_lo..=dz_hi {
                let ncz = rem_pos(mz + dz, cpa_i) as u32;
                for dy in -1..=1 {
                    let ncy = rem_pos(my + dy, cpa_i) as u32;
                    for dx in -1..=1 {
                        let ncx = rem_pos(mx + dx, cpa_i) as u32;
                        let cell_idx = if d == 3 {
                            ((ncx * cpa_u) + ncy) * cpa_u + ncz
                        } else {
                            ncx * cpa_u + ncy
                        } as usize;

                        let start = self.cell_start[cell_idx] as usize;
                        let end   = self.cell_start[cell_idx + 1] as usize;

                        for s in start..end {
                            if s == k { continue; }
                            let qx = self.sorted_pos[s * d];
                            let qy = self.sorted_pos[s * d + 1];
                            let mut ddx = qx - px;
                            let mut ddy = qy - py;
                            if ddx >  half { ddx -= bs; } else if ddx < -half { ddx += bs; }
                            if ddy >  half { ddy -= bs; } else if ddy < -half { ddy += bs; }
                            let mut r2 = ddx * ddx + ddy * ddy;
                            let mut ddz = 0.0_f32;
                            if d == 3 {
                                let qz = self.sorted_pos[s * d + 2];
                                ddz = qz - pz;
                                if ddz >  half { ddz -= bs; } else if ddz < -half { ddz += bs; }
                                r2 += ddz * ddz;
                            }
                            if r2 >= r_max2 || r2 == 0.0 { continue; }

                            // SPH density kernel (Poly6): pair contribution (h² - r²)³.
                            let h2_minus_r2 = r_max2 - r2;
                            density_acc += h2_minus_r2 * h2_minus_r2 * h2_minus_r2;

                            let r = r2.sqrt();
                            let inv_r = 1.0 / r;
                            let rn = r / r_max;

                            let f_mag = if rn < beta {
                                -repulsion_scale * (1.0 - rn / beta)
                            } else {
                                let kj = self.sorted_kind[s] as usize;
                                let a = self.matrix[row + kj];
                                let f = 1.0 - ((2.0 * rn - 1.0 - beta) / (1.0 - beta)).abs();
                                force_scale * a * f
                            };

                            let coef = f_mag * inv_r;
                            ax += coef * ddx;
                            ay += coef * ddy;
                            if d == 3 { az += coef * ddz; }
                        }
                    }
                }
            }
            self.sorted_acc[k * d]     = ax;
            self.sorted_acc[k * d + 1] = ay;
            if d == 3 { self.sorted_acc[k * d + 2] = az; }
            // Density: pair sum + self contribution W(0,h) = h^6, then normalize.
            self.sorted_density[k] = (density_acc + h6) * poly6_const * mass;
        }

        // 6) integrate velocities (unsort via sorted_idx); also unsort density.
        let dt = self.dt;
        let fric = self.friction;
        for k in 0..n {
            let i = self.sorted_idx[k] as usize;
            for dim in 0..d {
                self.vel[i * d + dim] = self.vel[i * d + dim] * fric + self.sorted_acc[k * d + dim] * dt;
            }
            self.density[i] = self.sorted_density[k];
        }
        zero_momentum(&mut self.vel, d, n);

        // 7) advect + wrap
        for i in 0..n * d {
            let mut p = self.pos[i] + self.vel[i] * dt;
            if p < 0.0 { p += bs; }
            if p >= bs { p -= bs; }
            self.pos[i] = p;
        }
    }

    // accessors
    pub fn positions_ptr(&self) -> *const f32 { self.pos.as_ptr() }
    pub fn velocities_ptr(&self) -> *const f32 { self.vel.as_ptr() }
    pub fn kinds_ptr(&self) -> *const u8 { self.kind.as_ptr() }
    pub fn matrix_ptr(&self) -> *const f32 { self.matrix.as_ptr() }
    pub fn n(&self) -> usize { self.n }
    pub fn dims(&self) -> usize { self.dims }
    pub fn box_size(&self) -> f32 { self.box_size }
    pub fn num_types(&self) -> usize { NUM_TYPES }
    pub fn cells_per_axis(&self) -> u32 { self.cells_per_axis }

    pub fn set_matrix_entry(&mut self, i: usize, j: usize, v: f32) {
        if i < NUM_TYPES && j < NUM_TYPES { self.matrix[i * NUM_TYPES + j] = v; }
    }
    pub fn randomize_matrix(&mut self, seed: u64) {
        let mut rng = Rng::new(seed);
        for v in self.matrix.iter_mut() { *v = rng.range(-1.0, 1.0); }
    }
    pub fn set_friction(&mut self, v: f32) { self.friction = v.clamp(0.0, 1.0); }
    pub fn set_force_scale(&mut self, v: f32) { self.force_scale = v; }
    pub fn set_r_max(&mut self, v: f32) { self.r_max = v.max(1.0); }
    pub fn set_dt(&mut self, v: f32) { self.dt = v.max(0.0); }

    // SPH (mini 1) accessors
    pub fn density_ptr(&self) -> *const f32 { self.density.as_ptr() }
    pub fn set_mass(&mut self, v: f32) { self.mass = v.max(0.0); }
    pub fn mean_density(&self) -> f32 {
        if self.n == 0 { return 0.0; }
        let mut s = 0.0_f64;
        for v in &self.density { s += *v as f64; }
        (s / self.n as f64) as f32
    }

    pub fn total_momentum(&self) -> f32 {
        let d = self.dims;
        let mut s = [0.0_f32; 3];
        for i in 0..self.n {
            for k in 0..d { s[k] += self.vel[i * d + k]; }
        }
        (s[0] * s[0] + s[1] * s[1] + s[2] * s[2]).sqrt()
    }
}

#[inline(always)]
fn rem_pos(a: i32, m: i32) -> i32 {
    let r = a % m;
    if r < 0 { r + m } else { r }
}

fn zero_momentum(vel: &mut [f32], d: usize, n: usize) {
    if n == 0 { return; }
    let mut mean = [0.0_f64; 3];
    for i in 0..n {
        for k in 0..d { mean[k] += vel[i * d + k] as f64; }
    }
    for k in 0..d { mean[k] /= n as f64; }
    for i in 0..n {
        for k in 0..d { vel[i * d + k] -= mean[k] as f32; }
    }
}
