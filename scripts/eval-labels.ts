// Scores a hand-labeled corpus. Corpora stay in `private/` and out of the public repo.
// Usage: npm run eval -- private/labels.json
// Format: [{ "title": "...", "status": "Agreement reported", "source": "espn" }]
import { readFileSync } from 'node:fs';
import { classifyStatus } from '../src/core/extract';
import { normalizeText } from '../src/core/text';

const MIN_EXAMPLES = 50;
const MIN_PRECISION = 0.98;
const GATED = ['Agreement reported', 'Fell through'];

interface Label { title: string; status: string; source?: string }
const labels = JSON.parse(readFileSync(process.argv[2] ?? 'private/labels.json', 'utf8')) as Label[];

for (const status of GATED) {
  const predicted = labels.filter((label) => classifyStatus(label.title, normalizeText(label.title)) === status);
  const correct = predicted.filter((label) => label.status === status);
  const actual = labels.filter((label) => label.status === status);
  const precision = predicted.length ? correct.length / predicted.length : 0;
  const recall = actual.length ? correct.length / actual.length : 0;
  const passes = predicted.length >= MIN_EXAMPLES && precision >= MIN_PRECISION;
  console.log(`${status}: predicted ${predicted.length}, precision ${(precision * 100).toFixed(1)}%, recall ${(recall * 100).toFixed(1)}%, ${passes ? 'PASS' : 'FAIL'}`);
  for (const label of predicted.filter((entry) => entry.status !== status)) console.log(`  wrong: ${label.title}`);
}
