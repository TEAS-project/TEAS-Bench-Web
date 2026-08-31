/** Validate prefill values and their provenance labels. Invalid pairs render as unavailable. */
const RATE_BASES = ['measured', 'estimated'];
const MFU_BASES = ['mixed', 'estimated'];

function labelled(value, basis, allowed) {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (!allowed.includes(basis)) return null;
  return { value, basis, estimated: basis === 'estimated' };
}

export const prefillRate = (cell) => labelled(cell && cell.tps_p, cell && cell.tps_p_basis, RATE_BASES);
export const prefillMfu = (cell) => labelled(cell && cell.mfu_p, cell && cell.mfu_p_basis, MFU_BASES);
