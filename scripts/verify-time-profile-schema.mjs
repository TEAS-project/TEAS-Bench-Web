import assert from 'node:assert/strict';
import { timingProfiles } from '../src/teas/timeProfiles.js';

const request = { prefill: 20, decode: 80, tool: 0,
  basis: 'request-phase-time', source: 'measured', n: 3 };
const accelerator = { prefill: 45, decode: 55, tool: 0,
  basis: 'batch-adjusted-accelerator-time', source: 'mixed', n: 3 };
const task = { prefill: 20, decode: 50, tool: 30,
  basis: 'task-time', source: 'mixed', n: 4 };

assert.deepEqual(timingProfiles({ profile: request,
  profile_accelerator_estimate: accelerator }, 'moe'),
{ request, acceleratorEstimate: accelerator, task: null });
assert.deepEqual(timingProfiles({ profile: task }, 'agentic'),
{ request: null, acceleratorEstimate: null, task });

for (const bad of [
  {},
  { profile: request },
  { profile: request, profile_accelerator_estimate: { ...accelerator, n: 2 } },
  { profile: { ...request, basis: 'per-request' }, profile_accelerator_estimate: accelerator },
  { profile: { ...request, prefill: 20.5, decode: 79.5 }, profile_accelerator_estimate: accelerator },
  { profile: { ...request, tool: 1, decode: 79 }, profile_accelerator_estimate: accelerator },
]) {
  assert.deepEqual(timingProfiles(bad, 'moe'),
    { request: null, acceleratorEstimate: null, task: null });
}

assert.equal(timingProfiles({ profile: { ...task, source: 'derived' } }, 'agentic').task, null);
assert.equal(timingProfiles({ profile: task, profile_accelerator_estimate: accelerator }, 'agentic').acceleratorEstimate, null);

console.log('timing profile schema checks passed');
