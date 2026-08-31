const COMPONENTS = ['prefill', 'decode', 'tool'];

function exactProfile(value, basis, source, toolMustBeZero = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const vals = COMPONENTS.map((key) => value[key]);
  if (!vals.every((x) => Number.isInteger(x) && x >= 0) || vals.reduce((a, b) => a + b, 0) !== 100) return null;
  if (toolMustBeZero && value.tool !== 0) return null;
  if (value.basis !== basis || value.source !== source || !Number.isInteger(value.n) || value.n <= 0) return null;
  return value;
}

/** Validate timing profiles. MoE pairs share a cohort. Agentic profiles use task time only. */
export function timingProfiles(frameworkBlock, kind) {
  const block = frameworkBlock && typeof frameworkBlock === 'object' ? frameworkBlock : {};
  if (kind === 'agentic') {
    const task = exactProfile(block.profile, 'task-time', 'mixed');
    return { request: null, acceleratorEstimate: null, task };
  }
  if (kind !== 'moe') return { request: null, acceleratorEstimate: null, task: null };
  const request = exactProfile(block.profile, 'request-phase-time', 'measured', true);
  const acceleratorEstimate = exactProfile(
    block.profile_accelerator_estimate, 'batch-adjusted-accelerator-time', 'mixed', true,
  );
  if (!request || !acceleratorEstimate || request.n !== acceleratorEstimate.n) {
    return { request: null, acceleratorEstimate: null, task: null };
  }
  return { request, acceleratorEstimate, task: null };
}
