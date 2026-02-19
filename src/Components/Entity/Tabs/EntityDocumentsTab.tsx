import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/DocumentsTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';

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

  const searchDocumentsByRelatedEntity = async (entityGuid: string): Promise<Document[]> => {
    const results: Document[] = [];

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
        `${webUrl}/_api/search/query?querytext='${encodeURIComponent(query)}'&rowlimit=500&selectproperties='Title,Path,LastModifiedTime,ParentLink,SiteTitle,FileType,Author,Editor,ModifiedBy'`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      if (!resp.ok) {
        continue;
      }

      const data = await resp.json();
      const rows = data.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];

      rows.forEach((row: any) => {
        const cells = row.Cells;
        const title = cells.find((c: any) => c.Key === 'Title')?.Value;
        const path = cells.find((c: any) => c.Key === 'Path')?.Value;
        const lastModified = cells.find((c: any) => c.Key === 'LastModifiedTime')?.Value;
        const editor = cells.find((c: any) => c.Key === 'Editor')?.Value;
        const author = cells.find((c: any) => c.Key === 'Author')?.Value;
        const modifiedBy = cells.find((c: any) => c.Key === 'ModifiedBy')?.Value;

        const extractUserName = (userField: any): string => {
          if (!userField) return 'Unknown';
          if (typeof userField === 'string') {
            const parts = userField.split('|');
            const email = parts[parts.length - 1];
            return email.includes('@') ? email.split('@')[0] : email;
          }
          return userField;
        };

        if (title && path) {
          const pathParts = path.split('/');
          const libraryName = pathParts[pathParts.length - 2] || 'Unknown';

          results.push({
            name: title,
            activity: libraryName,
            entity: entity?.label || libraryName,
            status: '',
            modifiedDate: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
            modifiedBy: extractUserName(modifiedBy || editor || author),
            absoluteUrl: path
          });
        }
      });

      if (results.length) break;
    }

    return results;
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
