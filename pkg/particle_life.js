/* @ts-self-types="./particle_life.d.ts" */

export class Simulation {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SimulationFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_simulation_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    box_size() {
        const ret = wasm.simulation_box_size(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    cells_per_axis() {
        const ret = wasm.simulation_cells_per_axis(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    dims() {
        const ret = wasm.simulation_dims(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    kinds_ptr() {
        const ret = wasm.simulation_kinds_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    matrix_ptr() {
        const ret = wasm.simulation_matrix_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    n() {
        const ret = wasm.simulation_n(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} dims
     * @param {number} n
     * @param {number} box_size
     * @param {bigint} seed
     */
    constructor(dims, n, box_size, seed) {
        const ret = wasm.simulation_new(dims, n, box_size, seed);
        this.__wbg_ptr = ret;
        SimulationFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    num_types() {
        const ret = wasm.simulation_num_types(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    positions_ptr() {
        const ret = wasm.simulation_positions_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {bigint} seed
     */
    randomize_matrix(seed) {
        wasm.simulation_randomize_matrix(this.__wbg_ptr, seed);
    }
    /**
     * @param {number} v
     */
    set_dt(v) {
        wasm.simulation_set_dt(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set_force_scale(v) {
        wasm.simulation_set_force_scale(this.__wbg_ptr, v);
    }
    /**
     * @param {number} v
     */
    set_friction(v) {
        wasm.simulation_set_friction(this.__wbg_ptr, v);
    }
    /**
     * @param {number} i
     * @param {number} j
     * @param {number} v
     */
    set_matrix_entry(i, j, v) {
        wasm.simulation_set_matrix_entry(this.__wbg_ptr, i, j, v);
    }
    /**
     * @param {number} v
     */
    set_r_max(v) {
        wasm.simulation_set_r_max(this.__wbg_ptr, v);
    }
    step() {
        wasm.simulation_step(this.__wbg_ptr);
    }
    /**
     * @returns {number}
     */
    total_momentum() {
        const ret = wasm.simulation_total_momentum(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    velocities_ptr() {
        const ret = wasm.simulation_velocities_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
}
if (Symbol.dispose) Simulation.prototype[Symbol.dispose] = Simulation.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_1506f2235d1bdba0: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./particle_life_bg.js": import0,
    };
}

const SimulationFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_simulation_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('particle_life_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
