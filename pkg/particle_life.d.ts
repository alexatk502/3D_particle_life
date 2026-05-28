/* tslint:disable */
/* eslint-disable */

export class Simulation {
    free(): void;
    [Symbol.dispose](): void;
    box_size(): number;
    cells_per_axis(): number;
    density_ptr(): number;
    dims(): number;
    kinds_ptr(): number;
    matrix_ptr(): number;
    mean_density(): number;
    n(): number;
    constructor(dims: number, n: number, box_size: number, seed: bigint);
    num_types(): number;
    positions_ptr(): number;
    pressure_scale(): number;
    randomize_matrix(seed: bigint): void;
    /**
     * Reset rest density so it auto-calibrates again on the next step.
     */
    recalibrate_rest(): void;
    rest_density(): number;
    set_dt(v: number): void;
    set_force_scale(v: number): void;
    set_friction(v: number): void;
    set_mass(v: number): void;
    set_matrix_entry(i: number, j: number, v: number): void;
    set_pressure_scale(v: number): void;
    set_r_max(v: number): void;
    set_rest_density(v: number): void;
    step(): void;
    total_momentum(): number;
    velocities_ptr(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_simulation_free: (a: number, b: number) => void;
    readonly simulation_box_size: (a: number) => number;
    readonly simulation_cells_per_axis: (a: number) => number;
    readonly simulation_density_ptr: (a: number) => number;
    readonly simulation_dims: (a: number) => number;
    readonly simulation_kinds_ptr: (a: number) => number;
    readonly simulation_matrix_ptr: (a: number) => number;
    readonly simulation_mean_density: (a: number) => number;
    readonly simulation_n: (a: number) => number;
    readonly simulation_new: (a: number, b: number, c: number, d: bigint) => number;
    readonly simulation_num_types: (a: number) => number;
    readonly simulation_positions_ptr: (a: number) => number;
    readonly simulation_pressure_scale: (a: number) => number;
    readonly simulation_randomize_matrix: (a: number, b: bigint) => void;
    readonly simulation_recalibrate_rest: (a: number) => void;
    readonly simulation_rest_density: (a: number) => number;
    readonly simulation_set_dt: (a: number, b: number) => void;
    readonly simulation_set_force_scale: (a: number, b: number) => void;
    readonly simulation_set_friction: (a: number, b: number) => void;
    readonly simulation_set_mass: (a: number, b: number) => void;
    readonly simulation_set_matrix_entry: (a: number, b: number, c: number, d: number) => void;
    readonly simulation_set_pressure_scale: (a: number, b: number) => void;
    readonly simulation_set_r_max: (a: number, b: number) => void;
    readonly simulation_set_rest_density: (a: number, b: number) => void;
    readonly simulation_step: (a: number) => void;
    readonly simulation_total_momentum: (a: number) => number;
    readonly simulation_velocities_ptr: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
