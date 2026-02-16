// SharePoint Column Names and Field Definitions
// Centralized configuration for all columns used across the application

// ==================== CLIENTS LIST COLUMNS ====================
export const CLIENTS_LIST_COLUMNS = {
  // Basic Information
  ID: 'Id',
  TITLE: 'Title',
  CLIENT: 'Client',
  FEDERAL_TAX_ID: 'FederalTaxID',
  ENTITY_ALIASES: 'EntityAliases',
  WORK_ADDRESS: 'WorkAddress',
  MARITAL_STATUS: 'MaritalStatus',
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary',
  
  // Relationships
  CHILDREN: 'Children',
  SIBLINGS: 'Siblings',
  PARENTS: 'Parents',
  SPOUSE: 'Spouse0',
  RELATED_CLIENT: 'RelatedClient',
  RELATED_ENTITY: 'RelatedEntity',
  
  // System Fields
  CREATED: 'Created',
  MODIFIED: 'Modified',
  AUTHOR: 'Author',
  EDITOR: 'Editor'
} as const;

// ==================== DOCUMENT LIBRARY COLUMNS ====================
export const DOCUMENT_LIBRARY_COLUMNS = {
  // Document Information
  TITLE: 'Title',
  FILE_LEAF_REF: 'FileLeafRef',
  FILE_REF: 'FileRef',
  FILE_TYPE: 'FileType',
  MODIFIED: 'Modified',
  CREATED: 'Created',
  
  // Metadata Fields
  RELATED_CLIENT: 'RelatedClient',
  RELATED_CLIENT_OWS_TAX_ID: 'RelatedClientOWSTAXID',
  CONTENT_TYPE: 'ContentType',
  
  // Path Information
  PATH: 'Path',
  PARENT_LINK: 'ParentLink',
  SITE_TITLE: 'SiteTitle'
} as const;

// ==================== TERM STORE CONFIGURATION ====================
export const TERM_STORE_CONFIG = {
  TERM_GROUP_ID: 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb',
  CLIENT_TERM_SET_ID: 'e15c7ba0-e449-437f-bb70-b35bc582edda',
  ENTITY_TERM_SET_ID: '63f8136b-40cf-4d43-890a-73d4959c5a68'
} as const;

// ==================== SHAREPOINT SITES ====================
export const SHAREPOINT_SITES = {
  DOC_CENTER: 'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-docCenter'
} as const;

// ==================== SEARCH CONFIGURATION ====================
export const SEARCH_CONFIG = {
  ROW_LIMIT: 500,
  CONTENT_CLASS_DOCUMENT: 'STS_ListItem_DocumentLibrary',
  KNOWN_LIBRARIES: [
    'Documents',
    'Client Documents', 
    'Legal Documents',
    'Tax Documents'
  ]
} as const;

// ==================== DISPLAY LABELS ====================
export const DISPLAY_LABELS = {
  // Summary Tab Labels
  CLIENT_NAME: 'Client Name',
  FEDERAL_TAX_ID: 'Federal Tax ID',
  BIRTHDAY: 'Birthday',
  ANNIVERSARY: 'Anniversary',
  ADDRESS: 'Address',
  ALIASES: 'Aliases',
  MARITAL_STATUS: 'Marital Status',
  CHILDREN: 'Children',
  SIBLINGS: 'Siblings',
  PARENTS: 'Parents',
  SPOUSE: 'Spouse',
  RELATED_CLIENT: 'Related Client',
  RELATED_ENTITY: 'Related Entity',
  CREATED: 'Created',
  MODIFIED_BY: 'Modified By',
  
  // Documents Tab Labels
  DOCUMENT_NAME: 'Document Name',
  CATEGORY: 'Category',
  UPDATED_ON: 'Updated On',
  LIBRARY: 'Library'
} as const;

// ==================== API QUERY TEMPLATES ====================
export const API_QUERIES = {
  // Client list query with all necessary fields and expansions
  CLIENT_DETAILS: (clientId: number) => 
    `/web/lists/getByTitle('Clients')/items(${clientId})?` +
    `$select=*,${CLIENTS_LIST_COLUMNS.CHILDREN}/Title,${CLIENTS_LIST_COLUMNS.SIBLINGS}/Title,${CLIENTS_LIST_COLUMNS.PARENTS}/Title,${CLIENTS_LIST_COLUMNS.SPOUSE}/Title,${CLIENTS_LIST_COLUMNS.AUTHOR}/Title,${CLIENTS_LIST_COLUMNS.EDITOR}/Title&` +
    `$expand=${CLIENTS_LIST_COLUMNS.CHILDREN},${CLIENTS_LIST_COLUMNS.SIBLINGS},${CLIENTS_LIST_COLUMNS.PARENTS},${CLIENTS_LIST_COLUMNS.SPOUSE},${CLIENTS_LIST_COLUMNS.AUTHOR},${CLIENTS_LIST_COLUMNS.EDITOR}`,
    
  // Client list query for RelatedClient field only
  CLIENT_RELATED_CLIENT: (clientId: number) =>
    `/web/lists/getByTitle('Clients')/items(${clientId})?$select=${CLIENTS_LIST_COLUMNS.RELATED_CLIENT}`,
    
  // Term store query
  TERM_STORE_TERMS: (groupId: string, termSetId: string) =>
    `/api/v2.1/termstore/groups('${groupId}')/sets('${termSetId}')/terms`,
    
  // Search query templates
  SEARCH_BY_RELATED_CLIENT: (guids: string[], siteUrl: string) => {
    const guidQueries = guids.map(guid => `"${guid}"`).join(' OR ');
    return {
      query: `RelatedClientOWSTAXID:(${guidQueries}) AND contentclass:${SEARCH_CONFIG.CONTENT_CLASS_DOCUMENT} AND path:"${siteUrl}/*"`,
      properties: 'Title,Path,LastModifiedTime,ParentLink,SiteTitle,FileType'
    };
  },
  
  SEARCH_ALL_DOCS: (siteUrl: string) => ({
    query: `contentclass:${SEARCH_CONFIG.CONTENT_CLASS_DOCUMENT} AND path:"${siteUrl}/*"`,
    properties: 'Title,Path,LastModifiedTime,ParentLink,SiteTitle,RelatedClientOWSTAXID'
  })
} as const;

// ==================== FIELD MAPPINGS ====================
export const FIELD_MAPPINGS = {
  // Map internal field names to display names
  CLIENT_FIELDS: {
    [CLIENTS_LIST_COLUMNS.CLIENT]: DISPLAY_LABELS.CLIENT_NAME,
    [CLIENTS_LIST_COLUMNS.FEDERAL_TAX_ID]: DISPLAY_LABELS.FEDERAL_TAX_ID,
    [CLIENTS_LIST_COLUMNS.BIRTHDAY]: DISPLAY_LABELS.BIRTHDAY,
    [CLIENTS_LIST_COLUMNS.ANNIVERSARY]: DISPLAY_LABELS.ANNIVERSARY,
    [CLIENTS_LIST_COLUMNS.WORK_ADDRESS]: DISPLAY_LABELS.ADDRESS,
    [CLIENTS_LIST_COLUMNS.ENTITY_ALIASES]: DISPLAY_LABELS.ALIASES,
    [CLIENTS_LIST_COLUMNS.MARITAL_STATUS]: DISPLAY_LABELS.MARITAL_STATUS,
    [CLIENTS_LIST_COLUMNS.CHILDREN]: DISPLAY_LABELS.CHILDREN,
    [CLIENTS_LIST_COLUMNS.SIBLINGS]: DISPLAY_LABELS.SIBLINGS,
    [CLIENTS_LIST_COLUMNS.PARENTS]: DISPLAY_LABELS.PARENTS,
    [CLIENTS_LIST_COLUMNS.SPOUSE]: DISPLAY_LABELS.SPOUSE,
    [CLIENTS_LIST_COLUMNS.RELATED_CLIENT]: DISPLAY_LABELS.RELATED_CLIENT,
    [CLIENTS_LIST_COLUMNS.RELATED_ENTITY]: DISPLAY_LABELS.RELATED_ENTITY,
    [CLIENTS_LIST_COLUMNS.CREATED]: DISPLAY_LABELS.CREATED,
    [CLIENTS_LIST_COLUMNS.EDITOR]: DISPLAY_LABELS.MODIFIED_BY
  },
  
  DOCUMENT_FIELDS: {
    [DOCUMENT_LIBRARY_COLUMNS.TITLE]: DISPLAY_LABELS.DOCUMENT_NAME,
    [DOCUMENT_LIBRARY_COLUMNS.FILE_TYPE]: DISPLAY_LABELS.CATEGORY,
    [DOCUMENT_LIBRARY_COLUMNS.MODIFIED]: DISPLAY_LABELS.UPDATED_ON,
    [DOCUMENT_LIBRARY_COLUMNS.PARENT_LINK]: DISPLAY_LABELS.LIBRARY
  }
} as const;

// ==================== TYPE DEFINITIONS ====================
export interface ClientItem {
  Id: number;
  Title?: string;
  Client?: any;
  FederalTaxID?: string;
  EntityAliases?: string;
  WorkAddress?: string;
  MaritalStatus?: string;
  Birthday?: string;
  Anniversary?: string;
  Children?: any[];
  Siblings?: any[];
  Parents?: any[];
  Spouse0?: any[];
  RelatedClient?: any;
  RelatedEntity?: any;
  Created?: string;
  Modified?: string;
  Author?: { Title: string };
  Editor?: { Title: string };
}

export interface DocumentItem {
  name: string;
  category: string;
  updatedOn: string;
  library: string;
  absoluteUrl: string;
}

export interface Term {
  id: string;
  label: string;
}
