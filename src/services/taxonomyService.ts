import {
  TENANT_CONFIG,
  buildTermSetTermsApiUrl,
  getTermStoreConfig,
  type TermStoreScope
} from '../config/tenantConfig';

export type TaxonomyKind = 'clients' | 'entities' | 'banks';

export interface ITaxonomyTerm {
  id: string;
  label: string;
  normalizedLabel: string;
  labels: string[];
  hasChildren: boolean;
}

export interface ITaxonomyMatch {
  rootTerm?: ITaxonomyTerm;
  docCenterTerm?: ITaxonomyTerm;
  label: string;
  normalizedLabel: string;
}

const termsCache: Partial<Record<TermStoreScope, Partial<Record<TaxonomyKind, Promise<ITaxonomyTerm[]>>>>> = {};

export const normalizeTaxonomyLabel = (value: string | undefined | null): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\b(l\.l\.c\.|llc|inc|corp|corporation|ltd|lp)\b/gi, '')
    .replace(/&/g, 'and')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach(value => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    result.push(trimmed);
  });

  return result;
};

const getODataNextLink = (payload: any): string | undefined =>
  payload?.['@odata.nextLink'] ||
  payload?.['@odata.nextlink'] ||
  payload?.['odata.nextLink'] ||
  payload?.['odata.nextlink'];

const getDefaultLabel = (term: any): string => {
  const label =
    term?.labels?.find((entry: any) => entry?.isDefault)?.name ||
    term?.labels?.[0]?.name ||
    term?.name ||
    '';

  return String(label).trim();
};

const mapTerm = (term: any): ITaxonomyTerm | null => {
  const id = String(term?.id || '').trim().toLowerCase();
  const label = getDefaultLabel(term);

  if (!id || !label) {
    return null;
  }

  const labels = uniqueStrings(
    (Array.isArray(term?.labels) ? term.labels : [])
      .map((entry: any) => String(entry?.name || '').trim())
      .filter(Boolean)
  );

  if (!labels.length) {
    labels.push(label);
  }

  return {
    id,
    label,
    normalizedLabel: normalizeTaxonomyLabel(label),
    labels,
    hasChildren:
      Number(term?.childrenCount || 0) > 0 ||
      (Array.isArray(term?.children) && term.children.length > 0)
  };
};

export const parseTaxonomyLabels = (value: any): string[] => {
  if (!value) return [];

  if (typeof value === 'string') {
    const labelsFromPairs = value
      .split(';#')
      .filter(token => token.includes('|'))
      .map(token => String(token.split('|')[0] || '').trim())
      .filter(label => Boolean(label) && !/^gp\d+$/i.test(label));

    if (labelsFromPairs.length) {
      return uniqueStrings(labelsFromPairs);
    }

    const compact = value.trim();
    if (!compact || TENANT_CONFIG.patterns.guidExact.test(compact)) {
      return [];
    }

    if (compact.includes('|') || compact.includes(';#')) {
      return [];
    }

    const guidTokens = compact
      .split(/[;,\s]+/)
      .map(token => token.trim())
      .filter(Boolean);

    if (guidTokens.length && guidTokens.every(token => TENANT_CONFIG.patterns.guidExact.test(token))) {
      return [];
    }

    return [compact];
  }

  if (Array.isArray(value)) {
    const labels: string[] = [];
    value.forEach(entry => {
      labels.push(...parseTaxonomyLabels(entry));
    });
    return uniqueStrings(labels);
  }

  if (typeof value === 'object') {
    const label = value.Label || value.label || value.Title || value.title || value.name;
    return label ? [String(label)] : [];
  }

  return [];
};

export const collectTermGuids = (value: any, set: Set<string>): void => {
  if (!value) return;

  if (typeof value === 'string') {
    const matches = value.match(TENANT_CONFIG.patterns.guid);
    (matches || []).forEach(guid => set.add(guid.toLowerCase()));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(entry => collectTermGuids(entry, set));
    return;
  }

  if (typeof value === 'object') {
    const guid = value.TermGuid || value.termGuid || value.id || value.Id;
    if (typeof guid === 'string') {
      const matches = guid.match(TENANT_CONFIG.patterns.guid);
      (matches || []).forEach(match => set.add(match.toLowerCase()));
    }
  }
};

export const fetchTaxonomyTerms = async (
  webUrl: string,
  scope: TermStoreScope,
  kind: TaxonomyKind
): Promise<ITaxonomyTerm[]> => {
  if (!termsCache[scope]) {
    termsCache[scope] = {};
  }

  if (!termsCache[scope]![kind]) {
    termsCache[scope]![kind] = (async () => {
      const termStore = getTermStoreConfig(scope);
      let url: string | undefined = buildTermSetTermsApiUrl(webUrl, termStore.sets[kind], scope);
      const visitedUrls = new Set<string>();
      const terms: ITaxonomyTerm[] = [];

      while (url && !visitedUrls.has(url)) {
        visitedUrls.add(url);

        const response = await fetch(url, {
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`Term set ${scope}.${kind} failed (${response.status}): ${detail || response.statusText}`);
        }

        const payload = await response.json();
        (Array.isArray(payload?.value) ? payload.value : []).forEach((term: any) => {
          const mapped = mapTerm(term);
          if (mapped) {
            terms.push(mapped);
          }
        });

        url = getODataNextLink(payload);
      }

      return terms.sort((a, b) => a.label.localeCompare(b.label));
    })();
  }

  return termsCache[scope]![kind]!;
};

export const findTermByLabel = (
  terms: ITaxonomyTerm[],
  label: string | undefined | null
): ITaxonomyTerm | undefined => {
  const normalized = normalizeTaxonomyLabel(label);
  if (!normalized) return undefined;

  return terms.find(term =>
    term.normalizedLabel === normalized ||
    term.labels.some(termLabel => normalizeTaxonomyLabel(termLabel) === normalized)
  );
};

export const mapRootLabelToDocCenterTerm = async (
  webUrl: string,
  kind: TaxonomyKind,
  rootLabel: string
): Promise<ITaxonomyMatch> => {
  const normalizedLabel = normalizeTaxonomyLabel(rootLabel);
  const [rootTerms, docCenterTerms] = await Promise.all([
    fetchTaxonomyTerms(webUrl, 'root', kind),
    fetchTaxonomyTerms(webUrl, 'docCenter', kind)
  ]);

  return {
    rootTerm: findTermByLabel(rootTerms, rootLabel),
    docCenterTerm: findTermByLabel(docCenterTerms, rootLabel),
    label: rootLabel,
    normalizedLabel
  };
};
