#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const REQUIRED_FIELDS = [
  'patientName',
  'reportDate',
  'subject',
  'sourceContact',
  'storeIn',
  'assignedDoctor',
  'category',
];

const VALID_STORE_IN = new Set(['Investigations', 'Correspondence']);
const VALID_CATEGORIES = new Set([
  'Admissions summary',
  'Advance care planning',
  'Allied health letter',
  'Certificate',
  'Clinical notes',
  'Clinical photograph',
  'Consent form',
  'DAS21',
  'Discharge summary',
  'ECG',
  'Email',
  'Form',
  'Immunisation',
  'Indigenous PIP',
  'Letter',
  'Medical imaging report',
  'MyHealth registration',
  'New PT registration form',
  'Pathology results',
  'Patient consent',
  'Record request',
  'Referral letter',
  'Workcover',
  'Workcover consent',
]);

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.split('=');
    return [key, rest.join('=')];
  }),
);

const apiBaseUrl = args.get('--api') || process.env.API_BASE_URL || 'http://localhost:3000';
const inputDir = args.get('--input') || process.env.INPUT_DIR || 'input';
const outputPath =
  args.get('--out') || process.env.QUALITY_REPORT_OUT || 'output/extraction_quality_report.json';
const goldPath =
  args.get('--gold') ||
  process.env.GOLD_LABELS_PATH ||
  'tests/module-1-validation/gold_labels.sample.json';
const limit = Number(args.get('--limit') || process.env.QUALITY_DOC_LIMIT || 0);

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2);
}

function isValidIsoDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

function hasValue(value) {
  return normalize(value).length > 0;
}

function mimeTypeForFile(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return 'application/octet-stream';
}

function compareField(fieldName, extractedValue, expectedValue) {
  if (!hasValue(expectedValue)) return null;

  const extracted = normalize(extractedValue);
  const expected = normalize(expectedValue);

  if (fieldName === 'reportDate' || fieldName === 'storeIn' || fieldName === 'category') {
    return extracted === expected;
  }

  const extractedTokens = tokenize(extracted);
  const expectedTokens = tokenize(expected);
  if (expectedTokens.length === 0) return extracted === expected;

  const overlap = expectedTokens.filter((token) => extractedTokens.includes(token)).length;
  return overlap / expectedTokens.length >= 0.5;
}

async function loadGoldLabels(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

async function run() {
  const allFiles = (await fs.readdir(inputDir))
    .filter((name) => /\.(pdf|docx)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  const files = limit > 0 ? allFiles.slice(0, limit) : allFiles;

  if (files.length === 0) {
    throw new Error(`No PDF/DOCX files found in "${inputDir}".`);
  }

  const goldLabels = await loadGoldLabels(goldPath);
  const perDocument = [];
  let completeDocs = 0;
  let validDateDocs = 0;
  let validStoreDocs = 0;
  let validCategoryDocs = 0;
  let knownAccuracyDocs = 0;
  let knownAccuracyTotal = 0;

  for (const fileName of files) {
    const fullPath = path.join(inputDir, fileName);
    const fileBuffer = await fs.readFile(fullPath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeTypeForFile(fileName) });
    formData.append('file', blob, fileName);

    let result;
    try {
      const response = await fetch(`${apiBaseUrl}/documents/process`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success || !payload?.data?.extractedData) {
        throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
      }

      const extracted = payload.data.extractedData;
      const populatedCount = REQUIRED_FIELDS.filter((field) => hasValue(extracted[field])).length;
      const completeness = populatedCount / REQUIRED_FIELDS.length;
      const isComplete = populatedCount === REQUIRED_FIELDS.length;
      const dateValid = isValidIsoDate(extracted.reportDate);
      const storeValid = VALID_STORE_IN.has(extracted.storeIn);
      const categoryValid = VALID_CATEGORIES.has(extracted.category);

      if (isComplete) completeDocs += 1;
      if (dateValid) validDateDocs += 1;
      if (storeValid) validStoreDocs += 1;
      if (categoryValid) validCategoryDocs += 1;

      const expected = goldLabels[fileName];
      let knownAccuracy = null;
      if (expected && typeof expected === 'object') {
        const comparisons = REQUIRED_FIELDS.map((field) =>
          compareField(field, extracted[field], expected[field]),
        ).filter((value) => value !== null);

        if (comparisons.length > 0) {
          const matches = comparisons.filter(Boolean).length;
          knownAccuracy = matches / comparisons.length;
          knownAccuracyDocs += 1;
          knownAccuracyTotal += knownAccuracy;
        }
      }

      result = {
        fileName,
        success: true,
        documentId: payload.data.documentId,
        completeness,
        populatedCount,
        dateValid,
        storeValid,
        categoryValid,
        knownAccuracy,
        extracted,
      };
    } catch (error) {
      result = {
        fileName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    perDocument.push(result);
    const status = result.success ? 'OK' : 'FAIL';
    const details = result.success
      ? `${Math.round(result.completeness * 100)}% fields`
      : result.error;
    console.log(`${status}  ${fileName}  ${details}`);
  }

  const successfulDocs = perDocument.filter((row) => row.success).length;
  const report = {
    generatedAt: new Date().toISOString(),
    apiBaseUrl,
    inputDir,
    totalDocs: files.length,
    successfulDocs,
    failedDocs: files.length - successfulDocs,
    completeDocs,
    validDateDocs,
    validStoreDocs,
    validCategoryDocs,
    completeRate: successfulDocs > 0 ? completeDocs / successfulDocs : 0,
    validDateRate: successfulDocs > 0 ? validDateDocs / successfulDocs : 0,
    validStoreRate: successfulDocs > 0 ? validStoreDocs / successfulDocs : 0,
    validCategoryRate: successfulDocs > 0 ? validCategoryDocs / successfulDocs : 0,
    knownAccuracyDocs,
    knownAccuracyAverage:
      knownAccuracyDocs > 0 ? knownAccuracyTotal / knownAccuracyDocs : null,
    perDocument,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nSummary');
  console.log(`- Processed: ${report.totalDocs}`);
  console.log(`- Success: ${report.successfulDocs}`);
  console.log(`- 7/7 complete: ${Math.round(report.completeRate * 100)}%`);
  console.log(`- Valid date format: ${Math.round(report.validDateRate * 100)}%`);
  console.log(`- Valid store/category: ${Math.round(report.validStoreRate * 100)}% / ${Math.round(report.validCategoryRate * 100)}%`);
  if (report.knownAccuracyAverage !== null) {
    console.log(`- Known-label accuracy: ${Math.round(report.knownAccuracyAverage * 100)}% (${report.knownAccuracyDocs} docs)`);
  } else {
    console.log('- Known-label accuracy: N/A (no matching labels in gold file)');
  }
  console.log(`- Report saved: ${outputPath}`);
}

run().catch((error) => {
  console.error(`Quality check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
