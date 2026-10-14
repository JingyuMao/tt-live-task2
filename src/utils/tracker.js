// The same component can run from a hosted build or the generated offline HTML.
export function createTracker() {
  const embedded = document.getElementById('ew-worker');
  if (!embedded) return {
    worker: new Worker(`${import.meta.env.BASE_URL}tracker-worker.js`),
    init: { type: 'init' },
    dispose() {},
  };
  const bytes = id => Uint8Array.from(atob(document.getElementById(id).textContent.trim()), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes('ew-worker')], { type: 'text/javascript' }));
  try {
    return {
      worker: new Worker(url),
      init: {
        type: 'init',
        binaryUrl: 'data:application/wasm;base64,' + document.getElementById('ew-wasm').textContent.trim(),
        model: bytes('ew-model'),
      },
      dispose() { URL.revokeObjectURL(url); },
    };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

