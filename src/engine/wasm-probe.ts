// Runs in a worker next to the engine files: can WebAssembly be compiled here? Some hosts
// forbid it by Content-Security-Policy, and the engine worker then hangs without an error.
const EMPTY_MODULE = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])

WebAssembly.compile(EMPTY_MODULE).then(
  () => postMessage(true),
  () => postMessage(false),
)
