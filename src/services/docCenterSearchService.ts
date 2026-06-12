import { TENANT_CONFIG, buildListItemsApiUrl } from '../config/tenantConfig';
import {
  collectTermGuids,
  normalizeTaxonomyLabel,
  parseTaxonomyLabels,
  uniqueStrings,
  validateDocCenterTerm,
  type IDocCenterTermValidation,
  type TaxonomyKind
} from './taxonomyService';

const DEBUG_PREFIX = '[Greenville Debug]';

const debugLog = (event: string, data?: unknown): void => {
  console.log(`${DEBUG_PREFIX} ${event}`, data || '');
};

export interface IDocumentSearchItem {
  title: string;
  fileName: string;
  fileUrl: string;
  path: string;
  activity: string;
  status: string;
  modifiedDate: string;
  modifiedBy: string;
  author: string;
  editor: string;
  relatedClient: string;
  relatedEntity: string;
  relatedBank: string;
  metadata: Record<string, string>;
}

interface ISearchRowDocument extends IDocumentSearchItem {
  relatedClientValues: string[];
  relatedEntityValues: string[];
  relatedBankValues: string[];
}

interface IDocumentListItemMetadata {
  title?: string;
  fileName?: string;
  modifiedDate?: string;
  modifiedBy?: string;
  author?: string;
  editor?: string;
  relatedClientValues: string[];
  relatedEntityValues: string[];
  relatedBankValues: string[];
  metadata: Record<string, string>;
}

interface IDocCenterLibrary {
  id: string;
  title: string;
  rootFolderUrl: string;
}

export interface IDocumentSearchResult {
  documents: IDocumentSearchItem[];
  taxonomyMatch: IDocCenterTermValidation;
  executedQuery: string;
}

const getCellValue = (cells: any[], key: string): string => {
  const found = (cells || []).find((cell: any) => String(cell.Key || '').toLowerCase() === key.toLowerCase());
  return String(found?.Value || '');
};

const extractUserName = (userField: string): string => {
  if (!userField) return 'Unknown';

  const parts = String(userField).split('|');
  const last = parts[parts.length - 1] || userField;
  return last.includes('@') ? last.split('@')[0] : last;
};

const getLibraryNameFromPath = (path: string): string => {
  const parts = String(path || '').split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : 'Unknown';
};

const getFileNameFromPath = (path: string): string => {
  try {
    const pathname = new URL(path).pathname;
    const parts = pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || '');
  } catch {
    const parts = String(path || '').split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || '');
  }
};

const getODataNextLink = (payload: any): string | undefined =>
  payload?.['@odata.nextLink'] ||
  payload?.['@odata.nextlink'] ||
  payload?.['odata.nextLink'] ||
  payload?.['odata.nextlink'];

const getAbsoluteUrlFromServerRelativePath = (serverRelativePath: string): string => {
  const siteUrl = new URL(TENANT_CONFIG.sites.docCenter);
  const normalizedPath = String(serverRelativePath || '').startsWith('/')
    ? serverRelativePath
    : `/${serverRelativePath}`;

  return `${siteUrl.origin}${normalizedPath}`;
};

const escapeKqlPhrase = (value: string): string => String(value || '').replace(/"/g, '""');

const buildScope = (): string =>
  `contentclass:${TENANT_CONFIG.search.contentClassDocumentLibrary} AND path:"${TENANT_CONFIG.libraries.documentCenterPath}"`;

const buildPathScope = (): string =>
  `path:"${TENANT_CONFIG.libraries.documentCenterPath}"`;

const buildTaxonomyQuery = (
  kind: TaxonomyKind,
  label: string,
  docCenterTermId?: string
): string => {
  const props = TENANT_CONFIG.search.managedProperties;
  const guid = String(docCenterTermId || '').trim().toLowerCase();
  const guidQueries = guid
    ? uniqueStrings([
        guid,
        `GP0|#${guid}`,
        `L0|#0${guid}`
      ]).map(value => `"${escapeKqlPhrase(value)}"`)
    : [];
  const normalized = normalizeTaxonomyLabel(label);
  const labelQueries = uniqueStrings([label, normalized])
    .filter(Boolean)
    .map(value => `"${escapeKqlPhrase(value)}"`);

  const fieldQueries: string[] = [];

  if (kind === 'clients') {
    if (labelQueries.length) {
      fieldQueries.push(`${props.relatedClient}:(${labelQueries.join(' OR ')})`);
      fieldQueries.push(`(${labelQueries.join(' OR ')})`);
    }
    if (guidQueries.length) {
      fieldQueries.push(`${props.relatedClientTaxId}:(${guidQueries.join(' OR ')})`);
    }
  }

  if (kind === 'entities') {
    if (labelQueries.length) {
      fieldQueries.push(`${props.relatedEntity}:(${labelQueries.join(' OR ')})`);
      fieldQueries.push(`(${labelQueries.join(' OR ')})`);
    }
    if (guidQueries.length) {
      fieldQueries.push(`${props.relatedEntityTaxId}:(${guidQueries.join(' OR ')})`);
      fieldQueries.push(`${props.relatedEntityTaxIdFallback}:(${guidQueries.join(' OR ')})`);
    }
  }

  if (kind === 'banks') {
    if (labelQueries.length) {
      fieldQueries.push(`${props.relatedBank}:(${labelQueries.join(' OR ')})`);
      fieldQueries.push(`(${labelQueries.join(' OR ')})`);
    }
    if (guidQueries.length) {
      fieldQueries.push(`${props.relatedBankTaxId}:(${guidQueries.join(' OR ')})`);
    }
  }

  if (!fieldQueries.length) {
    return buildScope();
  }

  return `(${fieldQueries.join(' OR ')}) AND ${buildScope()}`;
};

const selectProperties = (): string =>
  uniqueStrings([
    TENANT_CONFIG.search.selectProperties.documents,
    TENANT_CONFIG.search.selectProperties.documentsWithRelatedClient,
    TENANT_CONFIG.search.managedProperties.relatedBank,
    TENANT_CONFIG.search.managedProperties.relatedBankTaxId
  ]).join(',');

const runSearchQuery = async (
  query: string,
  startRow: number = 0
): Promise<ISearchRowDocument[]> => {
  const startRowPart = startRow > 0 ? `&startrow=${startRow}` : '';
  const url =
    `${TENANT_CONFIG.sites.docCenter}/_api/search/query?querytext='${encodeURIComponent(query)}'` +
    `&rowlimit=${TENANT_CONFIG.search.rowLimitDefault}${startRowPart}` +
    `&selectproperties='${selectProperties()}'`;

  debugLog('Search query started', { query, startRow, url });

  const response = await fetch(url, {
    headers: { Accept: 'application/json;odata=nometadata' }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DocCenter search failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = await response.json();
  const rows = payload?.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];
  const documents = rows.map(mapSearchRow).filter(Boolean) as ISearchRowDocument[];

  debugLog('Search query completed', {
    query,
    startRow,
    rawRows: rows.length,
    documents: documents.map(document => ({
      title: document.title,
      path: document.path,
      relatedClient: document.relatedClient,
      relatedEntity: document.relatedEntity,
      relatedBank: document.relatedBank
    }))
  });

  return documents;
};

function valuesToDisplayText(values: string[]): string {
  return uniqueStrings(
    values.reduce((labels: string[], value: string) => {
      labels.push(...parseTaxonomyLabels(value));
      return labels;
    }, [])
  ).join(', ');
}

function mapSearchRow(row: any): ISearchRowDocument | null {
  const cells = row?.Cells || [];
  const props = TENANT_CONFIG.search.managedProperties;
  const path = getCellValue(cells, 'Path');
  const title = getCellValue(cells, 'Title') || getCellValue(cells, props.fileName) || getFileNameFromPath(path);

  if (!path || !title) {
    return null;
  }

  const relatedClientValues = [
    getCellValue(cells, props.relatedClient),
    getCellValue(cells, props.relatedClientTaxId)
  ].filter(Boolean);
  const relatedEntityValues = [
    getCellValue(cells, props.relatedEntity),
    getCellValue(cells, props.relatedEntityTaxId),
    getCellValue(cells, props.relatedEntityTaxIdFallback)
  ].filter(Boolean);
  const relatedBankValues = [
    getCellValue(cells, props.relatedBank),
    getCellValue(cells, props.relatedBankTaxId)
  ].filter(Boolean);
  const lastModified = getCellValue(cells, 'LastModifiedTime');
  const author = getCellValue(cells, 'Author');
  const editor = getCellValue(cells, 'Editor');
  const modifiedBy = getCellValue(cells, 'ModifiedBy') || editor || author;
  const fileName = getCellValue(cells, 'Filename') || getCellValue(cells, 'FileName') || getFileNameFromPath(path);

  return {
    title,
    fileName,
    fileUrl: path,
    path,
    activity: getLibraryNameFromPath(path),
    status: '',
    modifiedDate: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
    modifiedBy: extractUserName(modifiedBy),
    author: extractUserName(author),
    editor: extractUserName(editor),
    relatedClient: valuesToDisplayText(relatedClientValues),
    relatedEntity: valuesToDisplayText(relatedEntityValues),
    relatedBank: valuesToDisplayText(relatedBankValues),
    relatedClientValues,
    relatedEntityValues,
    relatedBankValues,
    metadata: {
      Title: title,
      FileName: fileName,
      Path: path,
      LastModifiedTime: lastModified,
      Author: author,
      Editor: editor,
      ModifiedBy: modifiedBy,
      RelatedClient: valuesToDisplayText(relatedClientValues),
      RelatedEntity: valuesToDisplayText(relatedEntityValues),
      RelatedBank: valuesToDisplayText(relatedBankValues)
    }
  };
}

const matchesValue = (
  values: string[],
  label: string,
  docCenterTermId?: string
): boolean => {
  const wantedLabel = normalizeTaxonomyLabel(label);
  const wantedGuid = String(docCenterTermId || '').toLowerCase();
  const guids = new Set<string>();
  values.forEach(value => collectTermGuids(value, guids));

  if (wantedGuid && guids.has(wantedGuid)) {
    return true;
  }

  const labels = uniqueStrings(
    values.reduce((allLabels: string[], value: string) => {
      allLabels.push(...parseTaxonomyLabels(value));
      return allLabels;
    }, [])
  );

  return labels.some(value => normalizeTaxonomyLabel(value) === wantedLabel);
};

const pathMatchesLabel = (path: string, label: string): boolean => {
  try {
    return normalizeTaxonomyLabel(decodeURIComponent(new URL(path).pathname)).includes(normalizeTaxonomyLabel(label));
  } catch {
    return false;
  }
};

const filterDocumentsByKind = (
  documents: ISearchRowDocument[],
  kind: TaxonomyKind,
  label: string,
  docCenterTermId?: string
): ISearchRowDocument[] =>
  documents.filter(document => {
    if (kind === 'clients') {
      return matchesValue(document.relatedClientValues, label, docCenterTermId) || pathMatchesLabel(document.path, label);
    }

    if (kind === 'entities') {
      return matchesValue(document.relatedEntityValues, label, docCenterTermId) || pathMatchesLabel(document.path, label);
    }

    return matchesValue(document.relatedBankValues, label, docCenterTermId) || pathMatchesLabel(document.path, label);
  });

const dedupeDocuments = (documents: ISearchRowDocument[]): IDocumentSearchItem[] => {
  const byPath = new Map<string, ISearchRowDocument>();

  documents.forEach(document => {
    const key = document.path.toLowerCase();
    if (!byPath.has(key)) {
      byPath.set(key, document);
    }
  });

  return Array.from(byPath.values()).map(document => ({
    title: document.title,
    fileName: document.fileName,
    fileUrl: document.fileUrl,
    path: document.path,
    activity: document.activity,
    status: document.status,
    modifiedDate: document.modifiedDate,
    modifiedBy: document.modifiedBy,
    author: document.author,
    editor: document.editor,
    relatedClient: document.relatedClient || '-',
    relatedEntity: document.relatedEntity || '-',
    relatedBank: document.relatedBank || '-',
    metadata: document.metadata
  }));
};

const searchAllDocCenterDocuments = async (): Promise<ISearchRowDocument[]> => {
  const documents: ISearchRowDocument[] = [];
  const queries = [buildScope(), buildPathScope()];
  const pageSize = TENANT_CONFIG.search.rowLimitDefault;

  debugLog('Search all DocCenter documents started', { queries, pageSize });

  for (const query of queries) {
    for (let startRow = 0; startRow < TENANT_CONFIG.queryLimits.listTop; startRow += pageSize) {
      const page = await runSearchQuery(query, startRow);
      documents.push(...page);

      if (page.length < pageSize) {
        break;
      }
    }

    if (documents.length) {
      break;
    }
  }

  debugLog('Search all DocCenter documents completed', {
    count: documents.length,
    documents: documents.map(document => ({ title: document.title, path: document.path }))
  });

  return documents;
};

const getSiteWebUrlFromFileUrl = (fileUrl: string): string => {
  const url = new URL(fileUrl);
  const segments = url.pathname.split('/').filter(Boolean);

  if ((segments[0] === 'sites' || segments[0] === 'teams') && segments[1]) {
    return `${url.origin}/${segments[0]}/${segments[1]}`;
  }

  return url.origin;
};

const getFieldValueByCandidates = (item: any, candidates: string[]): any[] => {
  if (!item || typeof item !== 'object') {
    return [];
  }

  const lowerKeyByName = new Map<string, string>();
  Object.keys(item).forEach(key => lowerKeyByName.set(key.toLowerCase(), key));

  return candidates
    .map(candidate => lowerKeyByName.get(candidate.toLowerCase()))
    .filter(Boolean)
    .map(key => item[key as string])
    .filter(Boolean);
};

const getFieldsContaining = (item: any, tokens: string[]): any[] => {
  if (!item || typeof item !== 'object') {
    return [];
  }

  return Object.keys(item)
    .filter(key => {
      const lower = key.toLowerCase();
      return tokens.some(token => lower.includes(token.toLowerCase()));
    })
    .map(key => item[key])
    .filter(Boolean);
};

const serializeMetadataValue = (value: any): string => {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializeMetadataValue).filter(Boolean).join(';#');
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.results)) {
      return value.results.map(serializeMetadataValue).filter(Boolean).join(';#');
    }

    const guid = String(value.TermGuid || value.termGuid || value.Id || value.id || '').trim();
    const label = String(
      value.Label || value.label || value.Title || value.title || value.name || ''
    ).trim();

    if (label && guid) {
      return `${label}|${guid}`;
    }

    if (label) {
      return label;
    }

    if (guid) {
      return guid;
    }

    return '';
  }

  return String(value);
};

const extractRelatedValuesFromItem = (
  item: any
): Pick<IDocumentListItemMetadata, 'relatedClientValues' | 'relatedEntityValues' | 'relatedBankValues'> => ({
  relatedClientValues: uniqueStrings([
    ...getFieldValueByCandidates(item, ['RelatedClient', 'Client']),
    ...getFieldsContaining(item, ['relatedclient', 'client'])
  ].map(serializeMetadataValue)),
  relatedEntityValues: uniqueStrings([
    ...getFieldValueByCandidates(item, ['RelatedEntity', 'ReletedEntity', 'Entity']),
    ...getFieldsContaining(item, ['relatedentity', 'reletedentity', 'entity'])
  ].map(serializeMetadataValue)),
  relatedBankValues: uniqueStrings([
    ...getFieldValueByCandidates(item, ['RelatedBank', 'Bank', 'Bank1']),
    ...getFieldsContaining(item, ['relatedbank', 'bank'])
  ].map(serializeMetadataValue))
});

const mapDocCenterListItem = (item: any, library: IDocCenterLibrary): ISearchRowDocument | null => {
  const serverRelativePath = String(
    item?.FileRef ||
    item?.File?.ServerRelativeUrl ||
    item?.EncodedAbsUrl ||
    ''
  ).trim();
  const path = serverRelativePath
    ? serverRelativePath.toLowerCase().startsWith('http')
      ? serverRelativePath
      : getAbsoluteUrlFromServerRelativePath(serverRelativePath)
    : '';
  const fileName = String(item?.FileLeafRef || getFileNameFromPath(path) || '').trim();
  const title = String(item?.Title || fileName || '').trim();

  if (!path || !title) {
    return null;
  }

  const relatedValues = extractRelatedValuesFromItem(item);
  const author = String(item?.Author?.Title || item?.Author || '');
  const editor = String(item?.Editor?.Title || item?.Editor || '');
  const modifiedBy = editor || author;
  const modified = String(item?.Modified || '');

  return {
    title,
    fileName,
    fileUrl: path,
    path,
    activity: library.title || getLibraryNameFromPath(path),
    status: '',
    modifiedDate: modified ? new Date(modified).toLocaleDateString() : 'Unknown',
    modifiedBy: extractUserName(modifiedBy),
    author: extractUserName(author),
    editor: extractUserName(editor),
    relatedClient: valuesToDisplayText(relatedValues.relatedClientValues),
    relatedEntity: valuesToDisplayText(relatedValues.relatedEntityValues),
    relatedBank: valuesToDisplayText(relatedValues.relatedBankValues),
    relatedClientValues: relatedValues.relatedClientValues,
    relatedEntityValues: relatedValues.relatedEntityValues,
    relatedBankValues: relatedValues.relatedBankValues,
    metadata: {
      Title: title,
      FileName: fileName,
      Path: path,
      Modified: modified,
      Author: author,
      Editor: editor,
      ModifiedBy: modifiedBy,
      RelatedClient: valuesToDisplayText(relatedValues.relatedClientValues),
      RelatedEntity: valuesToDisplayText(relatedValues.relatedEntityValues),
      RelatedBank: valuesToDisplayText(relatedValues.relatedBankValues)
    }
  };
};

const getListItemMetadata = async (fileUrl: string): Promise<IDocumentListItemMetadata | undefined> => {
  try {
    const url = new URL(fileUrl);
    const siteWebUrl = getSiteWebUrlFromFileUrl(fileUrl);
    const serverRelativePath = url.pathname.replace(/'/g, "''");
    const endpoint = `${siteWebUrl}/_api/web/GetFileByServerRelativePath(decodedurl='${serverRelativePath}')/ListItemAllFields`;

    debugLog('Document metadata fallback started', { fileUrl, endpoint });

    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });

    if (!response.ok) {
      debugLog('Document metadata fallback failed response', {
        fileUrl,
        status: response.status,
        statusText: response.statusText
      });
      return undefined;
    }

    const item = await response.json();
    const relatedClientValues = uniqueStrings([
      ...getFieldValueByCandidates(item, ['RelatedClient', 'Client']),
      ...getFieldsContaining(item, ['relatedclient', 'client'])
    ].map(serializeMetadataValue));
    const relatedEntityValues = uniqueStrings([
      ...getFieldValueByCandidates(item, ['RelatedEntity', 'ReletedEntity', 'Entity']),
      ...getFieldsContaining(item, ['relatedentity', 'reletedentity', 'entity'])
    ].map(serializeMetadataValue));
    const relatedBankValues = uniqueStrings([
      ...getFieldValueByCandidates(item, ['RelatedBank', 'Bank', 'Bank1']),
      ...getFieldsContaining(item, ['relatedbank', 'bank'])
    ].map(serializeMetadataValue));
    const author = String(item?.Author?.Title || item?.Author || '');
    const editor = String(item?.Editor?.Title || item?.Editor || '');
    const modified = String(item?.Modified || '');

    const metadata = {
      title: String(item?.Title || ''),
      fileName: String(item?.FileLeafRef || ''),
      modifiedDate: modified ? new Date(modified).toLocaleDateString() : undefined,
      modifiedBy: editor || author || undefined,
      author,
      editor,
      relatedClientValues,
      relatedEntityValues,
      relatedBankValues,
      metadata: {
        Title: String(item?.Title || ''),
        FileName: String(item?.FileLeafRef || ''),
        Modified: modified,
        Author: author,
        Editor: editor,
        RelatedClient: valuesToDisplayText(relatedClientValues),
        RelatedEntity: valuesToDisplayText(relatedEntityValues),
        RelatedBank: valuesToDisplayText(relatedBankValues)
      }
    };

    debugLog('Document metadata fallback completed', {
      fileUrl,
      returnedFieldNames: Object.keys(item || {}),
      relatedClientValues,
      relatedEntityValues,
      relatedBankValues
    });

    return metadata;
  } catch (error) {
    console.warn('DocCenter list item metadata fallback failed', error);
    return undefined;
  }
};

const mergeListItemMetadata = (
  document: ISearchRowDocument,
  itemMetadata: IDocumentListItemMetadata | undefined
): ISearchRowDocument => {
  if (!itemMetadata) {
    return document;
  }

  const relatedClientValues = [...document.relatedClientValues, ...itemMetadata.relatedClientValues];
  const relatedEntityValues = [...document.relatedEntityValues, ...itemMetadata.relatedEntityValues];
  const relatedBankValues = [...document.relatedBankValues, ...itemMetadata.relatedBankValues];

  return {
    ...document,
    title: document.title || itemMetadata.title || document.fileName,
    fileName: document.fileName || itemMetadata.fileName || getFileNameFromPath(document.path),
    modifiedDate: itemMetadata.modifiedDate || document.modifiedDate,
    modifiedBy: itemMetadata.modifiedBy || document.modifiedBy,
    author: itemMetadata.author || document.author,
    editor: itemMetadata.editor || document.editor,
    relatedClient: valuesToDisplayText(relatedClientValues) || document.relatedClient,
    relatedEntity: valuesToDisplayText(relatedEntityValues) || document.relatedEntity,
    relatedBank: valuesToDisplayText(relatedBankValues) || document.relatedBank,
    relatedClientValues,
    relatedEntityValues,
    relatedBankValues,
    metadata: {
      ...document.metadata,
      ...itemMetadata.metadata
    }
  };
};

const enrichDocumentsWithListItemMetadata = async (
  documents: ISearchRowDocument[]
): Promise<ISearchRowDocument[]> => {
  const metadataByPath = new Map<string, Promise<IDocumentListItemMetadata | undefined>>();

  return Promise.all(
    documents.map(async document => {
      const key = document.path.toLowerCase();
      if (!metadataByPath.has(key)) {
        metadataByPath.set(key, getListItemMetadata(document.path));
      }

      return mergeListItemMetadata(document, await metadataByPath.get(key));
    })
  );
};

export const searchDocCenterDocumentsByLabel = async (
  webUrl: string,
  kind: TaxonomyKind,
  selectedLabel: string,
  docCenterTermGuid?: string | null
): Promise<IDocumentSearchResult> => {
  debugLog('Document search requested', { kind, selectedLabel, docCenterTermGuid });

  const taxonomyMatch = await validateDocCenterTerm(webUrl, kind, selectedLabel, docCenterTermGuid);
  debugLog('DocCenter taxonomy validation completed', {
    kind,
    selectedLabel,
    docCenterTermGuid,
    taxonomyMatch
  });

  if (!taxonomyMatch.term?.id) {
    return {
      documents: [],
      taxonomyMatch,
      executedQuery: ''
    };
  }

  const query = buildTaxonomyQuery(kind, taxonomyMatch.term.label || selectedLabel, taxonomyMatch.term.id);
  let documents = await runSearchQuery(query);

  if (!documents.length) {
    debugLog('Primary document search empty, starting fallback scan', { kind, selectedLabel });
    const allDocuments = await searchAllDocCenterDocuments();
    const enrichedDocuments = await enrichDocumentsWithListItemMetadata(allDocuments);
    documents = filterDocumentsByKind(
      enrichedDocuments,
      kind,
      selectedLabel,
      taxonomyMatch.term.id
    );
    debugLog('Fallback scan filtered documents', {
      kind,
      selectedLabel,
      scannedCount: allDocuments.length,
      matchedCount: documents.length,
      documents: documents.map(document => ({
        title: document.title,
        path: document.path,
        relatedClient: document.relatedClient,
        relatedEntity: document.relatedEntity,
        relatedBank: document.relatedBank
      }))
    });
  } else {
    documents = await enrichDocumentsWithListItemMetadata(documents);
  }

  debugLog('Document search completed', {
    kind,
    selectedLabel,
    docCenterTermGuid: taxonomyMatch.term.id,
    count: documents.length,
    documents: documents.map(document => ({
      title: document.title,
      path: document.path,
      relatedClient: document.relatedClient,
      relatedEntity: document.relatedEntity,
      relatedBank: document.relatedBank
    }))
  });

  return {
    documents: dedupeDocuments(documents),
    taxonomyMatch,
    executedQuery: query
  };
};

export const getRootClientLabel = async (
  webUrl: string,
  clientId: number,
  fallbackName?: string | null
): Promise<string> => {
  debugLog('Root client label request started', { clientId, fallbackName });

  const clientField = TENANT_CONFIG.lists.clients.columns.client || 'Client';
  const response = await fetch(
    `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.clients.title)}(${clientId})?$select=Title,${clientField}`,
    { headers: { Accept: 'application/json;odata=nometadata' } }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Failed to fetch selected client (${response.status}): ${detail || response.statusText}`);
  }

  const item = await response.json();
  const labels = [
    fallbackName,
    ...parseTaxonomyLabels(item?.[clientField]),
    item?.Title
  ].filter(Boolean) as string[];

  const label = labels[0] || '';
  debugLog('Root client label request completed', { clientId, label, item });

  return label;
};
