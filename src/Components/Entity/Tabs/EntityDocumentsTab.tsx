import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/DocumentsTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';
import { TENANT_CONFIG } from '../../../config/tenantConfig';
import {
  searchDocCenterDocumentsByLabel,
  type IDocumentSearchItem
} from '../../../services/docCenterSearchService';

const DEBUG_PREFIX = '[Greenville Debug]';

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

const mapDocument = (document: IDocumentSearchItem): Document => ({
  name: document.title || document.fileName,
  activity: document.activity,
  entity: document.relatedEntity || '-',
  status: document.status,
  modifiedDate: document.modifiedDate,
  modifiedBy: document.modifiedBy,
  absoluteUrl: document.fileUrl
});

const EntityDocumentsTab: React.FC<EntityDocumentsTabProps> = ({ webUrl, entity }) => {
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Document; direction: 'asc' | 'desc' }>({
    key: 'modifiedDate',
    direction: 'desc'
  });
  const subTabs = React.useMemo(() => TENANT_CONFIG.libraries.entityActivityFilters, []);
  const [activeActivity, setActiveActivity] = React.useState<string>(
    TENANT_CONFIG.libraries.entityActivityFilters[0]
  );
  const loadRequestRef = React.useRef(0);

  const loadDocuments = React.useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    if (!entity?.label) {
      console.log(`${DEBUG_PREFIX} Entity documents skipped, no entity label`, { entity });
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      console.log(`${DEBUG_PREFIX} Entity documents load started`, { entity });
      setLoading(true);
      setError(null);

      const result = await searchDocCenterDocumentsByLabel(
        webUrl,
        'entities',
        entity.label,
        entity.docCenterTermGuid
      );
      if (loadRequestRef.current !== requestId) {
        return;
      }

      const mappedDocuments = result.documents.map(mapDocument);
      console.log(`${DEBUG_PREFIX} Entity documents loaded`, {
        entity,
        count: mappedDocuments.length,
        documents: mappedDocuments,
        taxonomyMatch: result.taxonomyMatch,
        executedQuery: result.executedQuery
      });
      setDocuments(mappedDocuments);
      setActiveActivity(TENANT_CONFIG.libraries.entityActivityFilters[0]);
    } catch (err) {
      if (loadRequestRef.current !== requestId) {
        return;
      }

      console.error('Entity document load error', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [entity?.label, entity?.docCenterTermGuid, webUrl]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = documents.filter(doc => {
    const matchesActivity =
      activeActivity === TENANT_CONFIG.libraries.entityActivityFilters[0] || doc.activity === activeActivity;

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
    return <div className={styles.loading}>Loading documents...</div>;
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
            onChange={e => {
              console.log(`${DEBUG_PREFIX} Entity documents search text changed`, e.target.value);
              setSearchQuery(e.target.value);
            }}
            className={styles.searchInput}
          />
          <button
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Entity documents clear search clicked`);
              setSearchQuery('');
            }}
            className={styles.clearButton}
          >
            Clear Search
          </button>
        </div>
      </div>

      <div className={styles.filterSection}>
        {subTabs.map(act => (
          <button
            key={act}
            className={`${styles.filterButton} ${activeActivity === act ? styles.activeFilter : ''}`}
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Entity documents activity filter clicked`, act);
              setActiveActivity(act);
            }}
          >
            {act}
          </button>
        ))}
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.table}>
          <div className={styles.headerRow}>
            {[
              ['name', 'Document Name'],
              ['activity', 'Activity'],
              ['entity', 'Entity'],
              ['status', 'Status'],
              ['modifiedDate', 'Modified Date'],
              ['modifiedBy', 'Modified By']
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${styles.headerCell} ${styles.sortable} ${
                  sortConfig.key === key ? styles[`sort${sortConfig.direction}`] : ''
                }`}
                onClick={() => {
                  console.log(`${DEBUG_PREFIX} Entity documents sort clicked`, key);
                  handleSort(key as keyof Document);
                }}
              >
                <span>{label}</span>
              </button>
            ))}
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
