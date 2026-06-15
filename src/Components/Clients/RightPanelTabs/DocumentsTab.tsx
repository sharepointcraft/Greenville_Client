import * as React from 'react';
import styles from './DocumentsTab.module.scss';
import { TENANT_CONFIG } from '../../../config/tenantConfig';
import {
  getRootClientLabel,
  searchDocCenterDocumentsByLabel,
  type IDocumentSearchItem
} from '../../../services/docCenterSearchService';

const DEBUG_PREFIX = '[Greenville Debug]';

interface DocumentsTabProps {
  webUrl: string;
  clientId: number;
  clientTermGuid?: string | null;
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

const mapDocument = (document: IDocumentSearchItem): Document => ({
  name: document.title || document.fileName,
  activity: document.activity,
  entity: document.relatedEntity || '-',
  status: document.status,
  modifiedDate: document.modifiedDate,
  modifiedBy: document.modifiedBy,
  absoluteUrl: document.fileUrl
});

const DocumentsTab: React.FC<DocumentsTabProps> = ({ webUrl, clientId, clientTermGuid, clientName }) => {
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [activeSubTab, setActiveSubTab] = React.useState<string>(
    TENANT_CONFIG.ui.documents.clientStatusFilters[0]
  );
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Document; direction: 'asc' | 'desc' }>({
    key: 'modifiedDate',
    direction: 'desc'
  });
  const loadRequestRef = React.useRef(0);

  const loadDocuments = React.useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    try {
      console.log(`${DEBUG_PREFIX} Client documents load started`, {
        clientId,
        clientTermGuid,
        clientName
      });
      setLoading(true);
      setError(null);

      const rootClientLabel = await getRootClientLabel(webUrl, clientId, clientName);
      if (loadRequestRef.current !== requestId) {
        return;
      }

      if (!rootClientLabel) {
        console.log(`${DEBUG_PREFIX} Client documents skipped, empty root client label`, {
          clientId,
          clientName
        });
        setDocuments([]);
        return;
      }

      const result = await searchDocCenterDocumentsByLabel(
        webUrl,
        'clients',
        rootClientLabel,
        clientTermGuid
      );
      if (loadRequestRef.current !== requestId) {
        return;
      }

      const mappedDocuments = result.documents.map(mapDocument);
      console.log(`${DEBUG_PREFIX} Client documents loaded`, {
        clientId,
        clientTermGuid,
        clientName,
        rootClientLabel,
        count: mappedDocuments.length,
        documents: mappedDocuments,
        taxonomyMatch: result.taxonomyMatch,
        executedQuery: result.executedQuery
      });
      setDocuments(mappedDocuments);
      setActiveSubTab(TENANT_CONFIG.ui.documents.clientStatusFilters[0]);
    } catch (err) {
      if (loadRequestRef.current !== requestId) {
        return;
      }

      console.error('Client document load error', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      if (loadRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [clientId, clientName, clientTermGuid, webUrl]);

  React.useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filteredDocuments = documents.filter(doc => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      q === '' ||
      doc.name.toLowerCase().includes(q) ||
      doc.activity.toLowerCase().includes(q) ||
      doc.entity.toLowerCase().includes(q) ||
      doc.modifiedBy.toLowerCase().includes(q);

    const matchesSubTab =
      activeSubTab === TENANT_CONFIG.ui.documents.clientStatusFilters[0] ||
      doc.status.toLowerCase() === activeSubTab.toLowerCase();

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

  if (loading) {
    return <div className={styles.loading}>Loading documents...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  if (documents.length === 0) {
    return <div className={styles.emptyState}>No documents found for this client</div>;
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
              console.log(`${DEBUG_PREFIX} Client documents search text changed`, e.target.value);
              setSearchQuery(e.target.value);
            }}
            className={styles.searchInput}
          />
          <button
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Client documents clear search clicked`);
              setSearchQuery('');
            }}
            className={styles.clearButton}
          >
            Clear Search
          </button>
        </div>
      </div>

      <div className={styles.filterSection}>
        {TENANT_CONFIG.ui.documents.clientStatusFilters.map(tab => (
          <button
            key={tab}
            className={`${styles.filterButton} ${activeSubTab === tab ? styles.activeFilter : ''}`}
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Client documents filter clicked`, tab);
              setActiveSubTab(tab);
            }}
          >
            {tab}
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
                  console.log(`${DEBUG_PREFIX} Client documents sort clicked`, key);
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

export default DocumentsTab;
