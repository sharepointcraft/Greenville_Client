import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/DocumentsTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';
const GUID_PATTERN = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;
const GUID_EXACT_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface EntityDocumentsTabProps {
  webUrl: string;
  entity: EntitySelection | null;
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

const EntityDocumentsTab: React.FC<EntityDocumentsTabProps> = ({ webUrl, entity }) => {
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Document; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc'
  });
  const subTabs = React.useMemo(
    () => [
      'All Documents',
      'Account Administration',
      'Letters of Direction (LOD)',
      'Trusts and Amendments',
      'Formation Documents',
      'Executed Legal Documents',
      'Correspondence',
      'Contracts',
      'Confidentiality Agreements',
      'Annual Meetings and Resolutions'
    ],
    []
  );
  const [activeActivity, setActiveActivity] = React.useState<string>('All Documents');

  const collectTermGuids = (value: any, set: Set<string>) => {
    if (!value) return;

    if (typeof value === 'string') {
      const matches = value.match(GUID_PATTERN);
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
        const matches = guid.match(GUID_PATTERN);
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
        .filter(pair => pair.guid !== ENTITY_TERM_SET_ID.toLowerCase())
        .map(pair => pair.label)
        .filter(label => Boolean(label) && !/^gp\d+$/i.test(String(label)));

      if (labelsFromPairs.length) {
        return labelsFromPairs as string[];
      }

      const compact = value.trim();
      if (!compact || GUID_EXACT_PATTERN.test(compact)) {
        return [];
      }

      if (compact.includes('|') || compact.includes(';#')) {
        return [];
      }

      const guidTokens = compact
        .split(/[;,\s]+/)
        .map(token => token.trim())
        .filter(Boolean);

      if (guidTokens.length && guidTokens.every(token => GUID_EXACT_PATTERN.test(token))) {
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

  const getCellValue = (cells: any[], key: string): string => {
    const found = cells.find((cell: any) => String(cell.Key || '').toLowerCase() === key.toLowerCase());
    return found?.Value || '';
  };

  const extractUserName = (userField: any): string => {
    if (!userField) return 'Unknown';
    if (typeof userField === 'string') {
      const parts = userField.split('|');
      const email = parts[parts.length - 1];
      return email.includes('@') ? email.split('@')[0] : email;
    }
    return userField;
  };

  const loadEntityTerms = async (guids: Set<string>): Promise<EntityTermInfo> => {
    const empty: EntityTermInfo = {
      labelByGuid: {},
      groupGuids: new Set<string>(),
      groupLabels: new Set<string>()
    };

    if (!guids.size) return empty;

    const resp = await fetch(
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${ENTITY_TERM_SET_ID}')/terms`,
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
      const fileUrl = new URL(absoluteUrl);
      const serverRelativePath = fileUrl.pathname;
      const escapedPath = serverRelativePath.replace(/'/g, "''");
      const pathSegments = fileUrl.pathname.split('/').filter(Boolean);
      let siteWebUrl = fileUrl.origin;

      if ((pathSegments[0] === 'sites' || pathSegments[0] === 'teams') && pathSegments[1]) {
        siteWebUrl = `${fileUrl.origin}/${pathSegments[0]}/${pathSegments[1]}`;
      }

      const endpoints = [
        `${siteWebUrl}/_api/web/GetFileByServerRelativePath(decodedurl='${escapedPath}')/ListItemAllFields?$select=RelatedEntity,ReletedEntity`,
        `${siteWebUrl}/_api/web/GetFileByServerRelativeUrl('${escapedPath}')/ListItemAllFields?$select=RelatedEntity,ReletedEntity`
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
          console.warn('Entity documents RelatedEntity fallback request failed', err);
        }
      }
    } catch (err) {
      console.warn('Entity documents failed to parse URL for entity fallback', err);
    }

    return null;
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

  const enrichDocumentsWithEntity = async (rawDocuments: RawDocument[]): Promise<Document[]> => {
    const withFallbackValues = await Promise.all(
      rawDocuments.map(async doc => {
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

  const searchDocumentsByRelatedEntity = async (entityGuid: string): Promise<Document[]> => {
    const results: RawDocument[] = [];

    const queries = [
      // Managed metadata managed property (most accurate)
      `RelatedEntityOWSTAXID:("${entityGuid}") AND contentclass:STS_ListItem_DocumentLibrary`,
      // Sometimes crawled property surfaces as RelatedEntity
      `RelatedEntity:("${entityGuid}") AND contentclass:STS_ListItem_DocumentLibrary`,
      // Fallback plain text
      `"${entityGuid}" AND contentclass:STS_ListItem_DocumentLibrary`
    ];

    for (const query of queries) {
      const resp = await fetch(
        `${webUrl}/_api/search/query?querytext='${encodeURIComponent(query)}'&rowlimit=500&selectproperties='Title,Path,LastModifiedTime,ParentLink,SiteTitle,FileType,Author,Editor,ModifiedBy,RelatedEntity,RelatedEntityOWSTAXID,owstaxIdRelatedEntity'`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      if (!resp.ok) {
        continue;
      }

      const data = await resp.json();
      const rows = data.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];

      rows.forEach((row: any) => {
        const cells = row.Cells;
        const title = getCellValue(cells, 'Title');
        const path = getCellValue(cells, 'Path');
        const lastModified = getCellValue(cells, 'LastModifiedTime');
        const editor = getCellValue(cells, 'Editor');
        const author = getCellValue(cells, 'Author');
        const modifiedBy = getCellValue(cells, 'ModifiedBy');
        const relatedEntity = getCellValue(cells, 'RelatedEntity');
        const relatedEntityTaxId =
          getCellValue(cells, 'RelatedEntityOWSTAXID') ||
          getCellValue(cells, 'owstaxIdRelatedEntity');

        if (title && path) {
          const pathParts = path.split('/');
          const libraryName = pathParts[pathParts.length - 2] || 'Unknown';

          results.push({
            name: title,
            activity: libraryName,
            entity: '',
            status: '',
            modifiedDate: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
            modifiedBy: extractUserName(modifiedBy || editor || author),
            absoluteUrl: path,
            relatedEntityValues: [relatedEntity, relatedEntityTaxId].filter(Boolean)
          });
        }
      });

      if (results.length) break;
    }

    const deduped = dedupeDocuments(results);
    return enrichDocumentsWithEntity(deduped);
  };

  const loadDocuments = async () => {
    if (!entity?.termGuid) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const docs = await searchDocumentsByRelatedEntity(entity.termGuid);
      setDocuments(docs);
      setActiveActivity('All Documents');
    } catch (err) {
      console.error('Entity documents load error', err);
      setError('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadDocuments();
  }, [entity?.termGuid, webUrl]);

  const filteredDocuments = documents.filter(doc => {
    const matchesActivity =
      activeActivity === 'All Documents' || doc.activity === activeActivity;

    if (!searchQuery) return matchesActivity;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      doc.name.toLowerCase().includes(q) ||
      doc.activity.toLowerCase().includes(q) ||
      doc.entity.toLowerCase().includes(q) ||
      doc.modifiedBy.toLowerCase().includes(q);

    return matchesActivity && matchesSearch;
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

  if (loading) {
    return <div className={styles.loading}>Loading documents…</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  if (!documents.length) {
    return <div className={styles.emptyState}>No documents found for this entity</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search for documents"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <button onClick={() => setSearchQuery('')} className={styles.clearButton}>
            Clear Search
          </button>
        </div>
      </div>

      <div className={styles.filterSection}>
        {subTabs.map(act => (
          <button
            key={act}
            className={`${styles.filterButton} ${
              activeActivity === act ? styles.activeFilter : ''
            }`}
            onClick={() => setActiveActivity(act)}
          >
            {act}
          </button>
        ))}
      </div>

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

export default EntityDocumentsTab;
