import { readFile, writeFile } from 'node:fs/promises';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export async function comparePngs(referencePath, currentPath, differencePath, pixelThreshold, maxDiffRatio) {
  const [referenceBytes, currentBytes] = await Promise.all([readFile(referencePath), readFile(currentPath)]);
  const reference = PNG.sync.read(referenceBytes);
  const current = PNG.sync.read(currentBytes);
  const width = Math.max(reference.width, current.width);
  const height = Math.max(reference.height, current.height);
  const paddedReference = new PNG({ width, height });
  const paddedCurrent = new PNG({ width, height });
  paddedReference.data.fill(0);
  paddedCurrent.data.fill(0);
  PNG.bitblt(reference, paddedReference, 0, 0, reference.width, reference.height, 0, 0);
  PNG.bitblt(current, paddedCurrent, 0, 0, current.width, current.height, 0, 0);
  const difference = new PNG({ width, height });
  const differentPixels = pixelmatch(
    paddedReference.data, paddedCurrent.data, difference.data, width, height,
    { threshold: pixelThreshold, includeAA: false, diffMask: true, diffColor: [255, 0, 64] },
  );
  await writeFile(differencePath, PNG.sync.write(difference));
  const diffRatio = differentPixels / (width * height);
  const widthMatch = reference.width === current.width;
  const heightMatch = reference.height === current.height;
  const dimensionsMatch = widthMatch && heightMatch;
  return {
    referenceDimensions: { width: reference.width, height: reference.height },
    currentDimensions: { width: current.width, height: current.height },
    comparisonDimensions: { width, height },
    widthDifference: current.width - reference.width,
    heightDifference: current.height - reference.height,
    widthMatch,
    heightMatch,
    dimensionsMatch,
    differentPixels,
    comparedPixels: width * height,
    diffRatio,
    maxDiffRatio,
    pixelThreshold,
    passed: widthMatch && diffRatio <= maxDiffRatio,
  };
}
