import * as React from 'react';
import styles from './DocumentsTab.module.scss';
import {
  TERM_STORE_CONFIG,
  CLIENTS_LIST_COLUMNS,
  DOCUMENT_LIBRARY_COLUMNS,
  SHAREPOINT_SITES,
  SEARCH_CONFIG,
  DISPLAY_LABELS,
  API_QUERIES,
  type DocumentItem
} from '../../Constants';

interface DocumentsTabProps {
  webUrl: string;
  clientId: number;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ webUrl, clientId }) => {
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [clientTerms, setClientTerms] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    loadDocuments();
  }, [clientId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading documents for clientId:', clientId);

      // Step 1: Get the client item with RelatedClient field
      const clientResponse = await fetch(
        `${webUrl}/_api${API_QUERIES.CLIENT_RELATED_CLIENT(clientId)}`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      if (!clientResponse.ok) {
        throw new Error(`Failed to fetch client data: ${clientResponse.status} ${clientResponse.statusText}`);
      }

      const clientData = await clientResponse.json();
      console.log('Client data:', clientData);
      
      // Extract RelatedClient term GUIDs
      const relatedClientGuids = new Set<string>();
      collectTermGuids(clientData[CLIENTS_LIST_COLUMNS.RELATED_CLIENT], relatedClientGuids);

      console.log('RelatedClient GUIDs:', Array.from(relatedClientGuids));

      if (relatedClientGuids.size === 0) {
        console.log('No RelatedClient GUIDs found for this client');
        setDocuments([]);
        setLoading(false);
        return;
      }

      // Step 2: Load client terms to get the actual names
      await loadClientTerms(relatedClientGuids);
      console.log('Client terms loaded:', clientTerms);

      // Step 3: Search for documents across all libraries in Prod-docCenter
      const foundDocuments = await searchDocumentsByRelatedClient(relatedClientGuids);
      console.log('Found documents:', foundDocuments);
      setDocuments(foundDocuments);

    } catch (err) {
      console.error('Error in loadDocuments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const collectTermGuids = (value: any, set: Set<string>) => {
    if (!value) return;

    if (typeof value === 'string') {
      value
        .split(';#')
        .filter(v => v.includes('|'))
        .forEach(v => {
          const guid = v.split('|')[1];
          if (guid) set.add(guid);
        });
    } else if (Array.isArray(value)) {
      value.forEach(v => collectTermGuids(v, set));
    } else if (typeof value === 'object' && value.TermGuid) {
      set.add(value.TermGuid);
    }
  };

  const loadClientTerms = async (guids: Set<string>) => {
    const resp = await fetch(
      `${webUrl}/_api${API_QUERIES.TERM_STORE_TERMS(TERM_STORE_CONFIG.TERM_GROUP_ID, TERM_STORE_CONFIG.CLIENT_TERM_SET_ID)}`,
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

    setClientTerms(map);
  };

  const searchDocumentsByRelatedClient = async (relatedClientGuids: Set<string>): Promise<DocumentItem[]> => {
    const allDocuments: DocumentItem[] = [];

    try {
      console.log('Searching for documents with RelatedClient GUIDs:', Array.from(relatedClientGuids));

      // Method 1: Try using the SharePoint search with proper managed metadata syntax
      const guidQueries = Array.from(relatedClientGuids).map(guid => `"${guid}"`).join(' OR ');
      
      // Try different managed property names that SharePoint might use for RelatedClient
      const searchQueries = [
        `${DOCUMENT_LIBRARY_COLUMNS.RELATED_CLIENT_OWS_TAX_ID}:(${guidQueries}) AND contentclass:${SEARCH_CONFIG.CONTENT_CLASS_DOCUMENT} AND path:"${SHAREPOINT_SITES.DOC_CENTER}/*"`,
        `${DOCUMENT_LIBRARY_COLUMNS.RELATED_CLIENT}:(${guidQueries}) AND contentclass:${SEARCH_CONFIG.CONTENT_CLASS_DOCUMENT} AND path:"${SHAREPOINT_SITES.DOC_CENTER}/*"`,
        `"${Array.from(relatedClientGuids).join('" OR "')}" AND contentclass:${SEARCH_CONFIG.CONTENT_CLASS_DOCUMENT} AND path:"${SHAREPOINT_SITES.DOC_CENTER}/*"`
      ];

      for (const query of searchQueries) {
        console.log('Trying search query:', query);
        
        try {
          const searchResponse = await fetch(
            `${webUrl}/_api/search/query?querytext='${encodeURIComponent(query)}'&rowlimit=${SEARCH_CONFIG.ROW_LIMIT}&selectproperties='${DOCUMENT_LIBRARY_COLUMNS.TITLE},${DOCUMENT_LIBRARY_COLUMNS.PATH},${DOCUMENT_LIBRARY_COLUMNS.MODIFIED},${DOCUMENT_LIBRARY_COLUMNS.PARENT_LINK},${DOCUMENT_LIBRARY_COLUMNS.SITE_TITLE},${DOCUMENT_LIBRARY_COLUMNS.FILE_TYPE}'`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const results = searchData.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];
            
            console.log(`Search query "${query}" returned ${results.length} results`);

            results.forEach((row: any) => {
              const cells = row.Cells;
              const title = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.TITLE)?.Value;
              const path = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.PATH)?.Value;
              const lastModified = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.MODIFIED)?.Value;
              const fileType = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.FILE_TYPE)?.Value;

              if (title && path) {
                const pathParts = path.split('/');
                const libraryName = pathParts[pathParts.length - 2] || 'Unknown';

                allDocuments.push({
                  name: title,
                  category: libraryName,
                  updatedOn: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
                  library: libraryName,
                  absoluteUrl: path
                });
              }
            });

            if (allDocuments.length > 0) {
              break; // Found documents, no need to try other queries
            }
          } else {
            console.log(`Search query failed with status: ${searchResponse.status}`);
          }
        } catch (queryError) {
          console.log(`Search query failed:`, queryError);
        }
      }

      // Method 2: If search doesn't work, try a direct approach using the document center site
      if (allDocuments.length === 0) {
        console.log('Search API did not return results, trying direct approach...');
        
        // Try to get all documents from Prod-docCenter and filter client-side
        try {
          const allDocsResponse = await fetch(
            `${webUrl}/_api/search/query?querytext='contentclass:${SEARCH_CONFIG.CONTENT_CLASS_DOCUMENT} AND path:"${SHAREPOINT_SITES.DOC_CENTER}/*"'&rowlimit=1000&selectproperties='${DOCUMENT_LIBRARY_COLUMNS.TITLE},${DOCUMENT_LIBRARY_COLUMNS.PATH},${DOCUMENT_LIBRARY_COLUMNS.MODIFIED},${DOCUMENT_LIBRARY_COLUMNS.PARENT_LINK},${DOCUMENT_LIBRARY_COLUMNS.SITE_TITLE},${DOCUMENT_LIBRARY_COLUMNS.RELATED_CLIENT_OWS_TAX_ID}'`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );

          if (allDocsResponse.ok) {
            const allDocsData = await allDocsResponse.json();
            const allResults = allDocsData.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];
            
            console.log(`Found ${allResults.length} total documents in Prod-docCenter`);

            allResults.forEach((row: any) => {
              const cells = row.Cells;
              const title = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.TITLE)?.Value;
              const path = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.PATH)?.Value;
              const lastModified = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.MODIFIED)?.Value;
              const relatedClientTaxId = cells.find((cell: any) => cell.Key === DOCUMENT_LIBRARY_COLUMNS.RELATED_CLIENT_OWS_TAX_ID)?.Value;

              // Check if this document has any of our target RelatedClient GUIDs
              if (title && path && relatedClientTaxId) {
                const documentGuids = relatedClientTaxId.split(';').filter((g: string) => g.trim());
                const hasMatch = documentGuids.some((docGuid: string) => 
                  relatedClientGuids.has(docGuid.trim())
                );

                if (hasMatch) {
                  const pathParts = path.split('/');
                  const libraryName = pathParts[pathParts.length - 2] || 'Unknown';

                  allDocuments.push({
                    name: title,
                    category: libraryName,
                    updatedOn: lastModified ? new Date(lastModified).toLocaleDateString() : 'Unknown',
                    library: libraryName,
                    absoluteUrl: path
                  });
                }
              }
            });
          }
        } catch (directError) {
          console.error('Direct approach failed:', directError);
        }
      }

    } catch (error) {
      console.error('Error searching documents:', error);
    }

    console.log('Final documents found:', allDocuments);
    return allDocuments;
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
      {documents.map((doc) => (
        <div className={styles.documentRow} key={`${doc.library}-${doc.name}`}>
          <div className={styles.documentName}>
            <a href={doc.absoluteUrl} target="_blank" rel="noopener noreferrer">
              {doc.name}
            </a>
          </div>
          <div className={styles.documentMeta}>{doc.category}</div>
          <div className={styles.documentMeta}>{doc.updatedOn}</div>
        </div>
      ))}
    </div>
  );
};

export default DocumentsTab;
