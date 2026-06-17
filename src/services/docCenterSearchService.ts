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

interface IDocCenterTargetLibraryConfig {
  title: string;
  internalName: string;
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
  return parts.length > 1 ? decodeURIComponent(parts[parts.length - 2]) : 'Unknown';
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

const DOC_CENTER_TARGET_LIBRARIES: IDocCenterTargetLibraryConfig[] = [
  // Add Doc Center libraries here as needed. Use the URL/internal name for spaces, e.g. Client%20Services.
  { title: 'Asset Management', internalName: 'Asset%20Management' },
  { title: 'Canoe API Document Center', internalName: 'Canoe%20API%20Document%20Center' },
  { title: 'Canoe Document Center', internalName: 'Canoe%20Document%20Center' },
  { title: 'Client Services', internalName: 'Client%20Services' },
  { title: 'Entity Management', internalName: 'Entity%20Management' },
  { title: 'Greenville Capital LLC II', internalName: 'Greenville%20Capital%20LLC%20II' },
  { title: 'Greenville Capital LLC', internalName: 'Greenville%20Capital%20LLC' },
  { title: 'Investment', internalName: 'Investment' },
  { title: 'Meeting Document Library', internalName: 'Meeting%20Document%20Library' },
  { title: 'Foundation', internalName: 'Foundation' },
  { title: 'Finance Tax', internalName: 'Finance%20Tax' }
];
const DOC_CENTER_REST_SCAN_ITEM_LIMIT = 50;
const DOC_CENTER_CLIENT_SEARCH_LIBRARIES: IDocCenterTargetLibraryConfig[] = [
  { title: 'Client Services', internalName: 'Client%20Services' },
  { title: 'Finance Tax', internalName: 'Finance%20Tax' },
  { title: 'Investment', internalName: 'Investment' }
];
const DOC_CENTER_ENTITY_SEARCH_LIBRARIES: IDocCenterTargetLibraryConfig[] = [
  { title: 'Asset Management', internalName: 'Asset%20Management' },
  { title: 'Entity Management', internalName: 'Entity%20Management' },
  { title: 'Finance Tax', internalName: 'Finance%20Tax' },
  { title: 'Investment', internalName: 'Investment' }
];
const DOC_CENTER_SEARCH_SELECT_PROPERTIES = [
  'Title',
  'Filename',
  'FileName',
  'Path',
  'LastModifiedTime',
  'Author',
  'Editor',
  'ModifiedBy',
  'Status',
  'StatusOWSCHCS',
  'StatusOWSTEXT',
  'RelatedClient',
  'RefinableString01',
  'relatedEntity',
  'RelatedClientOWSTAXID',
  'RelatedEntity',
  'RefinableString03',
  'RelatedEntityOWSTAXID',
  'owstaxIdRelatedEntity'
];

const getObjectValue = (item: any, key: string): any => {
  if (!item || typeof item !== 'object') {
    return undefined;
  }

  const actualKey = Object.keys(item).find(name => name.toLowerCase() === key.toLowerCase());
  return actualKey ? item[actualKey] : undefined;
};

const getAbsoluteUrlFromServerRelativePath = (serverRelativePath: string): string => {
  const siteUrl = new URL(TENANT_CONFIG.sites.docCenter);
  const normalizedPath = String(serverRelativePath || '').startsWith('/')
    ? serverRelativePath
    : `/${serverRelativePath}`;

  return `${siteUrl.origin}${normalizedPath}`;
};

const getDocCenterSiteServerRelativePath = (): string => {
  try {
    return new URL(TENANT_CONFIG.sites.docCenter).pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const getTargetDocCenterLibraryServerRelativeUrl = (library: IDocCenterTargetLibraryConfig): string =>
  `${getDocCenterSiteServerRelativePath()}/${library.internalName}`;

const escapeKqlPhrase = (value: string): string => String(value || '').replace(/"/g, '""');

const getDocCenterLibraryAbsolutePaths = (library: IDocCenterTargetLibraryConfig): string[] => {
  const siteUrl = TENANT_CONFIG.sites.docCenter.replace(/\/+$/, '');
  const encodedPath = `${siteUrl}/${library.internalName}`;
  let decodedPath = encodedPath;

  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    decodedPath = encodedPath;
  }

  return uniqueStrings([encodedPath, decodedPath]);
};

const getSearchLibrariesForKind = (kind: TaxonomyKind): IDocCenterTargetLibraryConfig[] => {
  if (kind === 'clients') {
    return DOC_CENTER_CLIENT_SEARCH_LIBRARIES;
  }

  if (kind === 'entities') {
    return DOC_CENTER_ENTITY_SEARCH_LIBRARIES;
  }

  return [];
};

const buildLibraryScope = (kind: TaxonomyKind): string => {
  const libraryPathQueries = getSearchLibrariesForKind(kind)
    .reduce((paths, library) => paths.concat(getDocCenterLibraryAbsolutePaths(library)), [] as string[])
    .map(path => `path:"${escapeKqlPhrase(path)}/*"`);

  if (!libraryPathQueries.length) {
    return `path:"${TENANT_CONFIG.libraries.documentCenterPath}"`;
  }

  return `(${libraryPathQueries.join(' OR ')})`;
};

const buildScope = (kind: TaxonomyKind): string =>
  `contentclass:${TENANT_CONFIG.search.contentClassDocumentLibrary} AND ${buildLibraryScope(kind)}`;

const buildPathScope = (kind: TaxonomyKind): string =>
  buildLibraryScope(kind);

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
      fieldQueries.push(`${props.relatedClientRefinable}:(${labelQueries.join(' OR ')})`);
      fieldQueries.push(`(${labelQueries.join(' OR ')})`);
    }
    if (guidQueries.length) {
      fieldQueries.push(`${props.relatedClientTaxId}:(${guidQueries.join(' OR ')})`);
    }
  }

  if (kind === 'entities') {
    if (labelQueries.length) {
      fieldQueries.push(`${props.relatedEntity}:(${labelQueries.join(' OR ')})`);
      fieldQueries.push(`${props.relatedEntityRefinable}:(${labelQueries.join(' OR ')})`);
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
    return buildScope(kind);
  }

  return `(${fieldQueries.join(' OR ')}) AND ${buildScope(kind)}`;
};

const selectProperties = (): string =>
  uniqueStrings(DOC_CENTER_SEARCH_SELECT_PROPERTIES).join(',');

const runSearchQuery = async (
  query: string,
  startRow: number = 0
): Promise<ISearchRowDocument[]> => {
  const startRowPart = startRow > 0 ? `&startrow=${startRow}` : '';
  const url =
    `${TENANT_CONFIG.sites.docCenter}/_api/search/query?querytext='${encodeURIComponent(query)}'` +
    `&rowlimit=${TENANT_CONFIG.search.rowLimitDefault}${startRowPart}` +
    `&selectproperties='${selectProperties()}'` +
    `&sortlist='LastModifiedTime:descending'`;

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
    getCellValue(cells, props.relatedClientRefinable),
    getCellValue(cells, props.relatedClientTaxId)
  ].filter(Boolean);
  const relatedEntityValues = [
    getCellValue(cells, props.relatedEntity),
    getCellValue(cells, 'RelatedEntity'),
    getCellValue(cells, props.relatedEntityRefinable),
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
  const status = getCellValue(cells, 'Status') ||
    getCellValue(cells, 'StatusOWSCHCS') ||
    getCellValue(cells, 'StatusOWSTEXT');

  return {
    title,
    fileName,
    fileUrl: path,
    path,
    activity: getLibraryNameFromPath(path),
    status,
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
      Status: status,
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

const mapDocCenterLibrary = (library: any): IDocCenterLibrary | null => {
  const id = String(getObjectValue(library, 'Id') || '').trim();
  const title = String(getObjectValue(library, 'Title') || '').trim();
  const rootFolder = getObjectValue(library, 'RootFolder');
  const rootFolderUrl = String(getObjectValue(rootFolder, 'ServerRelativeUrl') || '').trim();

  if (!id || !title || !rootFolderUrl) {
    return null;
  }

  return { id, title, rootFolderUrl };
};

const getDocCenterLists = async (): Promise<any[]> => {
  const url =
    `${TENANT_CONFIG.sites.docCenter}/_api/web/lists?` +
    `$select=Id,Title,BaseTemplate,BaseType,Hidden,ItemCount,RootFolder/ServerRelativeUrl&$expand=RootFolder`;

  debugLog('DocCenter list discovery started', { url });

  const response = await fetch(url, {
    headers: { Accept: 'application/json;odata=nometadata' }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`DocCenter lists failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = await response.json();
  const lists = Array.isArray(payload?.value) ? payload.value : [];

  debugLog('DocCenter list discovery completed', {
    count: lists.length,
    lists: lists.map((list: any) => ({
      title: getObjectValue(list, 'Title'),
      baseTemplate: getObjectValue(list, 'BaseTemplate'),
      baseType: getObjectValue(list, 'BaseType'),
      hidden: getObjectValue(list, 'Hidden'),
      itemCount: getObjectValue(list, 'ItemCount'),
      rootFolderUrl: getObjectValue(getObjectValue(list, 'RootFolder'), 'ServerRelativeUrl')
    }))
  });

  return lists;
};

const getDocCenterLibraryByTitle = async (title: string): Promise<IDocCenterLibrary | null> => {
  const escapedTitle = title.replace(/'/g, "''");
  const url =
    `${TENANT_CONFIG.sites.docCenter}/_api/web/lists/getbytitle('${escapedTitle}')?` +
    `$select=Id,Title,BaseTemplate,BaseType,Hidden,ItemCount,RootFolder/ServerRelativeUrl&$expand=RootFolder`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });

    if (!response.ok) {
      return null;
    }

    return mapDocCenterLibrary(await response.json());
  } catch {
    return null;
  }
};

const getTargetDocCenterLibrary = async (
  targetLibrary: IDocCenterTargetLibraryConfig
): Promise<IDocCenterLibrary | null> => {
  const serverRelativeUrl = getTargetDocCenterLibraryServerRelativeUrl(targetLibrary);
  const escapedServerRelativeUrl = serverRelativeUrl.replace(/'/g, "''");
  const url =
    `${TENANT_CONFIG.sites.docCenter}/_api/web/GetList('${escapedServerRelativeUrl}')?` +
    `$select=Id,Title,BaseTemplate,BaseType,Hidden,ItemCount,RootFolder/ServerRelativeUrl&$expand=RootFolder`;

  debugLog('DocCenter target library lookup started', {
    targetLibrary,
    serverRelativeUrl,
    url
  });

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });

    if (response.ok) {
      const library = mapDocCenterLibrary(await response.json());
      debugLog('DocCenter target library lookup completed by internal name', { targetLibrary, library });
      return library;
    }

    const detail = await response.text();
    console.warn(`DocCenter target library lookup by internal name failed (${response.status}):`, detail || response.statusText);
  } catch (error) {
    console.warn('DocCenter target library lookup by internal name failed', error);
  }

  const library = await getDocCenterLibraryByTitle(targetLibrary.title);
  debugLog('DocCenter target library lookup completed by title fallback', { targetLibrary, library });
  return library;
};

const getKnownDocCenterLibraryTitles = (): string[] =>
  uniqueStrings([
    ...TENANT_CONFIG.libraries.entityActivityFilters.filter(title => title !== 'All Documents')
  ]);

const getDocCenterDocumentLibraries = async (): Promise<IDocCenterLibrary[]> => {
  if (DOC_CENTER_TARGET_LIBRARIES.length) {
    const targetLibraries = (await Promise.all(DOC_CENTER_TARGET_LIBRARIES.map(getTargetDocCenterLibrary)))
      .filter(Boolean) as IDocCenterLibrary[];

    debugLog('DocCenter library scan using configured libraries only', {
      configuredLibraries: DOC_CENTER_TARGET_LIBRARIES,
      foundCount: targetLibraries.length,
      libraries: targetLibraries
    });

    return targetLibraries;
  }

  debugLog('DocCenter library scan started', { knownTitles: getKnownDocCenterLibraryTitles() });

  const lists = await getDocCenterLists();
  const libraries = lists
    .filter((library: any) => {
      const baseTemplate = Number(getObjectValue(library, 'BaseTemplate'));
      const baseType = Number(getObjectValue(library, 'BaseType'));
      return baseTemplate === 101 || baseType === 1;
    })
    .map(mapDocCenterLibrary)
    .filter(Boolean) as IDocCenterLibrary[];
  const libraryByTitle = new Map<string, IDocCenterLibrary>();

  libraries.forEach(library => libraryByTitle.set(library.title.toLowerCase(), library));

  const knownLibraries = await Promise.all(getKnownDocCenterLibraryTitles().map(getDocCenterLibraryByTitle));
  knownLibraries
    .filter(Boolean)
    .forEach(library => libraryByTitle.set((library as IDocCenterLibrary).title.toLowerCase(), library as IDocCenterLibrary));

  debugLog('DocCenter library scan completed', {
    count: libraryByTitle.size,
    libraries: Array.from(libraryByTitle.values())
  });

  return Array.from(libraryByTitle.values());
};

const getDocCenterLibraryItemsUrl = (library: IDocCenterLibrary): string =>
  `${TENANT_CONFIG.sites.docCenter}/_api/web/lists(guid'${library.id}')/items?` +
  `$top=${DOC_CENTER_REST_SCAN_ITEM_LIMIT}&$orderby=Modified desc&$expand=Author,Editor,File`;

const getDocCenterLibraryItemsUrlWithoutExpand = (library: IDocCenterLibrary): string =>
  `${TENANT_CONFIG.sites.docCenter}/_api/web/lists(guid'${library.id}')/items?` +
  `$top=${DOC_CENTER_REST_SCAN_ITEM_LIMIT}&$orderby=Modified desc`;

const mapDocCenterFileItem = (file: any, library: IDocCenterLibrary): ISearchRowDocument | null => {
  const listItem = file?.ListItemAllFields || {};
  return mapDocCenterListItem(
    {
      ...listItem,
      FileRef: listItem?.FileRef || file?.ServerRelativeUrl,
      FileLeafRef: listItem?.FileLeafRef || file?.Name,
      Modified: listItem?.Modified || file?.TimeLastModified,
      Title: listItem?.Title || file?.Title || file?.Name
    },
    library
  );
};

const getFolderFilesUrl = (folderServerRelativeUrl: string): string => {
  const serverRelativeUrl = decodeURIComponent(folderServerRelativeUrl).replace(/'/g, "''");
  return `${TENANT_CONFIG.sites.docCenter}/_api/web/GetFolderByServerRelativePath(decodedurl='${serverRelativeUrl}')/Files?` +
    `$top=${DOC_CENTER_REST_SCAN_ITEM_LIMIT}&$orderby=TimeLastModified desc&$expand=ListItemAllFields`;
};

const getFolderSubfoldersUrl = (folderServerRelativeUrl: string): string => {
  const serverRelativeUrl = decodeURIComponent(folderServerRelativeUrl).replace(/'/g, "''");
  return `${TENANT_CONFIG.sites.docCenter}/_api/web/GetFolderByServerRelativePath(decodedurl='${serverRelativeUrl}')/Folders?` +
    `$select=Name,ServerRelativeUrl`;
};

const getFolderFiles = async (
  library: IDocCenterLibrary,
  folderServerRelativeUrl: string,
  remainingLimit: number
): Promise<ISearchRowDocument[]> => {
  const documents: ISearchRowDocument[] = [];
  let url: string | undefined = getFolderFilesUrl(folderServerRelativeUrl);

  while (url && documents.length < remainingLimit) {
    debugLog('DocCenter folder files scan page started', {
      library: library.title,
      folderServerRelativeUrl,
      url
    });

    const response = await fetch(url, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });

    if (!response.ok) {
      const detail = await response.text();
      console.warn(`DocCenter folder files failed (${response.status}):`, detail || response.statusText);
      break;
    }

    const payload = await response.json();
    const pageDocuments = (Array.isArray(payload?.value) ? payload.value : [])
      .map((file: any) => mapDocCenterFileItem(file, library))
      .filter(Boolean) as ISearchRowDocument[];

    documents.push(...pageDocuments.slice(0, remainingLimit - documents.length));
    url = undefined;
  }

  debugLog('DocCenter target folder files scan completed', {
    library: library.title,
    folderServerRelativeUrl,
    count: documents.length,
    documents: documents.map(document => ({
      title: document.title,
      path: document.path,
      relatedClient: document.relatedClient,
      relatedEntity: document.relatedEntity
    }))
  });

  return documents;
};

const getFolderSubfolders = async (folderServerRelativeUrl: string): Promise<string[]> => {
  const subfolders: string[] = [];
  let url: string | undefined = getFolderSubfoldersUrl(folderServerRelativeUrl);

  while (url) {
    debugLog('DocCenter folder subfolders scan page started', { folderServerRelativeUrl, url });

    const response = await fetch(url, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });

    if (!response.ok) {
      const detail = await response.text();
      console.warn(`DocCenter folder subfolders failed (${response.status}):`, detail || response.statusText);
      break;
    }

    const payload = await response.json();
    (Array.isArray(payload?.value) ? payload.value : [])
      .filter((folder: any) => String(folder?.Name || '').toLowerCase() !== 'forms')
      .map((folder: any) => String(folder?.ServerRelativeUrl || '').trim())
      .filter(Boolean)
      .forEach((serverRelativeUrl: string) => subfolders.push(serverRelativeUrl));

    url = getODataNextLink(payload);
  }

  return subfolders;
};

const getTargetDocCenterFolderFiles = async (library: IDocCenterLibrary): Promise<ISearchRowDocument[]> => {
  const documents: ISearchRowDocument[] = [];
  const visitedFolders = new Set<string>();
  const queue = [decodeURIComponent(library.rootFolderUrl)];

  while (queue.length) {
    const folderServerRelativeUrl = queue.shift() as string;
    const normalizedFolder = folderServerRelativeUrl.toLowerCase();

    if (visitedFolders.has(normalizedFolder)) {
      continue;
    }

    visitedFolders.add(normalizedFolder);
    documents.push(...await getFolderFiles(
      library,
      folderServerRelativeUrl,
      DOC_CENTER_REST_SCAN_ITEM_LIMIT - documents.length
    ));
    if (documents.length >= DOC_CENTER_REST_SCAN_ITEM_LIMIT) {
      break;
    }
    queue.push(...await getFolderSubfolders(folderServerRelativeUrl));
  }

  debugLog('DocCenter target recursive folder scan completed', {
    library: library.title,
    foldersScanned: visitedFolders.size,
    count: documents.length
  });

  return documents;
};

const getDocumentModifiedTime = (document: ISearchRowDocument): number => {
  const rawValue = String(document.metadata?.Modified || document.modifiedDate || '').trim();
  const time = rawValue ? new Date(rawValue).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

const sortDocumentsByModifiedDesc = (documents: ISearchRowDocument[]): ISearchRowDocument[] =>
  [...documents].sort((a, b) => getDocumentModifiedTime(b) - getDocumentModifiedTime(a));

const getDocCenterLibraryItems = async (library: IDocCenterLibrary): Promise<ISearchRowDocument[]> => {
  const documents: ISearchRowDocument[] = [];
  let url: string | undefined = getDocCenterLibraryItemsUrl(library);
  let retriedWithoutExpand = false;

  while (url) {
    debugLog('DocCenter library items scan page started', { library: library.title, url });

    const response = await fetch(url, {
      headers: { Accept: 'application/json;odata=nometadata' }
    });

    if (!response.ok) {
      const detail = await response.text();
      if (!retriedWithoutExpand && url.includes('$expand=')) {
        console.warn(`DocCenter expanded library items failed for ${library.title} (${response.status}), retrying without expand:`, detail || response.statusText);
        retriedWithoutExpand = true;
        url = getDocCenterLibraryItemsUrlWithoutExpand(library);
        continue;
      }

      console.warn(`DocCenter library items failed for ${library.title} (${response.status}):`, detail || response.statusText);
      break;
    }

    const payload = await response.json();
    const pageDocuments = (Array.isArray(payload?.value) ? payload.value : [])
      .map((item: any) => mapDocCenterListItem(item, library))
      .filter(Boolean) as ISearchRowDocument[];

    documents.push(...pageDocuments.slice(0, DOC_CENTER_REST_SCAN_ITEM_LIMIT - documents.length));
    url = undefined;
  }

  debugLog('DocCenter library items scan completed', {
    library: library.title,
    count: documents.length
  });

  if (!documents.length) {
    return getTargetDocCenterFolderFiles(library);
  }

  return documents;
};

const getAllDocCenterDocumentsFromLists = async (): Promise<ISearchRowDocument[]> => {
  try {
    const libraries = await getDocCenterDocumentLibraries();
    const pages = await Promise.all(libraries.map(getDocCenterLibraryItems));
    const documents = sortDocumentsByModifiedDesc(
      pages.reduce((all, page) => all.concat(page), [] as ISearchRowDocument[])
    );

    debugLog('DocCenter REST document scan completed', {
      count: documents.length,
      documents: documents.map(document => ({
        title: document.title,
        path: document.path,
        relatedClient: document.relatedClient,
        relatedEntity: document.relatedEntity
      }))
    });

    return documents;
  } catch (error) {
    console.warn('DocCenter REST document scan failed', error);
    return [];
  }
};

const searchAllDocCenterDocuments = async (kind: TaxonomyKind): Promise<ISearchRowDocument[]> => {
  const documents: ISearchRowDocument[] = [];
  const queries = [buildScope(kind), buildPathScope(kind)];
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
  const normalizedKeyByName = new Map<string, string>();
  Object.keys(item).forEach(key => {
    lowerKeyByName.set(key.toLowerCase(), key);
    normalizedKeyByName.set(normalizeFieldKey(key), key);
  });

  return candidates
    .map(candidate => lowerKeyByName.get(candidate.toLowerCase()) || normalizedKeyByName.get(normalizeFieldKey(candidate)))
    .filter(Boolean)
    .map(key => item[key as string])
    .filter(Boolean);
};

const normalizeFieldKey = (key: string): string =>
  String(key || '')
    .toLowerCase()
    .replace(/_x0020_/g, '')
    .replace(/[^a-z0-9]/g, '');

const getFieldsContaining = (item: any, tokens: string[]): any[] => {
  if (!item || typeof item !== 'object') {
    return [];
  }

  return Object.keys(item)
    .filter(key => {
      const normalized = normalizeFieldKey(key);
      return tokens.some(token => normalized.includes(normalizeFieldKey(token)));
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

  const searchLabel = taxonomyMatch.term?.label || selectedLabel;
  const searchTermId = taxonomyMatch.term?.id || undefined;
  const query = buildTaxonomyQuery(kind, searchLabel, searchTermId);
  let documents = await runSearchQuery(query);

  documents = sortDocumentsByModifiedDesc(documents);

  debugLog('Document search completed', {
    kind,
    selectedLabel,
    docCenterTermGuid: searchTermId,
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
