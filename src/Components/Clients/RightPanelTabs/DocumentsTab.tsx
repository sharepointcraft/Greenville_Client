import * as React from 'react';
import styles from './DocumentsTab.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  buildTermSetTermsApiUrl
} from '../../../config/tenantConfig';
 
interface DocumentsTabProps {
  webUrl: string;
  clientId: number;
  clientName?: string | null;
}
 
interface Document {
  name: string;
  activity: string;
  entity: string;
  status: string;
  modifiedDate: string;
  modifiedBy: string;
  absoluteUrl: string;
}

interface RawDocument extends Document {
  relatedEntityValues: any[];
}

interface EntityTermInfo {
  labelByGuid: Record<string, string>;
  groupGuids: Set<string>;
  groupLabels: Set<string>;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ webUrl, clientId, clientName }) => {
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeSubTab, setActiveSubTab] = React.useState<string>(
    TENANT_CONFIG.ui.documents.clientStatusFilters[0]
  );
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Document; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc'
  });

  const collectTermGuids = (value: any, set: Set<string>) => {
    if (!value) return;
 
    if (typeof value === 'string') {
      const matches = value.match(TENANT_CONFIG.patterns.guid);
      (matches || []).forEach(guid => set.add(guid.toLowerCase()));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => collectTermGuids(v, set));
      return;
    }

    if (typeof value === 'object') {
      const guid = value.TermGuid || value.termGuid || value.id || value.Id;
      if (guid && typeof guid === 'string') {
        const matches = guid.match(TENANT_CONFIG.patterns.guid);
        (matches || []).forEach(matchedGuid => set.add(matchedGuid.toLowerCase()));
      }
    }
  };

  const parseTaxonomyLabels = (value: any): string[] => {
    if (!value) return [];

    if (typeof value === 'string') {
      const labelsFromPairs = value
        .split(';#')
        .filter(v => v.includes('|'))
        .map(v => {
          const parts = v.split('|');
          return {
            label: parts[0]?.trim() || '',
            guid: (parts[1] || '').trim().toLowerCase()
          };
        })
        .filter(pair => pair.guid !== TENANT_CONFIG.termStore.sets.entities.toLowerCase())
        .map(pair => pair.label)
        .filter(label => Boolean(label) && !/^gp\d+$/i.test(String(label)));

      if (labelsFromPairs.length) {
        return labelsFromPairs as string[];
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
      value.forEach(v => {
        labels.push(...parseTaxonomyLabels(v));
      });
      return labels;
    }

    if (typeof value === 'object') {
      const label = value.Label || value.label || value.Title || value.title || value.name;
      return label ? [String(label)] : [];
    }

    return [];
  };

  const uniqueStrings = (values: string[]): string[] => {
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

  const normalizeText = (value: string): string =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const buildClientLabelCandidates = (values: Array<string | undefined | null>): Set<string> => {
    const candidates = new Set<string>();

    values.forEach(value => {
      const normalized = normalizeText(String(value || ''));
      if (!normalized) return;
      candidates.add(normalized);

      const withoutSuffix = normalized
        .replace(/\b(llc|inc|corp|corporation|ltd|lp|l\.l\.c\.)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (withoutSuffix && withoutSuffix !== normalized) {
        candidates.add(withoutSuffix);
      }
    });

    return candidates;
  };

  const matchesClientLabel = (
    values: any[],
    clientLabelCandidates: Set<string>
  ): boolean => {
    if (!clientLabelCandidates.size) return false;

    const labels: string[] = [];
    values.forEach(value => {
      parseTaxonomyLabels(value).forEach(label => {
        labels.push(normalizeText(label));
      });
    });

    const uniqueLabels = uniqueStrings(labels);
    if (!uniqueLabels.length) return false;

    return uniqueLabels.some(label =>
      Array.from(clientLabelCandidates).some(candidate =>
        label === candidate || label.includes(candidate) || candidate.includes(label)
      )
    );
  };

  const pathMatchesClientLabel = (
    absoluteUrl: string,
    clientLabelCandidates: Set<string>
  ): boolean => {
    if (!clientLabelCandidates.size) return false;

    try {
      const decodedPath = normalizeText(decodeURIComponent(new URL(absoluteUrl).pathname));
      return Array.from(clientLabelCandidates).some(candidate =>
        decodedPath.includes(candidate) || candidate.includes(decodedPath)
      );
    } catch {
      return false;
    }
  };

  const getCellValue = (cells: any[], key: string): string => {
    const found = cells.find((cell: any) => String(cell.Key || '').toLowerCase() === key.toLowerCase());
    return found?.Value || '';
  };

  const extractUserName = (userField: any): string => {
    if (!userField) return 'Unknown';
    if (typeof userField === 'string') {
      const parts = userField.split('|');
      if (parts.length > 1) {
        const email = parts[parts.length - 1];
        return email.includes('@') ? email.split('@')[0] : email;
      }
      return userField;
    }
    return String(userField);
  };

  const loadEntityTerms = async (guids: Set<string>): Promise<EntityTermInfo> => {
    const empty: EntityTermInfo = {
      labelByGuid: {},
      groupGuids: new Set<string>(),
      groupLabels: new Set<string>()
    };

    if (!guids.size) return empty;

    const resp = await fetch(
      buildTermSetTermsApiUrl(webUrl, TENANT_CONFIG.termStore.sets.entities),
      { headers: { Accept: 'application/json' } }
    );

    const data = await resp.json();
    const labelByGuid: Record<string, string> = {};
    const groupGuids = new Set<string>();
    const groupLabels = new Set<string>();

    (data.value || []).forEach((term: any) => {
      const termId = String(term.id || '').toLowerCase();
      if (!termId || !guids.has(termId)) return;

      const label =
        term.labels?.find((l: any) => l.isDefault)?.name ||
        term.labels?.[0]?.name;

      const hasChildren =
        Number(term.childrenCount || 0) > 0 ||
        (Array.isArray(term.children) && term.children.length > 0);

      if (label) {
        labelByGuid[termId] = label;
        if (hasChildren) {
          groupLabels.add(label.toLowerCase());
        }
      }

      if (hasChildren) {
        groupGuids.add(termId);
      }
    });

    return {
      labelByGuid,
      groupGuids,
      groupLabels
    };
  };

  const hasEntityValue = (values: any[]): boolean => {
    const guids = new Set<string>();
    values.forEach(v => collectTermGuids(v, guids));
    if (guids.size) return true;
    return values.some(v => parseTaxonomyLabels(v).length > 0);
  };

  const buildEntityText = (values: any[], entityTermInfo: EntityTermInfo): string => {
    const guids = new Set<string>();
    values.forEach(v => collectTermGuids(v, guids));

    const mappedLeafLabels = Array.from(guids)
      .filter(guid => !entityTermInfo.groupGuids.has(guid))
      .map(guid => entityTermInfo.labelByGuid[guid])
      .filter(Boolean) as string[];

    const fallbackLabels: string[] = [];
    values.forEach(v => {
      fallbackLabels.push(...parseTaxonomyLabels(v));
    });

    if (mappedLeafLabels.length) {
      return uniqueStrings(mappedLeafLabels).join(', ');
    }

    const filteredFallback = fallbackLabels.filter(label => !entityTermInfo.groupLabels.has(label.toLowerCase()));
    if (filteredFallback.length) {
      return uniqueStrings(filteredFallback).join(', ');
    }

    return '';
  };

  const fetchDocumentRelatedEntity = async (absoluteUrl: string): Promise<any> => {
    try {
      const serverRelativePath = new URL(absoluteUrl).pathname;
      const endpoints = [
        `${TENANT_CONFIG.sites.docCenter}/_api/web/GetFileByServerRelativePath(decodedurl='${serverRelativePath}')/ListItemAllFields?$select=RelatedEntity,ReletedEntity`,
        `${TENANT_CONFIG.sites.docCenter}/_api/web/GetFileByServerRelativeUrl('${serverRelativePath}')/ListItemAllFields?$select=RelatedEntity,ReletedEntity`
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: { Accept: 'application/json;odata=nometadata' }
          });

          if (!response.ok) {
            continue;
          }

          const data = await response.json();
          const relatedEntity = data.RelatedEntity || data.ReletedEntity;
          if (relatedEntity) {
            return relatedEntity;
          }
        } catch (err) {
          console.warn('RelatedEntity fallback request failed', err);
        }
      }
    } catch (err) {
      console.warn('Failed to parse document URL for entity fallback', err);
    }

    return null;
  };

  const enrichDocumentsWithEntity = async (rawDocuments: RawDocument[]): Promise<Document[]> => {
    const withFallbackValues = await Promise.all(
      rawDocuments.map(async doc => {
        if (hasEntityValue(doc.relatedEntityValues)) {
          return doc;
        }

        const fallbackEntity = await fetchDocumentRelatedEntity(doc.absoluteUrl);
        if (!fallbackEntity) {
          return doc;
        }

        return {
          ...doc,
          relatedEntityValues: [...doc.relatedEntityValues, fallbackEntity]
        };
      })
    );

    const entityGuids = new Set<string>();
    withFallbackValues.forEach(doc => {
      doc.relatedEntityValues.forEach(value => collectTermGuids(value, entityGuids));
    });

    const entityTermInfo = await loadEntityTerms(entityGuids);

    return withFallbackValues.map(doc => ({
      name: doc.name,
      activity: doc.activity,
      entity: buildEntityText(doc.relatedEntityValues, entityTermInfo) || '-',
      status: doc.status,
      modifiedDate: doc.modifiedDate,
      modifiedBy: doc.modifiedBy,
      absoluteUrl: doc.absoluteUrl
    }));
  };

  const dedupeDocuments = (docs: RawDocument[]): RawDocument[] => {
    const byUrl = new Map<string, RawDocument>();

    docs.forEach(doc => {
      const existing = byUrl.get(doc.absoluteUrl);
      if (!existing) {
        byUrl.set(doc.absoluteUrl, doc);
        return;
      }

      byUrl.set(doc.absoluteUrl, {
        ...existing,
        relatedEntityValues: [...existing.relatedEntityValues, ...doc.relatedEntityValues]
      });
    });

    return Array.from(byUrl.values());
  };
 
  const loadClientTerms = async (guids: Set<string>): Promise<Record<string, string>> => {
    if (!guids.size) return {};

    const resp = await fetch(
      buildTermSetTermsApiUrl(webUrl, TENANT_CONFIG.termStore.sets.clients),
      { headers: { Accept: 'application/json' } }
    );
 
    const data = await resp.json();
 
    const map: Record<string, string> = {};
    (data.value || []).forEach((term: any) => {
      if (guids.has(term.id)) {
        const label =
          term.labels?.find((l: any) => l.isDefault)?.name ||
          term.labels?.[0]?.name;
        if (label) map[term.id] = label;
      }
    });

    return map;
  };
 
  const searchDocumentsByRelatedClient = async (
    relatedClientGuids: Set<string>,
    clientLabelCandidates: Set<string>
  ): Promise<Document[]> => {
    const allDocuments: RawDocument[] = [];

    try {
      const documentPath = TENANT_CONFIG.libraries.documentCenterPath;
      const documentClass = TENANT_CONFIG.search.contentClassDocumentLibrary;
      const relatedClientTaxId = TENANT_CONFIG.search.managedProperties.relatedClientTaxId;
      const relatedClient = TENANT_CONFIG.search.managedProperties.relatedClient;
      const relatedEntity = TENANT_CONFIG.search.managedProperties.relatedEntity;
      const relatedEntityTaxId = TENANT_CONFIG.search.managedProperties.relatedEntityTaxId;
      const relatedEntityTaxIdFallback = TENANT_CONFIG.search.managedProperties.relatedEntityTaxIdFallback;

      const guidTerms = Array.from(relatedClientGuids).map(guid => `"${guid}"`);
      const labelTerms = Array.from(clientLabelCandidates).map(label => {
        const escapedLabel = label.replace(/"/g, '""');
        return `"${escapedLabel}"`;
      });

      const queryCandidates: string[] = [];
      const scopedBase = `contentclass:${documentClass} AND path:"${documentPath}"`;
      const unscopedBase = `contentclass:${documentClass}`;

      if (guidTerms.length) {
        const guidQuery = guidTerms.join(' OR ');
        queryCandidates.push(`${relatedClientTaxId}:(${guidQuery}) AND ${scopedBase}`);
        queryCandidates.push(`${relatedClient}:(${guidQuery}) AND ${scopedBase}`);
        queryCandidates.push(`(${guidQuery}) AND ${scopedBase}`);
        queryCandidates.push(`${relatedClientTaxId}:(${guidQuery}) AND ${unscopedBase}`);
        queryCandidates.push(`${relatedClient}:(${guidQuery}) AND ${unscopedBase}`);
        queryCandidates.push(`(${guidQuery}) AND ${unscopedBase}`);
      }

      if (labelTerms.length) {
        const labelQuery = labelTerms.join(' OR ');
        queryCandidates.push(`${relatedClient}:(${labelQuery}) AND ${scopedBase}`);
        queryCandidates.push(`(${labelQuery}) AND ${scopedBase}`);
        queryCandidates.push(`${relatedClient}:(${labelQuery}) AND ${unscopedBase}`);
        queryCandidates.push(`(${labelQuery}) AND ${unscopedBase}`);
      }

      const searchSelectProperties = [
        TENANT_CONFIG.search.selectProperties.documents,
        relatedClientTaxId,
        relatedClient
      ].join(',');

      for (const query of queryCandidates) {
        try {
          const searchResponse = await fetch(
            `${webUrl}/_api/search/query?querytext='${encodeURIComponent(query)}'&rowlimit=${TENANT_CONFIG.search.rowLimitDefault}&selectproperties='${searchSelectProperties}'`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );

          if (!searchResponse.ok) {
            continue;
          }

          const searchData = await searchResponse.json();
          const results = searchData.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];

          results.forEach((row: any) => {
            const cells = row.Cells;
            const title = getCellValue(cells, 'Title');
            const path = getCellValue(cells, 'Path');
            const lastModified = getCellValue(cells, 'LastModifiedTime');
            const author = getCellValue(cells, 'Author');
            const editor = getCellValue(cells, 'Editor');
            const modifiedBy = getCellValue(cells, 'ModifiedBy');
            const relatedEntityValue = getCellValue(cells, relatedEntity);
            const relatedEntityTaxIdValue =
              getCellValue(cells, relatedEntityTaxId) ||
              getCellValue(cells, relatedEntityTaxIdFallback);

            if (title && path) {
              const pathParts = path.split('/');
              const libraryName = pathParts[pathParts.length - 2] || 'Unknown';

              allDocuments.push({
                name: title,
                activity: libraryName,
                entity: '',
                status: '',
                modifiedDate: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
                modifiedBy: extractUserName(modifiedBy || editor || author),
                absoluteUrl: path,
                relatedEntityValues: [relatedEntityValue, relatedEntityTaxIdValue].filter(Boolean)
              });
            }
          });

          if (allDocuments.length > 0) {
            break;
          }
        } catch (queryError) {
          console.warn('Client documents query failed', queryError);
        }
      }

      if (allDocuments.length === 0) {
        const fallbackSelectProperties = [
          TENANT_CONFIG.search.selectProperties.documentsWithRelatedClient,
          relatedClient
        ].join(',');

        try {
          const allDocsResponse = await fetch(
            `${webUrl}/_api/search/query?querytext='contentclass:${documentClass} AND path:"${documentPath}"'&rowlimit=${TENANT_CONFIG.search.rowLimitExpanded}&selectproperties='${fallbackSelectProperties}'`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );

          if (allDocsResponse.ok) {
            const allDocsData = await allDocsResponse.json();
            const allResults = allDocsData.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];

            allResults.forEach((row: any) => {
              const cells = row.Cells;
              const title = getCellValue(cells, 'Title');
              const path = getCellValue(cells, 'Path');
              const lastModified = getCellValue(cells, 'LastModifiedTime');
              const relatedClientTaxIdValue = getCellValue(cells, relatedClientTaxId);
              const relatedClientValue = getCellValue(cells, relatedClient);
              const relatedEntityValue = getCellValue(cells, relatedEntity);
              const relatedEntityTaxIdValue =
                getCellValue(cells, relatedEntityTaxId) ||
                getCellValue(cells, relatedEntityTaxIdFallback);
              const author = getCellValue(cells, 'Author');
              const editor = getCellValue(cells, 'Editor');
              const modifiedBy = getCellValue(cells, 'ModifiedBy');

              if (!title || !path) {
                return;
              }

              const documentGuids = new Set<string>();
              collectTermGuids(relatedClientTaxIdValue, documentGuids);
              collectTermGuids(relatedClientValue, documentGuids);

              const hasGuidMatch = Array.from(documentGuids).some(docGuid => relatedClientGuids.has(docGuid));
              const hasLabelMatch = matchesClientLabel(
                [relatedClientTaxIdValue, relatedClientValue],
                clientLabelCandidates
              );
              const hasPathLabelMatch = pathMatchesClientLabel(path, clientLabelCandidates);

              if (!hasGuidMatch && !hasLabelMatch && !hasPathLabelMatch) {
                return;
              }

              const pathParts = path.split('/');
              const libraryName = pathParts[pathParts.length - 2] || 'Unknown';

              allDocuments.push({
                name: title,
                activity: libraryName,
                entity: '',
                status: '',
                modifiedDate: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
                modifiedBy: extractUserName(modifiedBy || editor || author),
                absoluteUrl: path,
                relatedEntityValues: [relatedEntityValue, relatedEntityTaxIdValue].filter(Boolean)
              });
            });
          }
        } catch (directError) {
          console.error('Client documents fallback query failed', directError);
        }
      }
    } catch (error) {
      console.error('Error searching documents:', error);
    }

    const dedupedDocuments = dedupeDocuments(allDocuments);
    return enrichDocumentsWithEntity(dedupedDocuments);
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const relatedClientField = TENANT_CONFIG.lists.clients.columns.relatedClient || 'RelatedClient';
      const clientField = TENANT_CONFIG.lists.clients.columns.client || 'Client';
      const clientSelect = `${relatedClientField},${clientField},Title`;

      const clientResponse = await fetch(
        `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.clients.title)}(${clientId})?$select=${clientSelect}`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      if (!clientResponse.ok) {
        throw new Error(`Failed to fetch client data: ${clientResponse.status} ${clientResponse.statusText}`);
      }

      const clientData = await clientResponse.json();
      const relatedClientGuids = new Set<string>();
      collectTermGuids(clientData[relatedClientField], relatedClientGuids);

      const relatedClientLabelsFromItem = [
        ...parseTaxonomyLabels(clientData[relatedClientField]),
        ...parseTaxonomyLabels(clientData[clientField])
      ];

      const clientTermMap = await loadClientTerms(relatedClientGuids);
      const clientTermLabels = Object.keys(clientTermMap).map(key => clientTermMap[key]);
      const clientLabelCandidates = buildClientLabelCandidates([
        clientName,
        clientData.Title,
        ...relatedClientLabelsFromItem,
        ...clientTermLabels
      ]);

      if (relatedClientGuids.size === 0 && clientLabelCandidates.size === 0) {
        setDocuments([]);
        return;
      }

      const foundDocuments = await searchDocumentsByRelatedClient(
        relatedClientGuids,
        clientLabelCandidates
      );
      setDocuments(foundDocuments);

    } catch (err) {
      console.error('Error in loadDocuments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadDocuments();
  }, [clientId, clientName, webUrl]);
 
const getStatusClass = (status: string): string => {
  const statusMap: Record<string, string> = {
    'draft': 'draft',
    'approval': 'approval',
    'signature': 'signature',
    'hold': 'hold',
    'final': 'final',
    'identification': 'identification'
  };
  return statusMap[status.toLowerCase()] || '';
};

const subTabs = TENANT_CONFIG.ui.documents.clientStatusFilters;

const filteredDocuments = documents.filter(doc => {
  const matchesSearch = searchQuery === '' ||
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.activity.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.modifiedBy.toLowerCase().includes(searchQuery.toLowerCase());

  const matchesSubTab = activeSubTab === TENANT_CONFIG.ui.documents.clientStatusFilters[0] || 
    (activeSubTab === 'Draft' && doc.status.toLowerCase() === 'draft') ||
    (activeSubTab === 'Approval' && doc.status.toLowerCase() === 'approval') ||
    (activeSubTab === 'Signature' && doc.status.toLowerCase() === 'signature') ||
    (activeSubTab === 'Hold' && doc.status.toLowerCase() === 'hold') ||
    (activeSubTab === 'Final' && doc.status.toLowerCase() === 'final') ||
    (activeSubTab === 'Identification' && doc.status.toLowerCase() === 'identification');

  return matchesSearch && matchesSubTab;
});

const sortedDocuments = React.useMemo(() => {
  const list = [...filteredDocuments];

  const compare = (a: Document, b: Document): number => {
    const { key, direction } = sortConfig;
    const dir = direction === 'asc' ? 1 : -1;

    if (key === 'modifiedDate') {
      const da = new Date(a.modifiedDate).getTime();
      const db = new Date(b.modifiedDate).getTime();
      return (da - db) * dir;
    }

    const av = (a[key] || '').toString().toLowerCase();
    const bv = (b[key] || '').toString().toLowerCase();
    return av.localeCompare(bv) * dir;
  };

  return list.sort(compare);
}, [filteredDocuments, sortConfig]);

const handleSort = (key: keyof Document) => {
  setSortConfig(prev => {
    if (prev.key === key) {
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    }
    return { key, direction: 'asc' };
  });
};

const clearSearch = () => {
  setSearchQuery('');
};

if (loading) {
  return <div className={styles.loading}>Loading documents…</div>;
}
 
if (error) {
  return <div className={styles.error}>Error: {error}</div>;
}
 
if (documents.length === 0) {
  return <div className={styles.emptyState}>No documents found for this client</div>;
}
 
return (
  <div className={styles.container}>
    {/* Search Bar */}
    <div className={styles.searchSection}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Search for documents"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
                  <button onClick={clearSearch} className={styles.clearButton}>
            Clear Search
          </button>
        </div>
      </div>
 
    {/* Filter Buttons */}
    <div className={styles.filterSection}>
      {subTabs.map((tab) => (
        <button
          key={tab}
          className={`${styles.filterButton} ${
            activeSubTab === tab ? styles.activeFilter : ''
          }`}
          onClick={() => setActiveSubTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
 
    {/* Documents Table */}
    <div className={styles.tableContainer}>
      <div className={styles.table}>
        <div className={styles.headerRow}>
          <button
            type="button"
            className={`${styles.headerCell} ${styles.sortable} ${
              sortConfig.key === 'name' ? styles[`sort${sortConfig.direction}`] : ''
            }`}
            onClick={() => handleSort('name')}
          >
            <span>Document Name</span>
          </button>
          <button
            type="button"
            className={`${styles.headerCell} ${styles.sortable} ${
              sortConfig.key === 'activity' ? styles[`sort${sortConfig.direction}`] : ''
            }`}
            onClick={() => handleSort('activity')}
          >
            <span>Activity</span>
          </button>
          <button
            type="button"
            className={`${styles.headerCell} ${styles.sortable} ${
              sortConfig.key === 'entity' ? styles[`sort${sortConfig.direction}`] : ''
            }`}
            onClick={() => handleSort('entity')}
          >
            <span>Entity</span>
          </button>
          <button
            type="button"
            className={`${styles.headerCell} ${styles.sortable} ${
              sortConfig.key === 'status' ? styles[`sort${sortConfig.direction}`] : ''
            }`}
            onClick={() => handleSort('status')}
          >
            <span>Status</span>
          </button>
          <button
            type="button"
            className={`${styles.headerCell} ${styles.sortable} ${
              sortConfig.key === 'modifiedDate' ? styles[`sort${sortConfig.direction}`] : ''
            }`}
            onClick={() => handleSort('modifiedDate')}
          >
            <span>Modified Date</span>
          </button>
          <button
            type="button"
            className={`${styles.headerCell} ${styles.sortable} ${
              sortConfig.key === 'modifiedBy' ? styles[`sort${sortConfig.direction}`] : ''
            }`}
            onClick={() => handleSort('modifiedBy')}
          >
            <span>Modified By</span>
          </button>
        </div>

        <div className={styles.bodyRows}>
          {!filteredDocuments.length && (
            <div className={styles.noData}>No documents found</div>
          )}

          {sortedDocuments.map((doc, index) => (
            <div key={`${doc.absoluteUrl}-${index}`} className={styles.dataRow}>
              <div className={styles.link}>
                <a href={doc.absoluteUrl} target="_blank" rel="noopener noreferrer">
                  {doc.name}
                </a>
              </div>
              <div>{doc.activity}</div>
              <div>{doc.entity}</div>
              <div>{doc.status || '-'}</div>
              <div>{doc.modifiedDate}</div>
              <div>{doc.modifiedBy}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
  );
};

export default DocumentsTab;
