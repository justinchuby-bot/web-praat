/**
 * WebGPU-accelerated FFT with automatic CPU fallback.
 *
 * Uses a parallel radix-2 Cooley-Tukey FFT compute shader when WebGPU is
 * available; otherwise falls back to the CPU implementation in fft.ts.
 */

import { fftMagnitude as cpuFftMagnitude } from './fft';

// ─── WebGPU state ──────────────────────────────────────────────────────────────

let gpuDevice: GPUDevice | null = null;
let gpuSupported: boolean | null = null; // null = not yet probed

/**
 * Probe WebGPU availability and request device. Call once at startup or lazily.
 * Returns true if WebGPU FFT is available.
 */
export async function initGpuFft(): Promise<boolean> {
  if (gpuSupported !== null) return gpuSupported;

  try {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      gpuSupported = false;
      return false;
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      gpuSupported = false;
      return false;
    }
    gpuDevice = await adapter.requestDevice();
    gpuSupported = true;
    return true;
  } catch {
    gpuSupported = false;
    return false;
  }
}

/**
 * Returns whether the GPU path is currently active.
 */
export function isGpuAvailable(): boolean {
  return gpuSupported === true && gpuDevice !== null;
}

// ─── WGSL Compute Shader ───────────────────────────────────────────────────────

/**
 * The shader performs in-place radix-2 FFT butterfly passes.
 * Input: real/imag arrays already bit-reverse permuted on the CPU side.
 * Each dispatch handles one butterfly pass (log2(N) dispatches total).
 */
const FFT_SHADER = /* wgsl */ `
struct Params {
  n: u32,
  half_size: u32,
}

@group(0) @binding(0) var<storage, read_write> re: array<f32>;
@group(0) @binding(1) var<storage, read_write> im: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

const PI: f32 = 3.14159265358979323846;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let size = params.half_size * 2u;
  let n = params.n;

  // Each thread handles one butterfly
  let block = idx / params.half_size;
  let k = idx % params.half_size;
  let i = block * size + k;
  let j = i + params.half_size;

  if (j >= n) { return; }

  let angle = -2.0 * PI * f32(k) / f32(size);
  let tw_re = cos(angle);
  let tw_im = sin(angle);

  let odd_re = re[j];
  let odd_im = im[j];
  let t_re = tw_re * odd_re - tw_im * odd_im;
  let t_im = tw_re * odd_im + tw_im * odd_re;

  let even_re = re[i];
  let even_im = im[i];

  re[i] = even_re + t_re;
  im[i] = even_im + t_im;
  re[j] = even_re - t_re;
  im[j] = even_im - t_im;
}
`;

// ─── Pipeline cache ────────────────────────────────────────────────────────────

let pipeline: GPUComputePipeline | null = null;
let bindGroupLayout: GPUBindGroupLayout | null = null;

function getOrCreatePipeline(device: GPUDevice): {
  pipeline: GPUComputePipeline;
  layout: GPUBindGroupLayout;
} {
  if (pipeline && bindGroupLayout) return { pipeline, layout: bindGroupLayout };

  const shaderModule = device.createShaderModule({ code: FFT_SHADER });
  bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
  pipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: 'main' },
  });
  return { pipeline, layout: bindGroupLayout };
}

// ─── Bit-reversal (CPU) ────────────────────────────────────────────────────────

function bitReverse(arr: Float32Array, n: number): void {
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute FFT magnitude spectrum using WebGPU. Falls back to CPU if unavailable.
 * Returns Float64Array of length fftSize/2 + 1, same as cpuFftMagnitude.
 */
export async function fftMagnitudeGpu(
  signal: Float64Array,
  fftSize: number,
): Promise<Float64Array> {
  // Fallback if GPU not available
  if (!isGpuAvailable() || !gpuDevice) {
    return cpuFftMagnitude(signal, fftSize);
  }

  const device = gpuDevice;
  const n = fftSize;

  // Prepare data (f32 for GPU)
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < Math.min(signal.length, n); i++) {
    re[i] = signal[i];
  }

  // Bit-reversal permutation on CPU
  bitReverse(re, n);
  bitReverse(im, n);

  // Create buffers
  const reBuffer = device.createBuffer({
    size: n * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const imBuffer = device.createBuffer({
    size: n * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const paramsBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(reBuffer, 0, re);
  device.queue.writeBuffer(imBuffer, 0, im);

  const { pipeline: pipe, layout } = getOrCreatePipeline(device);

  const bindGroup = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: reBuffer } },
      { binding: 1, resource: { buffer: imBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  // Dispatch log2(n) passes
  const log2n = Math.log2(n);
  const encoder = device.createCommandEncoder();
  for (let s = 0; s < log2n; s++) {
    const halfSize = 1 << s;
    const params = new Uint32Array([n, halfSize]);
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bindGroup);
    // Number of butterflies = n/2
    const workgroups = Math.ceil(n / 2 / 256);
    pass.dispatchWorkgroups(workgroups);
    pass.end();
  }

  // Read back
  const readReBuffer = device.createBuffer({
    size: n * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const readImBuffer = device.createBuffer({
    size: n * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  encoder.copyBufferToBuffer(reBuffer, 0, readReBuffer, 0, n * 4);
  encoder.copyBufferToBuffer(imBuffer, 0, readImBuffer, 0, n * 4);

  device.queue.submit([encoder.finish()]);

  await readReBuffer.mapAsync(GPUMapMode.READ);
  await readImBuffer.mapAsync(GPUMapMode.READ);

  const resultRe = new Float32Array(readReBuffer.getMappedRange());
  const resultIm = new Float32Array(readImBuffer.getMappedRange());

  const bins = n / 2 + 1;
  const mag = new Float64Array(bins);
  for (let i = 0; i < bins; i++) {
    mag[i] = Math.sqrt(resultRe[i] * resultRe[i] + resultIm[i] * resultIm[i]);
  }

  readReBuffer.unmap();
  readImBuffer.unmap();

  // Cleanup
  reBuffer.destroy();
  imBuffer.destroy();
  paramsBuffer.destroy();
  readReBuffer.destroy();
  readImBuffer.destroy();

  return mag;
}

/**
 * Synchronous fallback-only version for use in non-async contexts.
 * Always uses CPU. Use fftMagnitudeGpu for the GPU-accelerated path.
 */
export function fftMagnitudeFallback(signal: Float64Array, fftSize: number): Float64Array {
  return cpuFftMagnitude(signal, fftSize);
}

/**
 * Batch FFT magnitude using GPU — process all frames in a single dispatch.
 * Much faster than per-frame calls due to GPU parallelism.
 * Returns array of magnitude spectra (each fftSize/2 + 1 bins).
 */
export async function batchFftMagnitudeGpu(
  frames: Float64Array[],
  fftSize: number,
): Promise<Float64Array[]> {
  if (!isGpuAvailable() || !gpuDevice || frames.length === 0) {
    // CPU fallback
    return frames.map(f => cpuFftMagnitude(f, fftSize));
  }

  const device = gpuDevice;
  const n = fftSize;
  const numFrames = frames.length;
  const totalSize = n * numFrames;

  // Prepare interleaved data: all frames concatenated
  const re = new Float32Array(totalSize);
  const im = new Float32Array(totalSize);
  for (let f = 0; f < numFrames; f++) {
    const offset = f * n;
    const frame = frames[f];
    for (let i = 0; i < Math.min(frame.length, n); i++) {
      re[offset + i] = frame[i];
    }
    // Bit-reversal per frame
    bitReverse(re.subarray(offset, offset + n) as unknown as Float32Array, n);
    bitReverse(im.subarray(offset, offset + n) as unknown as Float32Array, n);
  }

  // Create buffers
  const reBuffer = device.createBuffer({
    size: totalSize * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const imBuffer = device.createBuffer({
    size: totalSize * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const paramsBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  device.queue.writeBuffer(reBuffer, 0, re);
  device.queue.writeBuffer(imBuffer, 0, im);

  // Use batch shader
  const { pipeline: pipe, layout } = getOrCreateBatchPipeline(device, n);

  const bindGroup = device.createBindGroup({
    layout,
    entries: [
      { binding: 0, resource: { buffer: reBuffer } },
      { binding: 1, resource: { buffer: imBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  // Dispatch log2(n) passes — each pass processes all frames
  const log2n = Math.log2(n);
  const encoder = device.createCommandEncoder();
  const totalButterflies = (n / 2) * numFrames;

  for (let s = 0; s < log2n; s++) {
    const halfSize = 1 << s;
    const params = new Uint32Array([n, halfSize]);
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const pass = encoder.beginComputePass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, bindGroup);
    const workgroups = Math.ceil(totalButterflies / 256);
    pass.dispatchWorkgroups(workgroups);
    pass.end();
  }

  // Read back
  const readReBuffer = device.createBuffer({
    size: totalSize * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  const readImBuffer = device.createBuffer({
    size: totalSize * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });
  encoder.copyBufferToBuffer(reBuffer, 0, readReBuffer, 0, totalSize * 4);
  encoder.copyBufferToBuffer(imBuffer, 0, readImBuffer, 0, totalSize * 4);

  device.queue.submit([encoder.finish()]);

  await readReBuffer.mapAsync(GPUMapMode.READ);
  await readImBuffer.mapAsync(GPUMapMode.READ);

  const resultRe = new Float32Array(readReBuffer.getMappedRange());
  const resultIm = new Float32Array(readImBuffer.getMappedRange());

  // Extract magnitudes per frame
  const bins = n / 2 + 1;
  const results: Float64Array[] = [];
  for (let f = 0; f < numFrames; f++) {
    const offset = f * n;
    const mag = new Float64Array(bins);
    for (let i = 0; i < bins; i++) {
      mag[i] = Math.sqrt(
        resultRe[offset + i] * resultRe[offset + i] +
        resultIm[offset + i] * resultIm[offset + i]
      );
    }
    results.push(mag);
  }

  readReBuffer.unmap();
  readImBuffer.unmap();
  reBuffer.destroy();
  imBuffer.destroy();
  paramsBuffer.destroy();
  readReBuffer.destroy();
  readImBuffer.destroy();

  return results;
}

// ─── Batch Pipeline (handles multiple frames per dispatch) ─────────────────────

const BATCH_FFT_SHADER = /* wgsl */ `
struct Params {
  n: u32,
  half_size: u32,
}

@group(0) @binding(0) var<storage, read_write> re: array<f32>;
@group(0) @binding(1) var<storage, read_write> im: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

const PI: f32 = 3.14159265358979323846;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let n = params.n;
  let butterflies_per_frame = n / 2u;

  // Determine which frame and which butterfly within the frame
  let frame_idx = idx / butterflies_per_frame;
  let local_idx = idx % butterflies_per_frame;
  let frame_offset = frame_idx * n;

  let size = params.half_size * 2u;
  let block = local_idx / params.half_size;
  let k = local_idx % params.half_size;
  let i = frame_offset + block * size + k;
  let j = i + params.half_size;

  let global_end = arrayLength(&re);
  if (j >= global_end) { return; }

  let angle = -2.0 * PI * f32(k) / f32(size);
  let tw_re = cos(angle);
  let tw_im = sin(angle);

  let odd_re = re[j];
  let odd_im = im[j];
  let t_re = tw_re * odd_re - tw_im * odd_im;
  let t_im = tw_re * odd_im + tw_im * odd_re;

  let even_re = re[i];
  let even_im = im[i];

  re[i] = even_re + t_re;
  im[i] = even_im + t_im;
  re[j] = even_re - t_re;
  im[j] = even_im - t_im;
}
`;

let batchPipeline: GPUComputePipeline | null = null;
let batchBindGroupLayout: GPUBindGroupLayout | null = null;

function getOrCreateBatchPipeline(device: GPUDevice, _n: number): {
  pipeline: GPUComputePipeline;
  layout: GPUBindGroupLayout;
} {
  if (batchPipeline && batchBindGroupLayout) {
    return { pipeline: batchPipeline, layout: batchBindGroupLayout };
  }

  const shaderModule = device.createShaderModule({ code: BATCH_FFT_SHADER });
  batchBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [batchBindGroupLayout] });
  batchPipeline = device.createComputePipeline({
    layout: pipelineLayout,
    compute: { module: shaderModule, entryPoint: 'main' },
  });
  return { pipeline: batchPipeline, layout: batchBindGroupLayout };
}
