import * as React from 'react';
import styles from './DocumentsTab.module.scss';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const CLIENT_TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';
const DOC_CENTER_URL = 'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter';

interface DocumentsTabProps {
  webUrl: string;
  clientId: number;
}

interface Document {
  name: string;
  category: string;
  updatedOn: string;
  library: string;
  absoluteUrl: string;
}

const DocumentsTab: React.FC<DocumentsTabProps> = ({ webUrl, clientId }) => {
  const [documents, setDocuments] = React.useState<Document[]>([]);
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
        `${webUrl}/_api/web/lists/getByTitle('Clients')/items(${clientId})?$select=RelatedClient`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      if (!clientResponse.ok) {
        throw new Error(`Failed to fetch client data: ${clientResponse.status} ${clientResponse.statusText}`);
      }

      const clientData = await clientResponse.json();
      console.log('Client data:', clientData);
      
      // Extract RelatedClient term GUIDs
      const relatedClientGuids = new Set<string>();
      collectTermGuids(clientData.RelatedClient, relatedClientGuids);

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
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${CLIENT_TERM_SET_ID}')/terms`,
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

  const searchDocumentsByRelatedClient = async (relatedClientGuids: Set<string>): Promise<Document[]> => {
    const allDocuments: Document[] = [];

    try {
      console.log('Searching for documents with RelatedClient GUIDs:', Array.from(relatedClientGuids));

      // Method 1: Try using the SharePoint search with proper managed metadata syntax
      // For managed metadata fields, we need to use the GUID format
      const guidQueries = Array.from(relatedClientGuids).map(guid => `"${guid}"`).join(' OR ');
      
      // Try different managed property names that SharePoint might use for RelatedClient
      const searchQueries = [
        `RelatedClientOWSTAXID:(${guidQueries}) AND contentclass:STS_ListItem_DocumentLibrary AND path:"https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter/*"`,
        `RelatedClient:(${guidQueries}) AND contentclass:STS_ListItem_DocumentLibrary AND path:"https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter/*"`,
        `"${Array.from(relatedClientGuids).join('" OR "')}" AND contentclass:STS_ListItem_DocumentLibrary AND path:"https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter/*"`
      ];

      for (const query of searchQueries) {
        console.log('Trying search query:', query);
        
        try {
          const searchResponse = await fetch(
            `${webUrl}/_api/search/query?querytext='${encodeURIComponent(query)}'&rowlimit=500&selectproperties='Title,Path,LastModifiedTime,ParentLink,SiteTitle,FileType'`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const results = searchData.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];
            
            console.log(`Search query "${query}" returned ${results.length} results`);

            results.forEach((row: any) => {
              const cells = row.Cells;
              const title = cells.find((cell: any) => cell.Key === 'Title')?.Value;
              const path = cells.find((cell: any) => cell.Key === 'Path')?.Value;
              const lastModified = cells.find((cell: any) => cell.Key === 'LastModifiedTime')?.Value;
              const fileType = cells.find((cell: any) => cell.Key === 'FileType')?.Value;

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
            `${webUrl}/_api/search/query?querytext='contentclass:STS_ListItem_DocumentLibrary AND path:"https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter/*"'&rowlimit=1000&selectproperties='Title,Path,LastModifiedTime,ParentLink,SiteTitle,RelatedClientOWSTAXID'`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );

          if (allDocsResponse.ok) {
            const allDocsData = await allDocsResponse.json();
            const allResults = allDocsData.PrimaryQueryResult?.RelevantResults?.Table?.Rows || [];
            
            console.log(`Found ${allResults.length} total documents in Prod-docCenter`);

            allResults.forEach((row: any) => {
              const cells = row.Cells;
              const title = cells.find((cell: any) => cell.Key === 'Title')?.Value;
              const path = cells.find((cell: any) => cell.Key === 'Path')?.Value;
              const lastModified = cells.find((cell: any) => cell.Key === 'LastModifiedTime')?.Value;
              const relatedClientTaxId = cells.find((cell: any) => cell.Key === 'RelatedClientOWSTAXID')?.Value;

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
