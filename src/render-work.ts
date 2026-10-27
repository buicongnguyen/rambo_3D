import * as T from "three";
/** Compare Float32 values; preserve ranges pending while a batch is hidden. */
export function writeComponents(
  attribute: T.BufferAttribute,
  offset: number,
  values: ArrayLike<number>,
) {
  const array = attribute.array as Float32Array;
  let first = Infinity,
    last = -1;
  for (let i = 0; i < values.length; i++) {
    const value = Math.fround(values[i]),
      index = offset + i;
    if (array[index] !== value) {
      array[index] = value;
      first = Math.min(first, index);
      last = index;
    }
  }
  if (last < 0) return;
  for (const range of attribute.updateRanges) {
    first = Math.min(first, range.start);
    last = Math.max(last, range.start + range.count - 1);
  }
  if (attribute.updateRanges.length) {
    attribute.updateRanges[0].start = first;
    attribute.updateRanges[0].count = last - first + 1;
    attribute.updateRanges.length = 1;
  } else attribute.addUpdateRange(first, last - first + 1);
  attribute.needsUpdate = true;
}

const stagingArrays = new WeakMap<T.BufferAttribute, Float32Array>();
/** Reuse a contiguous staging buffer so matrix.toArray keeps its existing hot path. */
export function stagingComponents(attribute: T.BufferAttribute) {
  let staging = stagingArrays.get(attribute);
  if (!staging) {
    staging = new Float32Array(attribute.array.length);
    stagingArrays.set(attribute, staging);
  }
  return staging;
}
/** Compare already-converted floats once per batch, rather than per mesh part. */
export function commitComponents(
  attribute: T.BufferAttribute,
  staging: Float32Array,
  count: number,
) {
  const array = attribute.array as Float32Array;
  let first = count,
    last = -1;
  for (let i = 0; i < count; i++) {
    if (array[i] !== staging[i]) {
      first = Math.min(first, i);
      last = i;
    }
  }
  if (last < 0) return;
  array.set(staging.subarray(first, last + 1), first);
  for (const range of attribute.updateRanges) {
    first = Math.min(first, range.start);
    last = Math.max(last, range.start + range.count - 1);
  }
  if (attribute.updateRanges.length) {
    attribute.updateRanges[0].start = first;
    attribute.updateRanges[0].count = last - first + 1;
    attribute.updateRanges.length = 1;
  } else attribute.addUpdateRange(first, last - first + 1);
  attribute.needsUpdate = true;
}
